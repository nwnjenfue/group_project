const express = require('express');
const auth = require('../middleware/auth');
const analytics = require('../controllers/analyticsController');
const pdfController = require('../controllers/pdfController');

const router = express.Router();

router.use(auth);

router.get('/data', analytics.getData);
router.get('/analytics/overview', analytics.overview);
router.get('/analytics/scenarios', analytics.scenarios);
router.get('/analytics/alerts', analytics.alerts);
router.get('/analytics/imports', analytics.imports);
router.get('/related-data/:activity', analytics.relatedActivity);
router.get('/companies/:bin', analytics.companyProfile);

router.get('/search', analytics.getData);

router.get('/pdf/generate', pdfController.generatePdf);
router.get('/pdf/generate/:id', pdfController.generateDetailPdf);
router.post('/pdf/generate/selected', pdfController.generateSelectedPdf);
router.get('/export/excel', pdfController.generateExcel);

module.exports = router;
