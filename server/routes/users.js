const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('./auth');

const guard = (req, res) => req.user.role !== 'manager' && res.status(403).json({ error: 'Forbidden' });

router.get('/', authMiddleware, (req, res) => {
  if (guard(req, res)) return;
  res.json(db.getUsers().filter(u => u.role === 'cashier').map(u => ({
    id: u.id, name: u.name, username: u.username, role: u.role, canRefund: !!u.canRefund
  })));
});

router.post('/', authMiddleware, async (req, res) => {
  if (guard(req, res)) return;
  const { name, username, password, canRefund } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'name, username, password required' });
  if (db.getUserByUsername(username)) return res.status(409).json({ error: 'Username already exists' });
  const user = { id: uuidv4(), name, username, password: await bcrypt.hash(password, 10), role: 'cashier', canRefund: canRefund ? 1 : 0 };
  db.saveUser(user);
  res.status(201).json({ id: user.id, name: user.name, username: user.username, role: user.role, canRefund: !!canRefund });
});

router.put('/:id', authMiddleware, async (req, res) => {
  if (guard(req, res)) return;
  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'manager') return res.status(403).json({ error: 'Cannot edit manager accounts' });
  const fields = {};
  if (req.body.name) fields.name = req.body.name;
  if (req.body.password) fields.password = await bcrypt.hash(req.body.password, 10);
  if (req.body.canRefund !== undefined) fields.can_refund = req.body.canRefund ? 1 : 0;
  db.updateUser(req.params.id, fields);
  const updated = db.getUserById(req.params.id);
  res.json({ id: updated.id, name: updated.name, username: updated.username, role: updated.role, canRefund: !!updated.canRefund });
});

router.delete('/:id', authMiddleware, (req, res) => {
  if (guard(req, res)) return;
  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'manager') return res.status(403).json({ error: 'Cannot delete manager accounts' });
  db.deleteUser(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
