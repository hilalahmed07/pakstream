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
  getPresentationLikedByUsers
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
// Download presentation file
router.get('/:id/download', optionalAuth, async (req, res) => {
  try {
    const { getPresentationById } = require('../controllers/presentationController');
    const presentation = await getPresentationById(req, res, true); // pass extra param to return data without sending JSON

    if (!presentation) return res.status(404).json({ message: 'Presentation not found' });

    // File path stored in presentation document
    const filePath = presentation.filePath; // e.g., uploads/presentations/abc123.pptx
    const fileName = `${presentation.title.replace(/\s/g, '_')}.pptx`;

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).send('Error downloading file');
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


module.exports = router;
