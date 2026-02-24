const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/documentController');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/documentUpload');
const { verificationUpload, handleUploadError } = require('../middleware/documentUpload');

// Public routes (with optional auth to get user like status)
router.get('/', optionalAuth, getDocuments);
router.get('/:id', optionalAuth, getDocumentById);
router.get('/:id/file', getDocumentFile);
router.get('/:id/thumbnail', getDocumentThumbnail);
router.get('/:id/hash', getDocumentHash); // Get document hash for manual verification
// Only admins can see who liked a document
router.get('/:id/likedby', authenticateToken, requireAdmin, getDocumentLikedByUsers);
router.post('/:id/verify', verificationUpload, handleUploadError, verifyDocumentIntegrity); // Verify document integrity (public endpoint)
router.post('/:id/view', trackDocumentView); // Track document view
router.post('/:id/like', authenticateToken, toggleDocumentLike); // Toggle document like (requires auth)

// Admin routes
router.post('/upload', authenticateToken, requireAdmin, upload.single('document'), handleUploadError, uploadDocument);
router.get('/admin/all', authenticateToken, requireAdmin, getAdminDocuments);
router.put('/:id', authenticateToken, requireAdmin, updateDocument);
router.delete('/:id', authenticateToken, requireAdmin, deleteDocument);

module.exports = router;

