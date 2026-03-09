const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/patchController');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { upload, verificationUpload, handleUploadError } = require('../middleware/patchUpload');

// Public routes (with optional auth)
router.get('/', optionalAuth, getPatches);
router.get('/:id', optionalAuth, getPatchById);
router.get('/:id/file', getPatchFile);
router.get('/:id/hash', getPatchHash); // Get patch hash for manual verification
router.post('/:id/verify', verificationUpload, handleUploadError, verifyPatchIntegrity); // Verify patch integrity (public endpoint)
router.post('/:id/download', optionalAuth, trackPatchDownload); // Track patch download
router.post('/:id/view', trackPatchView); // Track patch view
router.post('/:id/like', authenticateToken, togglePatchLike); // Toggle patch like
// Only admins can see who liked a patch
router.get('/:id/likedby', authenticateToken, requireAdmin, getPatchLikedByUsers);

// Admin routes
router.post('/upload', authenticateToken, requireAdmin, upload, handleUploadError, uploadPatch);
router.get('/admin/all', authenticateToken, requireAdmin, getAdminPatches);
router.put('/:id', authenticateToken, requireAdmin, updatePatch);
router.delete('/:id', authenticateToken, requireAdmin, deletePatch);

module.exports = router;
