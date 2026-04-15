const Patch = require('../models/Patch');
const Download = require('../models/Download');
const { calculateFileHash } = require('../services/hashService');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Upload patch
const uploadPatch = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const {
      title,
      description,
      category = 'other',
      tags = [],
      patchType = 'other',
      version,
      targetOs = ['all'],
      architecture = 'x64'
    } = req.body;
    const userId = req.user.id;

    // Calculate SHA-256 hash of the uploaded file
    let sha256Hash = null;
    try {
      sha256Hash = await calculateFileHash(req.file.path);
      console.log(`Calculated SHA-256 hash for patch: ${sha256Hash.substring(0, 16)}...`);
    } catch (hashError) {
      console.error('Error calculating file hash:', hashError);
      // Don't fail upload if hash calculation fails, but log the error
    }

    // Process targetOs and architecture
    let processedTargetOs = [];
    if (targetOs) {
      if (Array.isArray(targetOs)) {
        processedTargetOs = targetOs.map(os => os.trim().toLowerCase());
      } else if (typeof targetOs === 'string') {
        processedTargetOs = targetOs.split(',').map(os => os.trim().toLowerCase());
      }
    }
    if (processedTargetOs.length === 0) {
      processedTargetOs = ['all'];
    }

    const processedArchitecture = (architecture || 'x64').toLowerCase();

    // Determine file type from extension
    const ext = path.extname(req.file.originalname).toLowerCase().substring(1);
    const fileType = ext;

    // Create patch record
    const patch = new Patch({
      title,
      description,
      uploadedBy: userId,
      originalFile: {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      fileType,
      patchType,
      version,
      targetOs: processedTargetOs,
      architecture: processedArchitecture,
      category,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : []),
      sha256Hash: sha256Hash,
      status: 'ready', // Patches don't need processing like documents
      processingProgress: 100
    });

    await patch.save();

    res.status(201).json({
      message: 'Patch uploaded successfully',
      patch: {
        id: patch._id,
        title: patch.title,
        status: patch.status,
        fileType: patch.fileType
      }
    });

  } catch (error) {
    console.error('Upload error:', error);

    // Check if it's a Mongoose validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: messages
      });
    }

    res.status(500).json({
      message: error.message || 'Upload failed',
      error: error.message
    });
  }
};

// Get all patches
const getPatches = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search, fileType, patchType, targetOs, architecture } = req.query;
    const skip = (page - 1) * limit;

    let query = { status: 'ready', isPublic: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (fileType && fileType !== 'all') {
      query.fileType = fileType;
    }

    if (patchType && patchType !== 'all') {
      query.patchType = patchType;
    }

    if (targetOs && targetOs !== 'all') {
      query.targetOs = targetOs;
    }

    if (architecture && architecture !== 'all') {
      query.architecture = architecture;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { version: { $regex: search, $options: 'i' } }
      ];
    }

    const patches = await Patch.find(query)
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Patch.countDocuments(query);

    // Add isLiked status for each patch if user is authenticated
    const userId = req.user?._id || req.user?.id;
    const patchesWithLikeStatus = patches.map(patch => {
      const patchObj = patch.toObject();
      if (userId && patch.likedBy && Array.isArray(patch.likedBy)) {
        patchObj.isLiked = patch.likedBy.some(
          likeId => likeId && likeId.toString() === userId.toString()
        );
      } else {
        patchObj.isLiked = false;
      }
      return patchObj;
    });

    res.json({
      patches: patchesWithLikeStatus,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get patches error:', error);
    res.status(500).json({ message: 'Failed to fetch patches', error: error.message });
  }
};

// Get patch by ID
const getPatchById = async (req, res) => {
  try {
    const { id } = req.params;

    const patch = await Patch.findById(id)
      .populate('uploadedBy', 'username email');

    if (!patch) {
      return res.status(404).json({ message: 'Patch not found' });
    }

    // Add isLiked status if user is authenticated
    const userId = req.user?._id || req.user?.id;
    const patchObj = patch.toObject();
    if (userId && patch.likedBy && Array.isArray(patch.likedBy)) {
      patchObj.isLiked = patch.likedBy.some(
        likeId => likeId && likeId.toString() === userId.toString()
      );
    } else {
      patchObj.isLiked = false;
    }

    res.json({ patch: patchObj });

  } catch (error) {
    console.error('Get patch error:', error);
    res.status(500).json({ message: 'Failed to fetch patch', error: error.message });
  }
};

