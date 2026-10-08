const fs = require('fs');
const path = require('path');
const { analyzeFile, importFile } = require('../services/importService');

function safeRemove(file) { try { if (file) fs.unlinkSync(file); } catch (_) {} }

exports.analyze = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Файл не загружен' });
  try {
    const result = await analyzeFile(req.file.path, req.file.originalname);
    res.json(result);
  } catch (error) {
    res.status(422).json({ message: error.message });
  } finally { safeRemove(req.file.path); }
};

exports.autoImport = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Файл не загружен' });
  try {
    const result = await importFile({ filePath: req.file.path, originalFilename: req.file.originalname, userId: req.user.id, ip: req.ip, period: req.body.period, territory: req.body.territory });
    res.status(201).json({ message: 'Данные загружены и классифицированы автоматически', ...result });
  } catch (error) {
    console.error('[import]', error);
    res.status(422).json({ message: error.message });
  } finally { safeRemove(req.file.path); }
};
