const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('./auth');

const logoStorage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `logo-${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage: logoStorage, limits: { fileSize: 2 * 1024 * 1024 } });

// GET /api/settings — public (theme + business info needed for all users)
router.get('/', (req, res) => res.json(db.getSettings()));

// PUT /api/settings — manager only
router.put('/', authMiddleware, upload.single('logo'), (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });

  let body;
  try { body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body; }
  catch { body = req.body; }

  const current = db.getSettings();
  const updated = {
    ...current, ...body,
    theme: { ...current.theme, ...(body.theme || {}) }
  };
  if (req.file) updated.theme.logoUrl = `/uploads/${req.file.filename}`;
  if (body.clearLogo === 'true') updated.theme.logoUrl = '';

  db.saveSettings(updated);
  res.json(db.getSettings());
});

module.exports = router;
