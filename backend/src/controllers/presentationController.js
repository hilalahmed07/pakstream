const Presentation = require('../models/Presentation');
const PresentationProcessor = require('../services/presentationProcessor');
const { calculateFileHash } = require('../services/hashService');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const Download = require('../models/Download');
const storageService = require('../services/storageService');
const { isMinIOEnabled } = require('../config/storage');
const { ensureUniqueTitle } = require('../utils/uniqueTitle');
const { isPowerPoint } = require('../utils/magicBytes');

const presentationProcessor = new PresentationProcessor();
const PRESENTATION_TITLE_MAX = 90;
const PRESENTATION_DESCRIPTION_MAX = 180;
const PRESENTATION_MAX_TAGS = 3;

const parsePresentationTags = (tags) => {
  const rawTags = Array.isArray(tags) ? tags : String(tags || '').split(',');
  return rawTags
    .map((tag) => String(tag).trim())
    .filter(Boolean);
};

const validatePresentationPayload = ({ title, description, tags }) => {
  const trimmedTitle = String(title || '').trim();
  const trimmedDescription = String(description || '').trim();
  const normalizedTags = parsePresentationTags(tags);

  if (!trimmedTitle || !trimmedDescription) {
    return { message: 'Title and description are required' };
  }

  if (trimmedTitle.length > PRESENTATION_TITLE_MAX) {
    return { message: `Title must be ${PRESENTATION_TITLE_MAX} characters or fewer` };
  }

  if (trimmedDescription.length > PRESENTATION_DESCRIPTION_MAX) {
    return { message: `Description must be ${PRESENTATION_DESCRIPTION_MAX} characters or fewer` };
  }

  if (normalizedTags.length > PRESENTATION_MAX_TAGS) {
    return { message: `You can add up to ${PRESENTATION_MAX_TAGS} tags only` };
  }

  return {
    title: trimmedTitle,
    description: trimmedDescription,
    tags: normalizedTags,
  };
};

