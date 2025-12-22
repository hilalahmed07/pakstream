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
  toggleDocumentLike
} = require('../controllers/documentController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/documentUpload');
const { verificationUpload } = require('../middleware/documentUpload');

// Public routes
router.get('/', getDocuments);
router.get('/:id', getDocumentById);
router.get('/:id/file', getDocumentFile);
router.get('/:id/thumbnail', getDocumentThumbnail);
router.get('/:id/hash', getDocumentHash); // Get document hash for manual verification
router.post('/:id/verify', verificationUpload, verifyDocumentIntegrity); // Verify document integrity (public endpoint)
router.post('/:id/view', trackDocumentView); // Track document view
router.post('/:id/like', toggleDocumentLike); // Toggle document like

// Admin routes
router.post('/upload', authenticateToken, requireAdmin, upload.single('document'), uploadDocument);
router.get('/admin/all', authenticateToken, requireAdmin, getAdminDocuments);
router.put('/:id', authenticateToken, requireAdmin, updateDocument);
router.delete('/:id', authenticateToken, requireAdmin, deleteDocument);

module.exports = router;

