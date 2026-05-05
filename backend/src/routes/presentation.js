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
  togglePresentationLike,
  getPresentationLikedByUsers,
  downloadPresentation
} = require('../controllers/presentationController');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/presentationUpload');
const { verificationUpload, handleUploadError } = require('../middleware/presentationUpload');

// Public routes (with optional auth to get user like status)
router.get('/', optionalAuth, getPresentations);
router.get('/:id', optionalAuth, getPresentationById);
router.get('/:id/slides', getPresentationSlides);
router.get('/:id/image/:slideNumber', getPresentationImage);
router.get('/:id/thumbnail', getPresentationThumbnail);
router.get('/:id/hash', getPresentationHash); // Get presentation hash for manual verification
// Only admins can see who liked a presentation
router.get('/:id/likedby', authenticateToken, requireAdmin, getPresentationLikedByUsers);
router.post('/:id/verify', verificationUpload, handleUploadError, verifyPresentationIntegrity); // Verify presentation integrity (public endpoint)
router.post('/:id/view', trackPresentationView); // Track presentation view
router.post('/:id/like', authenticateToken, togglePresentationLike); // Toggle presentation like (requires auth)

// Admin routes
router.post('/upload', authenticateToken, requireAdmin, upload.single('presentation'), handleUploadError, uploadPresentation);
router.get('/admin/all', authenticateToken, requireAdmin, getAdminPresentations);
router.put('/:id', authenticateToken, requireAdmin, updatePresentation);
router.delete('/:id', authenticateToken, requireAdmin, deletePresentation);
router.get('/:id/download', authenticateToken, downloadPresentation);

module.exports = router;