// Upload presentation
const uploadPresentation = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Verify actual file content regardless of extension or browser-reported MIME type
    const fileIsRealPpt = await isPowerPoint(req.file.path);
    if (!fileIsRealPpt) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ message: 'Invalid file. Only real PowerPoint files (.ppt, .pptx) are accepted.' });
    }

    const { title, description, category = 'other', tags = [] } = req.body;
    const userId = req.user.id;
    const validatedPayload = validatePresentationPayload({ title, description, tags });

    if (validatedPayload.message) {
      return res.status(400).json({ message: validatedPayload.message });
    }

    const resolvedTitle = await ensureUniqueTitle(Presentation, validatedPayload.title, {
      maxLength: PRESENTATION_TITLE_MAX,
    });

    // Calculate SHA-256 hash of the uploaded file
    let sha256Hash = null;
    try {
      sha256Hash = await calculateFileHash(req.file.path);
      console.log(`Calculated SHA-256 hash for presentation: ${sha256Hash.substring(0, 16)}...`);
    } catch (hashError) {
      console.error('Error calculating file hash:', hashError);
      // Don't fail upload if hash calculation fails, but log the error
    }

    // Create presentation record
    const presentation = new Presentation({
      title: resolvedTitle,
      description: validatedPayload.description,
      uploadedBy: userId,
      originalFile: {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      category,
      tags: validatedPayload.tags,
      sha256Hash: sha256Hash
    });

    await presentation.save();

    // Process presentation in background
    presentationProcessor.processPresentation(presentation._id.toString(), req.file.path)
      .then(async (result) => {
        presentation.slides = result.slides;
        presentation.thumbnail = result.thumbnail;
        presentation.totalSlides = result.totalSlides;
        presentation.status = 'ready';
        presentation.processingProgress = 100;
        await presentation.save();

        // --- START MINIO CONVERSION ---
        // Upload presentation files to storage service
        try {
          // 1. Upload original file
          const objectName = `presentations/original/${presentation.originalFile.filename}`;
          await storageService.uploadFile(req.file.path, objectName, presentation.originalFile.mimetype);

          // 2. Upload processed slides and thumbnail
          if (presentation.slides && presentation.slides.length > 0) {
            const presentationId = presentation._id.toString();

            // Upload slides
            for (const slide of presentation.slides) {
              const slidePath = path.join(__dirname, '../../uploads', slide.imagePath);
              const slideObjectName = `presentations/processed/${presentationId}/slides/${slide.imagePath.split('/').pop()}`;
              await storageService.uploadFile(slidePath, slideObjectName, 'image/jpeg');
            }

            // Upload thumbnail
            if (presentation.thumbnail) {
              const thumbPath = path.join(__dirname, '../../uploads', presentation.thumbnail);
              const thumbObjectName = `presentations/thumbnails/${presentation.thumbnail.split('/').pop()}`;
              await storageService.uploadFile(thumbPath, thumbObjectName, 'image/jpeg');
            }
          }
          console.log(`Presentation ${presentation._id} files uploaded to storage service`);
        } catch (uploadError) {
          console.error(`Failed to upload presentation ${presentation._id} to storage:`, uploadError);
        }
        // --- END MINIO CONVERSION ---

        console.log(`Presentation ${presentation._id} processed successfully`);
      })
      .catch(async (error) => {
        console.error(`Error processing presentation ${presentation._id}:`, error);
        presentation.status = 'error';
        await presentation.save();
      });


    res.status(201).json({
      message: 'Presentation uploaded successfully',
      presentation: {
        id: presentation._id,
        title: presentation.title,
        status: presentation.status,
        processingProgress: presentation.processingProgress
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed. Please ensure the file is a valid PowerPoint presentation (.ppt, .pptx).' });
  }
};

// Get all presentations
const getPresentations = async (req, res) => {
  try {
    // const { page = 1, limit = 12, category, search } = req.query;
    const { page = 1, limit = 4, category, search } = req.query; // for testing 
    const skip = (page - 1) * limit;

    let query = { status: 'ready', isPublic: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const presentations = await Presentation.find(query)
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Presentation.countDocuments(query);

    // Add isLiked status for each presentation if user is authenticated
    const userId = req.user?._id || req.user?.id;
    const presentationsWithLikeStatus = presentations.map(presentation => {
      const presentationObj = presentation.toObject();
      if (userId && presentation.likedBy && Array.isArray(presentation.likedBy)) {
        presentationObj.isLiked = presentation.likedBy.some(
          likeId => likeId && likeId.toString() === userId.toString()
        );
      } else {
        presentationObj.isLiked = false;
      }
      return presentationObj;
    });

    res.json({
      presentations: presentationsWithLikeStatus,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get presentations error:', error);
    res.status(500).json({ message: 'Failed to fetch presentations', error: error.message });
  }
};




// Get presentation by ID
const getPresentationById = async (req, res) => {
  try {
    const { id } = req.params;

    const presentation = await Presentation.findById(id)
      .populate('uploadedBy', 'username email');

    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' });
    }

    // Add isLiked status if user is authenticated
    const userId = req.user?._id || req.user?.id;
    const presentationObj = presentation.toObject();
    if (userId && presentation.likedBy && Array.isArray(presentation.likedBy)) {
      presentationObj.isLiked = presentation.likedBy.some(
        likeId => likeId && likeId.toString() === userId.toString()
      );
    } else {
      presentationObj.isLiked = false;
    }

    res.json({ presentation: presentationObj });

  } catch (error) {
    console.error('Get presentation error:', error);
    res.status(500).json({ message: 'Failed to fetch presentation', error: error.message });
  }
};

// Track presentation view
const trackPresentationView = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId } = req.query; // Session ID to prevent duplicate tracking

    const presentation = await Presentation.findById(id);
    if (!presentation) {
      return res.status(404).json({ success: false, message: 'Presentation not found' });
    }

    // Check if view was already tracked in this session (prevent duplicate on refresh)
    // Note: This is a simple check. For production, consider using Redis or a ViewTracking collection
    // For now, we rely on frontend sessionStorage to prevent duplicate calls

    // Increment view count atomically
    const updated = await Presentation.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    ).catch(err => {
      console.error('Failed to update view count:', err);
      return null;
    });

    res.json({
      success: true,
      message: 'View tracked',
      data: {
        presentationId: id,
        views: updated ? updated.views : presentation.views + 1
      }
    });
  } catch (error) {
    console.error('View tracking error:', error);
    res.status(200).json({
      success: true,
      message: 'View tracking attempted'
    });
  }
};

