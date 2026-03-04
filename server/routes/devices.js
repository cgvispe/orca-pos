const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('./auth');

// GET /api/devices — all active devices (cashiers need this for selector)
router.get('/', authMiddleware, (req, res) => {
  const devices = db.getActiveDevices().map(d => ({
    id: d.id, name: d.name, ip: d.ip, port: d.port,
    useHttps: d.useHttps, isDefault: d.isDefault, active: d.active
    // secretKey intentionally omitted
  }));
  res.json(devices);
});

// GET /api/devices/full — manager only (includes credentials for editing)
router.get('/full', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  res.json(db.getDevices());
});

// POST /api/devices — manager only
router.post('/', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const { name, ip, port, useHttps, posId, username, secretKey, isDefault } = req.body;
  if (!name || !ip || !posId || !username || !secretKey) {
    return res.status(400).json({ error: 'name, ip, posId, username, secretKey required' });
  }
  // If this is set as default, unset others
  if (isDefault) db.setDefaultDevice(null);
  const device = {
    id: uuidv4(), name, ip, port: port || '4443',
    useHttps: useHttps !== false, posId, username, secretKey,
    isDefault: !!isDefault, active: true
  };
  db.saveDevice(device);
  res.status(201).json({ ...device, secretKey: undefined });
});

// PUT /api/devices/:id — manager only
router.put('/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const device = db.getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const fields = {};
  const allowed = ['name', 'ip', 'port', 'useHttps', 'posId', 'username', 'secretKey', 'isDefault', 'active'];
  for (const k of allowed) {
    if (req.body[k] !== undefined) fields[k] = req.body[k];
  }

  // If setting as default, clear others first
  if (fields.isDefault) {
    db.setDefaultDevice(req.params.id);
    delete fields.isDefault;
  }

  db.updateDevice(req.params.id, fields);
  const updated = db.getDeviceById(req.params.id);
  res.json({ ...updated, secretKey: undefined });
});

// DELETE /api/devices/:id — manager only
router.delete('/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const device = db.getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  db.deleteDevice(req.params.id);
  res.json({ ok: true });
});

// PUT /api/devices/:id/set-default
router.put('/:id/set-default', authMiddleware, (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const device = db.getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  db.setDefaultDevice(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
