const Document = require('../models/Document');
const DocumentProcessor = require('../services/documentProcessor');
const { calculateFileHash } = require('../services/hashService');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const documentProcessor = new DocumentProcessor();

// Upload document
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title, description, category = 'other', tags = [] } = req.body;
    const userId = req.user.id;

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
      title,
      description,
      uploadedBy: userId,
      originalFile: {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      category,
      tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()),
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
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
};

// Get all documents
const getDocuments = async (req, res) => {
  try {
    const { page = 1, limit = 12, category, search } = req.query;
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

    if (!document.originalFile || !document.originalFile.path) {
      return res.status(404).json({ message: 'Document file not found' });
    }

    const filePath = path.resolve(document.originalFile.path);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Set headers for PDF viewing or downloading
    res.setHeader('Content-Type', 'application/pdf');
    
    // If download=true, force download; otherwise display inline (for iframe)
    if (download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFile.filename}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${document.originalFile.filename}"`);
    }
    
    res.setHeader('Cache-Control', 'public, max-age=86400');

    res.sendFile(filePath);

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

    const thumbnailPath = path.join(__dirname, '../../uploads', document.thumbnail);
    
    if (!fsSync.existsSync(thumbnailPath)) {
      return res.status(404).json({ message: 'Thumbnail file not found' });
    }

    res.sendFile(path.resolve(thumbnailPath));

  } catch (error) {
    console.error('Get thumbnail error:', error);
    res.status(500).json({ message: 'Failed to fetch thumbnail', error: error.message });
  }
};

// Get admin documents
const getAdminDocuments = async (req, res) => {
  try {
    const documents = await Document.find()
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 });

    res.json({ documents });

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
    
    const document = await Document.findByIdAndUpdate(
      id,
      { 
        title, 
        description, 
        category, 
        tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()),
        isPublic,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('uploadedBy', 'username email');

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