// Toggle presentation like
const togglePresentationLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id; // Get user ID from auth middleware

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const presentation = await Presentation.findById(id);
    if (!presentation) {
      return res.status(404).json({ success: false, message: 'Presentation not found' });
    }

    // Initialize likedBy array if it doesn't exist
    if (!presentation.likedBy) {
      presentation.likedBy = [];
    }

    const isLiked = presentation.likedBy.some(
      likeId => likeId && likeId.toString() === userId.toString()
    );

    let newLikes;
    let isLikedAfter;

    if (req.body.action === 'unlike') {
      // Remove user from likedBy array if user is authenticated
      if (userId) {
        presentation.likedBy = presentation.likedBy.filter(
          likeId => likeId.toString() !== userId.toString()
        );
      }
      newLikes = Math.max(0, presentation.likes - 1);
      isLikedAfter = false;
    } else {
      // Add user to likedBy array if not already liked and user is authenticated
      if (userId && !isLiked) {
        presentation.likedBy.push(userId);
      }
      // Only increment if user wasn't already in the list (prevent duplicate likes)
      if (!isLiked) {
        newLikes = presentation.likes + 1;
      } else {
        newLikes = presentation.likes; // Already liked, don't increment
      }
      isLikedAfter = true;
    }

    await Presentation.findByIdAndUpdate(
      id,
      {
        $set: {
          likes: newLikes,
          likedBy: presentation.likedBy
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      message: req.body.action === 'unlike' ? 'Unliked' : 'Liked',
      data: {
        presentationId: id,
        likes: newLikes,
        isLiked: isLikedAfter
      }
    });
  } catch (error) {
    console.error('Like toggle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle like',
      error: error.message
    });
  }
};

// Get presentation slides
const getPresentationSlides = async (req, res) => {
  try {
    const { id } = req.params;

    const presentation = await Presentation.findById(id);

    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' });
    }

    if (presentation.status !== 'ready') {
      return res.status(400).json({ message: 'Presentation is not ready yet' });
    }

    res.json({ slides: presentation.slides });

  } catch (error) {
    console.error('Get slides error:', error);
    res.status(500).json({ message: 'Failed to fetch slides', error: error.message });
  }
};

// Serve presentation image
const getPresentationImage = async (req, res) => {
  try {
    const { id, slideNumber } = req.params;
    const presentation = await Presentation.findById(id);

    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' });
    }

    const slide = presentation.slides.find(s => s.slideNumber === parseInt(slideNumber));

    if (!slide) {
      return res.status(404).json({ message: 'Slide not found' });
    }

    const presentationId = id.toString();
    const objectName = `presentations/processed/${presentationId}/slides/${slide.imagePath.split('/').pop()}`;

    // --- START MINIO CONVERSION ---
    // Handle presentation slide serving

    const exists = await storageService.fileExists(objectName);

    if (!exists) {
      // Fallback to local path
      const imagePath = path.join(__dirname, '../../uploads', slide.imagePath);
      if (!fsSync.existsSync(imagePath)) {
        return res.status(404).json({ message: 'Image file not found' });
      }
      return res.sendFile(path.resolve(imagePath));
    }

    const fileStream = await storageService.getFileStream(objectName);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fileStream.pipe(res);
    // --- END MINIO CONVERSION ---

  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ message: 'Failed to fetch image', error: error.message });
  }
};

// Serve presentation thumbnail
const getPresentationThumbnail = async (req, res) => {
  try {
    const { id } = req.params;
    const presentation = await Presentation.findById(id);

    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' });
    }

    if (!presentation.thumbnail) {
      return res.status(404).json({ message: 'Thumbnail not found' });
    }

    const objectName = `presentations/thumbnails/${presentation.thumbnail.split('/').pop()}`;

    // --- START MINIO CONVERSION ---
    // Handle presentation thumbnail serving

    const exists = await storageService.fileExists(objectName);

    if (!exists) {
      // Fallback to local path
      const thumbnailPath = path.join(__dirname, '../../uploads', presentation.thumbnail);
      if (!fsSync.existsSync(thumbnailPath)) {
        return res.status(404).json({ message: 'Thumbnail file not found' });
      }
      return res.sendFile(path.resolve(thumbnailPath));
    }

    const fileStream = await storageService.getFileStream(objectName);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fileStream.pipe(res);
    // --- END MINIO CONVERSION ---

  } catch (error) {
    console.error('Get thumbnail error:', error);
    res.status(500).json({ message: 'Failed to fetch thumbnail', error: error.message });
  }
};


