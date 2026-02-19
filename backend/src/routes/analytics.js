const express = require('express');
const router = express.Router();
const { getSummary } = require('../controllers/analyticsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/summary', getSummary);

module.exports = router;
