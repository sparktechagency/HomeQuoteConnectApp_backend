const express = require('express');
const router = express.Router();

// Simple health check
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

module.exports = router;
