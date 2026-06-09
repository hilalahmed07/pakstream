const Document = require('../models/Document');
const DocumentProcessor = require('../services/documentProcessor');
const { calculateFileHash } = require('../services/hashService');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const storageService = require('../services/storageService');
const { isMinIOEnabled } = require('../config/storage');
const { ensureUniqueTitle } = require('../utils/uniqueTitle');
const { isPdf } = require('../utils/magicBytes');

const documentProcessor = new DocumentProcessor();
const DOCUMENT_TITLE_MAX = 90;
const DOCUMENT_DESCRIPTION_MAX = 180;
const DOCUMENT_MAX_TAGS = 3;

const parseDocumentTags = (tags) => {
  const rawTags = Array.isArray(tags) ? tags : String(tags || '').split(',');
  return rawTags
    .map((tag) => String(tag).trim())
    .filter(Boolean);
};

const validateDocumentPayload = ({ title, description, tags }) => {
  const trimmedTitle = String(title || '').trim();
  const trimmedDescription = String(description || '').trim();
  const normalizedTags = parseDocumentTags(tags);

  if (!trimmedTitle || !trimmedDescription) {
    return { message: 'Title and description are required' };
  }

  if (trimmedTitle.length > DOCUMENT_TITLE_MAX) {
    return { message: `Title must be ${DOCUMENT_TITLE_MAX} characters or fewer` };
  }

  if (trimmedDescription.length > DOCUMENT_DESCRIPTION_MAX) {
    return { message: `Description must be ${DOCUMENT_DESCRIPTION_MAX} characters or fewer` };
  }

  if (normalizedTags.length > DOCUMENT_MAX_TAGS) {
    return { message: `You can add up to ${DOCUMENT_MAX_TAGS} tags only` };
  }

  return {
    title: trimmedTitle,
    description: trimmedDescription,
    tags: normalizedTags,
  };
};

// Upload document
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Verify actual file content regardless of extension or browser-reported MIME type
    const fileIsRealPdf = await isPdf(req.file.path);
    if (!fileIsRealPdf) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ message: 'Invalid file. Only real PDF documents are accepted.' });
    }

    const { title, description, category = 'other', tags = [] } = req.body;
    const userId = req.user.id;
    const validatedPayload = validateDocumentPayload({ title, description, tags });

    if (validatedPayload.message) {
      return res.status(400).json({ message: validatedPayload.message });
    }

    const resolvedTitle = await ensureUniqueTitle(Document, validatedPayload.title, {
      maxLength: DOCUMENT_TITLE_MAX,
    });

    // Calculate SHA-256 hash of the uploaded file
    let sha256Hash = null;
    try {
      sha256Hash = await calculateFileHash(req.file.path);
      console.log(`Calculated SHA-256 hash for document: ${sha256Hash.substring(0, 16)}...`);
    } catch (hashError) {
      console.error('Error calculating file hash:', hashError);
      // Don't fail upload if hash calculation fails, but log the error
    }

    // Create document record
    const document = new Document({
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

    await document.save();

    // Process document in background
    documentProcessor.processDocument(document._id.toString(), req.file.path)
      .then(async (result) => {
        document.pageCount = result.pageCount;
        document.thumbnail = result.thumbnail;
        document.status = 'ready';
        document.processingProgress = 100;
        await document.save();

        // --- START MINIO CONVERSION ---
        // Upload document to storage service after processing
        try {
          // Upload original document
          const objectName = `documents/original/${document.originalFile.filename}`;
          await storageService.uploadFile(req.file.path, objectName, document.originalFile.mimetype);

          // Upload thumbnail if available
          if (document.thumbnail) {
            const thumbnailPath = path.join(__dirname, '../../uploads', document.thumbnail);
            const thumbObjectName = `documents/thumbnails/${document.thumbnail.split('/').pop()}`;
            await storageService.uploadFile(thumbnailPath, thumbObjectName, 'image/jpeg');
          }
          console.log(`Document ${document._id} and files uploaded to storage service`);
        } catch (uploadError) {
          console.error(`Failed to upload document ${document._id} to storage service:`, uploadError);
        }
        // --- END MINIO CONVERSION ---

        console.log(`Document ${document._id} processed successfully`);
      })
      .catch(async (error) => {
        console.error(`Error processing document ${document._id}:`, error);
        document.status = 'error';
        await document.save();
      });


    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document._id,
        title: document.title,
        status: document.status,
        processingProgress: document.processingProgress
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed. Please ensure the file is a valid PDF document.' });
  }
};

// Get all documents
const getDocuments = async (req, res) => {
  try {
    // const { page = 1, limit = 10, category, search } = req.query; for testing
    const { page = 1, limit = 4, category, search } = req.query;
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

    const documents = await Document.find(query)
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Document.countDocuments(query);

    // Add isLiked status for each document if user is authenticated
    const userId = req.user?._id || req.user?.id;
    const documentsWithLikeStatus = documents.map(document => {
      const documentObj = document.toObject();
      if (userId && document.likedBy && Array.isArray(document.likedBy)) {
        documentObj.isLiked = document.likedBy.some(
          likeId => likeId && likeId.toString() === userId.toString()
        );
      } else {
        documentObj.isLiked = false;
      }
      return documentObj;
    });

    res.json({
      documents: documentsWithLikeStatus,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: 'Failed to fetch documents', error: error.message });
  }
};

