const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('./auth');

router.get('/', (req, res) => res.json(db.getCategories()));

router.post('/', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const clean = name.trim();
  if (db.getCategories().includes(clean)) return res.status(409).json({ error: 'Category already exists' });
  db.addCategory(clean);
  res.status(201).json(db.getCategories());
});

router.delete('/:name', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  db.deleteCategory(decodeURIComponent(req.params.name));
  res.json(db.getCategories());
});

module.exports = router;
