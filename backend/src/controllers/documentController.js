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

    res.json({
      documents,
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

    res.json({ document });

  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ message: 'Failed to fetch document', error: error.message });
  }
};

// Track document view
const trackDocumentView = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Increment view count atomically
    await Document.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: false }
    ).catch(err => {
      console.error('Failed to update view count:', err);
    });

    res.json({
      success: true,
      message: 'View tracked',
      data: {
        documentId: id,
        views: document.views + 1
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
    
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // For now, just increment/decrement likes (can be enhanced with user-specific likes later)
    const increment = req.body.action === 'unlike' ? -1 : 1;
    const newLikes = Math.max(0, document.likes + increment);

    await Document.findByIdAndUpdate(
      id,
      { $set: { likes: newLikes } },
      { new: true }
    );

    res.json({
      success: true,
      message: req.body.action === 'unlike' ? 'Unliked' : 'Liked',
      data: {
        documentId: id,
        likes: newLikes
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

    // Only accept hash string (no file uploads)
    if (!req.body.hash) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a hash string for verification',
        data: {
          documentId: document._id,
          title: document.title
        }
      });
    }

    // Hash string was provided
    const providedHash = req.body.hash.toLowerCase().trim();

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
  toggleDocumentLike
};

