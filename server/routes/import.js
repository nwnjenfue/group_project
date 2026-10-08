const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const controller = require('../controllers/importController');

const uploadDir = path.join(__dirname, '../../tmp/uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname);
    cb(ok ? null : new Error('Разрешены только XLSX/XLS'), ok);
  }
});

const router = express.Router();
router.use(auth, adminAuth);
router.post('/analyze', upload.single('file'), controller.analyze);
router.post('/auto', upload.single('file'), controller.autoImport);
// Старые URL оставлены совместимыми, но теперь используют единый автоопределитель.
router.post('/svodnaya', upload.single('file'), controller.autoImport);
router.post('/otchety_full', upload.single('file'), controller.autoImport);
router.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Файл слишком большой. Максимальный размер — 25 МБ.' });
  if (error instanceof multer.MulterError || error.message === 'Разрешены только XLSX/XLS') return res.status(400).json({ message: error.message });
  next(error);
});

module.exports = router;
