const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const analytics = require('../controllers/analyticsController');

router.use(auth);
router.get('/', analytics.getData);
router.get('/:id', analytics.getData);

module.exports = router;