/** Patch counter + unified Download row (when req.user). Used by POST track and GET file?download=true */
const recordPatchDownloadActivity = async (req, patch) => {
  const updated = await Patch.findByIdAndUpdate(
    patch._id,
    { $inc: { downloads: 1 } },
    { new: true }
  ).catch((err) => {
    console.error('Failed to update patch download count:', err);
    return null;
  });

  if (req.user) {
    Download.create({
      user: req.user.id || req.user._id,
      assetType: 'patch',
      assetId: patch._id,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    }).catch((err) => {
      console.error('Failed to track patch download:', err);
    });
  }

  return updated;
};

// Track patch download (legacy POST; primary path is GET /file?download=true with optionalAuth)
const trackPatchDownload = async (req, res) => {
  try {
    const { id } = req.params;

    const patch = await Patch.findById(id);
    if (!patch) {
      return res.status(404).json({ success: false, message: 'Patch not found' });
    }

    const updated = await recordPatchDownloadActivity(req, patch);

    res.json({
      success: true,
      message: 'Download tracked',
      data: {
        patchId: id,
        downloads: updated ? updated.downloads : patch.downloads + 1
      }
    });
  } catch (error) {
    console.error('Download tracking error:', error);
    res.status(200).json({
      success: true,
      message: 'Download tracking attempted'
    });
  }
};

// Serve patch file
const getPatchFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { download } = req.query;

    const patch = await Patch.findById(id);

    if (!patch) {
      return res.status(404).json({ message: 'Patch not found' });
    }

    if (!patch.originalFile || !patch.originalFile.path) {
      return res.status(404).json({ message: 'Patch file not found' });
    }

    const filePath = path.resolve(patch.originalFile.path);

    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (String(download) === 'true') {
      await recordPatchDownloadActivity(req, patch);
    }

    // Set appropriate content type based on file type
    let contentType = 'application/octet-stream';
    switch (patch.fileType) {
      case 'exe':
        contentType = 'application/x-msdownload';
        break;
      case 'msi':
        contentType = 'application/x-msi';
        break;
      case 'msu':
        contentType = 'application/x-msu-update';
        break;
      case 'cab':
        contentType = 'application/vnd.ms-cab-compressed';
        break;
      case 'def':
        contentType = 'text/plain';
        break;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${patch.originalFile.filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    res.sendFile(filePath);

  } catch (error) {
    console.error('Get patch file error:', error);
    res.status(500).json({ message: 'Failed to fetch patch file', error: error.message });
  }
};

// Get admin patches
const getAdminPatches = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const patches = await Patch.find()
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Patch.countDocuments();

    res.json({
      patches,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });

  } catch (error) {
    console.error('Get admin patches error:', error);
    res.status(500).json({ message: 'Failed to fetch patches', error: error.message });
  }
};

// Delete patch
const deletePatch = async (req, res) => {
  try {
    const { id } = req.params;

    const patch = await Patch.findById(id);

    if (!patch) {
      return res.status(404).json({ message: 'Patch not found' });
    }

    // Delete file
    if (patch.originalFile?.path && fsSync.existsSync(patch.originalFile.path)) {
      fsSync.unlinkSync(patch.originalFile.path);
    }

    await Patch.findByIdAndDelete(id);

    res.json({ message: 'Patch deleted successfully' });

  } catch (error) {
    console.error('Delete patch error:', error);
    res.status(500).json({ message: 'Failed to delete patch', error: error.message });
  }
};

// Update patch
const updatePatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, tags, isPublic, patchType, version, targetOs, architecture } = req.body;

    const patch = await Patch.findByIdAndUpdate(
      id,
      {
        title,
        description,
        category,
        tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()),
        isPublic,
        patchType,
        version,
        targetOs: Array.isArray(targetOs) ? targetOs : targetOs.split(',').map(os => os.trim()),
        architecture,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('uploadedBy', 'username email');

    if (!patch) {
      return res.status(404).json({ message: 'Patch not found' });
    }

    res.json({ patch });

  } catch (error) {
    console.error('Update patch error:', error);
    res.status(500).json({ message: 'Failed to update patch', error: error.message });
  }
};

