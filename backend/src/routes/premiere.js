const express = require('express');
const router = express.Router();
const {
  createPremiere,
  getActivePremiere,
  getPremiereById,
  getUpcomingPremieres,
  getAllPremieres,
  joinPremiere,
  endPremiere,
  updatePremiere,
  deletePremiere
} = require('../controllers/premiereController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public routes
router.get('/active', getActivePremiere);
router.get('/upcoming', getUpcomingPremieres);

// Protected routes
router.post('/join', authenticateToken, joinPremiere);

// Admin routes
router.post('/', authenticateToken, requireAdmin, createPremiere);
router.get('/', authenticateToken, requireAdmin, getAllPremieres);
router.get('/:id', authenticateToken, requireAdmin, getPremiereById);
router.put('/:id', authenticateToken, requireAdmin, updatePremiere);
router.delete('/:id', authenticateToken, requireAdmin, deletePremiere);
router.post('/:id/end', authenticateToken, requireAdmin, endPremiere);

module.exports = router;