// Get document by ID
const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findById(id)
      .populate('uploadedBy', 'username email');

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Add isLiked status if user is authenticated
    const userId = req.user?._id || req.user?.id;
    const documentObj = document.toObject();
    if (userId && document.likedBy && Array.isArray(document.likedBy)) {
      documentObj.isLiked = document.likedBy.some(
        likeId => likeId && likeId.toString() === userId.toString()
      );
    } else {
      documentObj.isLiked = false;
    }

    res.json({ document: documentObj });

  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ message: 'Failed to fetch document', error: error.message });
  }
};

// Track document view
const trackDocumentView = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId } = req.query; // Session ID to prevent duplicate tracking

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Check if view was already tracked in this session (prevent duplicate on refresh)
    // Note: This is a simple check. For production, consider using Redis or a ViewTracking collection
    // For now, we rely on frontend sessionStorage to prevent duplicate calls

    // Increment view count atomically
    const updated = await Document.findByIdAndUpdate(
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
        documentId: id,
        views: updated ? updated.views : document.views + 1
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

// Toggle document like
const toggleDocumentLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id; // Get user ID from auth middleware

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Initialize likedBy array if it doesn't exist
    if (!document.likedBy) {
      document.likedBy = [];
    }

    const isLiked = document.likedBy.some(
      likeId => likeId && likeId.toString() === userId.toString()
    );

    let newLikes;
    let isLikedAfter;

    if (req.body.action === 'unlike') {
      // Remove user from likedBy array
      document.likedBy = document.likedBy.filter(
        likeId => likeId && likeId.toString() !== userId.toString()
      );
      newLikes = Math.max(0, document.likes - 1);
      isLikedAfter = false;
    } else {
      // Add user to likedBy array if not already liked
      if (!isLiked) {
        document.likedBy.push(userId);
        newLikes = document.likes + 1;
      } else {
        // Already liked, don't increment
        newLikes = document.likes;
      }
      isLikedAfter = true;
    }

    await Document.findByIdAndUpdate(
      id,
      {
        $set: {
          likes: newLikes,
          likedBy: document.likedBy
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      message: req.body.action === 'unlike' ? 'Unliked' : 'Liked',
      data: {
        documentId: id,
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

// Serve document file
const getDocumentFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { download } = req.query;

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (!document.originalFile || !document.originalFile.filename) {
      return res.status(404).json({ message: 'Document file not found' });
    }

    const objectName = `documents/original/${document.originalFile.filename}`;

    // --- START MINIO CONVERSION ---
    // Handle document file serving via MinIO or local storage

    const exists = await storageService.fileExists(objectName);

    if (!exists) {
      // Fallback to local path (for documents already uploaded)
      const filePath = document.originalFile.path ? path.resolve(document.originalFile.path) : null;

      if (!filePath || !fsSync.existsSync(filePath)) {
        return res.status(404).json({ message: 'Document file not found' });
      }

      // Serve local file
      res.setHeader('Content-Type', 'application/pdf');
      if (download === 'true') {
        res.setHeader('Content-Disposition', `attachment; filename="${document.originalFile.filename}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${document.originalFile.filename}"`);
      }
      res.setHeader('Cache-Control', 'public, max-age=86400');
      // Track download only when explicitly requested
      if (download === 'true' && req.user) {
        const Download = require('../models/Download');
        Download.create({
          user: req.user.id || req.user._id,
          assetType: 'document',
          assetId: document._id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('user-agent'),
        }).catch(err => {
          console.error('Failed to track document download:', err);
        });
      }

      return res.sendFile(filePath);
    }

    // Serving from storage service (MinIO/Local abstraction)
    const stats = await storageService.getFileStats(objectName);
    const fileStream = await storageService.getFileStream(objectName);

    res.setHeader('Content-Type', 'application/pdf');
    if (download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFile.filename}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${document.originalFile.filename}"`);
    }
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Track download only when explicitly requested
    if (download === 'true' && req.user) {
      const Download = require('../models/Download');
      Download.create({
        user: req.user.id || req.user._id,
        assetType: 'document',
        assetId: document._id,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent'),
      }).catch(err => {
        console.error('Failed to track document download:', err);
      });
    }

    fileStream.pipe(res);
    // --- END MINIO CONVERSION ---

  } catch (error) {
    console.error('Get document file error:', error);
    res.status(500).json({ message: 'Failed to fetch document file', error: error.message });
  }
};


// Serve document thumbnail
const getDocumentThumbnail = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (!document.thumbnail) {
      return res.status(404).json({ message: 'Thumbnail not found' });
    }

    const objectName = `documents/thumbnails/${document.thumbnail.split('/').pop()}`;

    // --- START MINIO CONVERSION ---
    // Handle document thumbnail serving

    const exists = await storageService.fileExists(objectName);

    if (!exists) {
      // Fallback to local path
      const thumbnailPath = path.join(__dirname, '../../uploads', document.thumbnail);
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


// Get admin documents
const getAdminDocuments = async (req, res) => {
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

    const documents = await Document.find(query)
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Document.countDocuments(query);

    res.json({
      documents,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });

  } catch (error) {
    console.error('Get admin documents error:', error);
    res.status(500).json({ message: 'Failed to fetch documents', error: error.message });
  }
};

// Delete document
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Delete files
    const documentDir = path.join(__dirname, '../../uploads/documents/processed', id);
    if (fsSync.existsSync(documentDir)) {
      fsSync.rmSync(documentDir, { recursive: true, force: true });
    }

    if (document.originalFile?.path && fsSync.existsSync(document.originalFile.path)) {
      fsSync.unlinkSync(document.originalFile.path);
    }

    await Document.findByIdAndDelete(id);

    res.json({ message: 'Document deleted successfully' });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ message: 'Failed to delete document', error: error.message });
  }
};