// Get admin presentations
const getAdminPresentations = async (req, res) => {
  try {
    const { page = 1, limit = 4, category, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (category && category !== 'all') {
      query.category = category;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && String(search).trim()) {
      const normalizedSearch = String(search).trim();
      const searchRegex = new RegExp(normalizedSearch, 'i');
      const searchConditions = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } },
      ];

      if (/^[0-9a-fA-F]{24}$/.test(normalizedSearch)) {
        searchConditions.push({ _id: normalizedSearch });
      }

      query.$or = searchConditions;
    }

    const presentations = await Presentation.find(query)
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Presentation.countDocuments(query);

    res.json({
      presentations,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });

  } catch (error) {
    console.error('Get admin presentations error:', error);
    res.status(500).json({ message: 'Failed to fetch presentations', error: error.message });
  }
};

// Delete presentation
const deletePresentation = async (req, res) => {
  try {
    const { id } = req.params;

    const presentation = await Presentation.findById(id);

    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' });
    }

    // Delete files
    const presentationDir = path.join(__dirname, '../../uploads/presentations/processed', id);
    if (fsSync.existsSync(presentationDir)) {
      fsSync.rmSync(presentationDir, { recursive: true, force: true });
    }

    if (presentation.originalFile?.path && fsSync.existsSync(presentation.originalFile.path)) {
      fsSync.unlinkSync(presentation.originalFile.path);
    }

    await Presentation.findByIdAndDelete(id);

    res.json({ message: 'Presentation deleted successfully' });

  } catch (error) {
    console.error('Delete presentation error:', error);
    res.status(500).json({ message: 'Failed to delete presentation', error: error.message });
  }
};

// Update presentation
const updatePresentation = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, tags, isPublic } = req.body;
    const update = {
      updatedAt: new Date(),
    };

    if (typeof title === 'string' && title.trim()) {
      if (title.trim().length > PRESENTATION_TITLE_MAX) {
        return res.status(400).json({ message: `Title must be ${PRESENTATION_TITLE_MAX} characters or fewer` });
      }

      update.title = await ensureUniqueTitle(Presentation, title.trim(), {
        excludeId: id,
        maxLength: PRESENTATION_TITLE_MAX,
      });
    }
    if (description !== undefined) {
      const trimmedDescription = String(description).trim();

      if (!trimmedDescription) {
        return res.status(400).json({ message: 'Description is required' });
      }

      if (trimmedDescription.length > PRESENTATION_DESCRIPTION_MAX) {
        return res.status(400).json({ message: `Description must be ${PRESENTATION_DESCRIPTION_MAX} characters or fewer` });
      }

      update.description = trimmedDescription;
    }
    if (category !== undefined) update.category = category;
    if (tags !== undefined) {
      const normalizedTags = parsePresentationTags(tags);

      if (normalizedTags.length > PRESENTATION_MAX_TAGS) {
        return res.status(400).json({ message: `You can add up to ${PRESENTATION_MAX_TAGS} tags only` });
      }

      update.tags = normalizedTags;
    }
    if (isPublic !== undefined) update.isPublic = isPublic;

    const presentation = await Presentation.findByIdAndUpdate(id, update, { new: true }).populate(
      'uploadedBy',
      'username email'
    );

    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' });
    }

    res.json({ presentation });

  } catch (error) {
    console.error('Update presentation error:', error);
    res.status(500).json({ message: 'Failed to update presentation', error: error.message });
  }
};

// Get presentation hash for manual verification
const getPresentationHash = async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id);

    if (!presentation) {
      return res.status(404).json({
        success: false,
        message: 'Presentation not found'
      });
    }

    if (!presentation.sha256Hash) {
      return res.status(404).json({
        success: false,
        message: 'Hash not available for this presentation. It may have been uploaded before hash calculation was implemented.'
      });
    }

    res.json({
      success: true,
      data: {
        presentationId: presentation._id,
        title: presentation.title,
        sha256Hash: presentation.sha256Hash,
        uploadedAt: presentation.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting presentation hash:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get presentation hash',
      error: error.message
    });
  }
};

