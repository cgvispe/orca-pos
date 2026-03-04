const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('./auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/items — public
router.get('/', (req, res) => res.json(db.getItems()));

// GET /api/items/all — manager only (includes inactive)
router.get('/all', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  res.json(db.getAllItems());
});

// POST /api/items — manager only
router.post('/', authMiddleware, upload.single('image'), (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const { code, name, price, category, emoji } = req.body;
  if (!code || !name || !price) return res.status(400).json({ error: 'code, name, price required' });

  const item = {
    id: uuidv4(), code, name, price: parseFloat(price),
    category: category || 'General',
    imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
    emoji: emoji || '🛍️', active: true
  };
  db.saveItem(item);
  res.status(201).json(item);
});

// PUT /api/items/:id — manager only
router.put('/:id', authMiddleware, upload.single('image'), (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const item = db.getItemById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { code, name, price, category, emoji, active, clearImage } = req.body;
  const fields = {};
  if (code     !== undefined) fields.code     = code;
  if (name     !== undefined) fields.name     = name;
  if (price    !== undefined) fields.price    = parseFloat(price);
  if (category !== undefined) fields.category = category;
  if (emoji    !== undefined) fields.emoji    = emoji;
  if (active   !== undefined) fields.active   = active === 'true' || active === true;
  if (req.file)               fields.imageUrl = `/uploads/${req.file.filename}`;
  if (clearImage === 'true')  fields.imageUrl = null;

  db.updateItem(req.params.id, fields);
  res.json(db.getItemById(req.params.id));
});

// DELETE /api/items/:id — soft delete
router.delete('/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const item = db.getItemById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  db.updateItem(req.params.id, { active: false });
  res.json({ ok: true });
});

module.exports = router;