// Update document
const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, tags, isPublic } = req.body;

    const update = {
      updatedAt: new Date(),
    };
    if (typeof title === 'string' && title.trim()) {
      if (title.trim().length > DOCUMENT_TITLE_MAX) {
        return res.status(400).json({ message: `Title must be ${DOCUMENT_TITLE_MAX} characters or fewer` });
      }

      update.title = await ensureUniqueTitle(Document, title.trim(), {
        excludeId: id,
        maxLength: DOCUMENT_TITLE_MAX,
      });
    }
    if (description !== undefined) {
      const trimmedDescription = String(description).trim();

      if (!trimmedDescription) {
        return res.status(400).json({ message: 'Description is required' });
      }

      if (trimmedDescription.length > DOCUMENT_DESCRIPTION_MAX) {
        return res.status(400).json({ message: `Description must be ${DOCUMENT_DESCRIPTION_MAX} characters or fewer` });
      }

      update.description = trimmedDescription;
    }
    if (category !== undefined) update.category = category;
    if (tags !== undefined) {
      const normalizedTags = parseDocumentTags(tags);

      if (normalizedTags.length > DOCUMENT_MAX_TAGS) {
        return res.status(400).json({ message: `You can add up to ${DOCUMENT_MAX_TAGS} tags only` });
      }

      update.tags = normalizedTags;
    }
    if (isPublic !== undefined) update.isPublic = isPublic;

    const document = await Document.findByIdAndUpdate(id, update, { new: true }).populate(
      'uploadedBy',
      'username email'
    );

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json({ document });

  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ message: 'Failed to update document', error: error.message });
  }
};

// Get document hash for manual verification
const getDocumentHash = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    if (!document.sha256Hash) {
      return res.status(404).json({
        success: false,
        message: 'Hash not available for this document. It may have been uploaded before hash calculation was implemented.'
      });
    }

    res.json({
      success: true,
      data: {
        documentId: document._id,
        title: document.title,
        sha256Hash: document.sha256Hash,
        uploadedAt: document.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting document hash:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get document hash',
      error: error.message
    });
  }
};

// Verify document integrity
const verifyDocumentIntegrity = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    if (!document.sha256Hash) {
      return res.status(400).json({
        success: false,
        message: 'Hash not available for this document. It may have been uploaded before hash calculation was implemented.',
        data: {
          documentId: document._id,
          title: document.title,
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
        message: 'Please provide either a document file or a hash string',
        data: {
          documentId: document._id,
          title: document.title
        }
      });
    }

    // Compare hashes
    const storedHash = document.sha256Hash.toLowerCase().trim();
    const matches = providedHash === storedHash;

    res.json({
      success: true,
      data: {
        documentId: document._id,
        title: document.title,
        verified: matches,
        providedHash: providedHash,
        storedHash: storedHash,
        message: matches
          ? 'Document integrity verified. The file matches the original.'
          : 'Document integrity check failed. The file does not match the original and may have been tampered with.',
        verifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error verifying document integrity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify document integrity',
      error: error.message
    });
  }
};

// Get users who liked a document
const getDocumentLikedByUsers = async (req, res) => {
  try {
    // Only admins are allowed to see who liked a document
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to view like details'
      });
    }

    const { id } = req.params;

    const document = await Document.findById(id)
      .populate({
        path: 'likedBy',
        select: 'username email profile',
        model: 'User'
      });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Filter out any null entries and format the response
    const likedByUsers = (document.likedBy || [])
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
        documentId: id,
        totalLikes: document.likes || likedByUsers.length,
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

module.exports = {
  uploadDocument,
  getDocuments,
  getDocumentById,
  getDocumentFile,
  getDocumentThumbnail,
  getAdminDocuments,
  deleteDocument,
  updateDocument,
  getDocumentHash,
  verifyDocumentIntegrity,
  trackDocumentView,
  toggleDocumentLike,
  getDocumentLikedByUsers
};