// Verify presentation integrity
const verifyPresentationIntegrity = async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id);

    if (!presentation) {
      return res.status(404).json({
        success: false,
        message: 'Presentation not found'
      });
    }

    if (!presentation.sha256Hash) {
      return res.status(400).json({
        success: false,
        message: 'Hash not available for this presentation. It may have been uploaded before hash calculation was implemented.',
        data: {
          presentationId: presentation._id,
          title: presentation.title,
          canVerify: false
        }
      });
    }

    // Check if file was uploaded or hash string was provided
    let providedHash = null;

    if (req.file) {
      // File was uploaded, calculate its hash
      try {
        providedHash = await calculateFileHash(req.file.path);
        // Clean up temporary file
        await fs.unlink(req.file.path).catch(() => {
          // Ignore cleanup errors
        });
      } catch (hashError) {
        return res.status(500).json({
          success: false,
          message: 'Failed to calculate hash of uploaded file',
          error: hashError.message
        });
      }
    } else if (req.body.hash) {
      // Hash string was provided directly
      providedHash = req.body.hash.toLowerCase().trim();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a presentation file or a hash string',
        data: {
          presentationId: presentation._id,
          title: presentation.title
        }
      });
    }

    // Compare hashes
    const storedHash = presentation.sha256Hash.toLowerCase().trim();
    const matches = providedHash === storedHash;

    res.json({
      success: true,
      data: {
        presentationId: presentation._id,
        title: presentation.title,
        verified: matches,
        providedHash: providedHash,
        storedHash: storedHash,
        message: matches
          ? 'Presentation integrity verified. The file matches the original.'
          : 'Presentation integrity check failed. The file does not match the original and may have been tampered with.',
        verifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error verifying presentation integrity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify presentation integrity',
      error: error.message
    });
  }
};

// Get users who liked a presentation
const getPresentationLikedByUsers = async (req, res) => {
  try {
    // Only admins are allowed to see who liked a presentation
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to view like details'
      });
    }

    const { id } = req.params;

    const presentation = await Presentation.findById(id)
      .populate({
        path: 'likedBy',
        select: 'username email profile',
        model: 'User'
      });

    if (!presentation) {
      return res.status(404).json({
        success: false,
        message: 'Presentation not found'
      });
    }

    // Filter out any null entries and format the response
    const likedByUsers = (presentation.likedBy || [])
      .filter(user => user !== null)
      .map(user => ({
        _id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile || {}
      }));

    res.json({
      success: true,
      data: {
        presentationId: id,
        totalLikes: presentation.likes || likedByUsers.length,
        likedBy: likedByUsers
      }
    });

  } catch (error) {
    console.error('Get liked by users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch liked by users',
      error: error.message
    });
  }
};


// Download presentation file
const downloadPresentation = async (req, res) => {
  try {
    const { id } = req.params;
    const presentation = await Presentation.findById(id);

    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' });
    }

    if (req.user) {
      Download.create({
        user: req.user.id || req.user._id,
        assetType: 'presentation',
        assetId: presentation._id,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent'),
      }).catch((err) => {
        console.error('Failed to track presentation download:', err);
      });
    }

    // Check if file is in MinIO or local
    const objectName = `presentations/original/${presentation.originalFile.filename}`;
    const exists = await storageService.fileExists(objectName);

    if (exists) {
      const fileStream = await storageService.getFileStream(objectName);
      res.setHeader('Content-Disposition', `attachment; filename="${presentation.originalFile.filename}"`);
      res.setHeader('Content-Type', presentation.originalFile.mimetype);
      return fileStream.pipe(res);
    } else {
      // Fallback to local
      const filePath = path.resolve(presentation.originalFile.path);
      if (!fsSync.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found on server' });
      }
      return res.download(filePath, presentation.originalFile.filename);
    }
  } catch (error) {
    console.error('Download presentation error:', error);
    res.status(500).json({ message: 'Download failed', error: error.message });
  }
};

module.exports = {
  uploadPresentation,
  getPresentations,
  getPresentationById,
  getPresentationSlides,
  getPresentationImage,
  getPresentationThumbnail,
  getAdminPresentations,
  deletePresentation,
  updatePresentation,
  getPresentationHash,
  verifyPresentationIntegrity,
  trackPresentationView,
  togglePresentationLike,
  getPresentationLikedByUsers,
  downloadPresentation
};
