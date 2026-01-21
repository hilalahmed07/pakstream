const express = require('express');
const router = express.Router();
const {
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
  togglePresentationLike
} = require('../controllers/presentationController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/presentationUpload');
const { verificationUpload, handleUploadError } = require('../middleware/presentationUpload');

// Public routes
router.get('/', getPresentations);
router.get('/:id', getPresentationById);
router.get('/:id/slides', getPresentationSlides);
router.get('/:id/image/:slideNumber', getPresentationImage);
router.get('/:id/thumbnail', getPresentationThumbnail);
router.get('/:id/hash', getPresentationHash); // Get presentation hash for manual verification
router.post('/:id/verify', verificationUpload, handleUploadError, verifyPresentationIntegrity); // Verify presentation integrity (public endpoint)
router.post('/:id/view', trackPresentationView); // Track presentation view
router.post('/:id/like', togglePresentationLike); // Toggle presentation like

// Admin routes
router.post('/upload', authenticateToken, requireAdmin, upload.single('presentation'), uploadPresentation);
router.get('/admin/all', authenticateToken, requireAdmin, getAdminPresentations);
router.put('/:id', authenticateToken, requireAdmin, updatePresentation);
router.delete('/:id', authenticateToken, requireAdmin, deletePresentation);

module.exports = router;