// Get patch hash for manual verification
const getPatchHash = async (req, res) => {
  try {
    const patch = await Patch.findById(req.params.id);

    if (!patch) {
      return res.status(404).json({
        success: false,
        message: 'Patch not found'
      });
    }

    if (!patch.sha256Hash) {
      return res.status(404).json({
        success: false,
        message: 'Hash not available for this patch. It may have been uploaded before hash calculation was implemented.'
      });
    }

    res.json({
      success: true,
      data: {
        patchId: patch._id,
        title: patch.title,
        sha256Hash: patch.sha256Hash,
        uploadedAt: patch.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting patch hash:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get patch hash',
      error: error.message
    });
  }
};

// Verify patch integrity
const verifyPatchIntegrity = async (req, res) => {
  try {
    const patch = await Patch.findById(req.params.id);

    if (!patch) {
      return res.status(404).json({
        success: false,
        message: 'Patch not found'
      });
    }

    if (!patch.sha256Hash) {
      return res.status(400).json({
        success: false,
        message: 'Hash not available for this patch. It may have been uploaded before hash calculation was implemented.',
        data: {
          patchId: patch._id,
          title: patch.title,
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
        message: 'Please provide either a patch file or a hash string',
        data: {
          patchId: patch._id,
          title: patch.title
        }
      });
    }

    // Compare hashes
    const storedHash = patch.sha256Hash.toLowerCase().trim();
    const matches = providedHash === storedHash;

    res.json({
      success: true,
      data: {
        patchId: patch._id,
        title: patch.title,
        verified: matches,
        providedHash: providedHash,
        storedHash: storedHash,
        message: matches
          ? 'Patch integrity verified. The file matches the original.'
          : 'Patch integrity check failed. The file does not match the original and may have been tampered with.',
        verifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error verifying patch integrity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify patch integrity',
      error: error.message
    });
  }
};

// Track patch view
const trackPatchView = async (req, res) => {
  try {
    const { id } = req.params;

    const patch = await Patch.findById(id);
    if (!patch) {
      return res.status(404).json({ success: false, message: 'Patch not found' });
    }

    // Increment view count atomically
    const updated = await Patch.findByIdAndUpdate(
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
        patchId: id,
        views: updated ? updated.views : patch.views + 1
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

// Toggle patch like
const togglePatchLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const patch = await Patch.findById(id);
    if (!patch) {
      return res.status(404).json({ success: false, message: 'Patch not found' });
    }

    if (!patch.likedBy) {
      patch.likedBy = [];
    }

    const isLiked = patch.likedBy.some(
      likeId => likeId && likeId.toString() === userId.toString()
    );

    let newLikes;
    let isLikedAfter;

    if (req.body.action === 'unlike') {
      if (userId) {
        patch.likedBy = patch.likedBy.filter(
          likeId => likeId.toString() !== userId.toString()
        );
      }
      newLikes = Math.max(0, patch.likes - 1);
      isLikedAfter = false;
    } else {
      if (userId && !isLiked) {
        patch.likedBy.push(userId);
      }
      if (!isLiked) {
        newLikes = patch.likes + 1;
      } else {
        newLikes = patch.likes;
      }
      isLikedAfter = true;
    }

    await Patch.findByIdAndUpdate(
      id,
      {
        $set: {
          likes: newLikes,
          likedBy: patch.likedBy
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      message: req.body.action === 'unlike' ? 'Unliked' : 'Liked',
      data: {
        patchId: id,
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

// Get users who liked a patch
const getPatchLikedByUsers = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to view like details'
      });
    }

    const { id } = req.params;

    const patch = await Patch.findById(id)
      .populate({
        path: 'likedBy',
        select: 'username email profile',
        model: 'User'
      });

    if (!patch) {
      return res.status(404).json({
        success: false,
        message: 'Patch not found'
      });
    }

    const likedByUsers = (patch.likedBy || [])
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
        patchId: id,
        totalLikes: patch.likes || likedByUsers.length,
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
  uploadPatch,
  getPatches,
  getPatchById,
  getPatchFile,
  getAdminPatches,
  deletePatch,
  updatePatch,
  getPatchHash,
  verifyPatchIntegrity,
  trackPatchDownload,
  trackPatchView,
  togglePatchLike,
  getPatchLikedByUsers
};
