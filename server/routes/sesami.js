const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const sesami = require('../sesami/client');
const db = require('../db');
const { authMiddleware } = require('./auth');

// POST /api/sesami/test-connection — test with form values without saving
router.post('/test-connection', async (req, res) => {
  const { ip, port, useHttps } = req.body;
  if (!ip || !port) return res.status(400).json({ error: 'ip and port required' });
  const protocol = useHttps ? 'https' : 'http';
  const url = `${protocol}://${ip}:${port}/api/pos/v3/heartbeat`;
  console.log('[RC5000] test-connection →', url);
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      validateStatus: null
    });
    if (response.status === 200) return res.json({ ok: true, data: response.data });
    res.status(502).json({ error: `Device returned HTTP ${response.status}`, detail: response.data });
  } catch (err) {
    console.error('[RC5000] test-connection error:', err.message);
    res.status(503).json({ error: err.message, code: err.code });
  }
});

// GET /api/sesami/heartbeat/:deviceId
router.get('/heartbeat/:deviceId', async (req, res) => {
  try {
    res.json(await sesami.getHeartbeat(req.params.deviceId));
  } catch (err) {
    console.error('[RC5000 heartbeat]', err.message);
    res.status(503).json({ error: err.message, code: err.code });
  }
});

// GET /api/sesami/status/:deviceId
router.get('/status/:deviceId', async (req, res) => {
  try {
    res.json(await sesami.getStatus(req.params.deviceId));
  } catch (err) {
    // Suppress noisy logs for unconfigured devices
    res.status(503).json({ error: err.message, code: err.code });
  }
});

// POST /api/sesami/payin — { deviceId, amount, cartItems, cartTotal }
router.post('/payin', authMiddleware, async (req, res) => {
  const { deviceId, amount, cartItems, cartTotal } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  try {
    const amountCents = Math.round(amount * 100);
    const result = await sesami.startPayinAmount(deviceId, amountCents);
    if (result.result !== 0) {
      await sesami.logout(deviceId);
      return res.status(409).json({ error: 'Could not start operation. Device may be busy.', result });
    }
    res.json({ operationId: result.operationId, amountCents, sessionStarted: true });
  } catch (err) {
    console.error('[RC5000 payin error]', err.message, err.stack?.split('\n')[1]);
    try { await sesami.logout(deviceId); } catch {}
    res.status(503).json({ error: 'RC5000 error', detail: err.message });
  }
});

// GET /api/sesami/operation/:deviceId/:operationId
router.get('/operation/:deviceId/:operationId', authMiddleware, async (req, res) => {
  const { deviceId, operationId } = req.params;
  try {
    const data = await sesami.getOperationStatus(deviceId, operationId);
    let totalIn = 0, totalOut = 0;
    if (data.currencies?.length > 0) {
      const currency = data.currencies[0];
      if (currency.totals) {
        totalIn  = (currency.totals.totalIN  || 0) / 100;
        totalOut = (currency.totals.totalOUT || 0) / 100;
      }
    }
    res.json({ ...data, totalIn, totalOut });
  } catch (err) {
    res.status(503).json({ error: 'RC5000 error', detail: err.message });
  }
});

// POST /api/sesami/operation/finish
router.post('/operation/finish', authMiddleware, async (req, res) => {
  const { deviceId, operationId, cartItems, cartTotal, amountReceived, change } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  try {
    const finishResult = await sesami.finishOperation(deviceId);
    await sesami.logout(deviceId);

    const device = db.getDeviceById(deviceId);
    const settings = db.getSettings();
    const tx = {
      id: uuidv4(), date: new Date().toISOString(),
      cashierId:   req.user.id,
      cashierName: req.user.name,
      deviceId,
      deviceName:  device?.name || deviceId,
      total:          cartTotal || 0,
      currency:       settings.currency || 'EUR',
      status:         'completed',
      operationType:  10,
      isManual:       false,
      rcStatus:       finishResult?.status || 4,
      totalIn:        amountReceived || cartTotal || 0,
      totalOut:       change || 0,
      amountReceived: amountReceived || cartTotal || 0,
      change:         change || 0,
      items:          cartItems || []
    };
    db.saveTransaction(tx);
    res.json({ ok: true, transaction: tx, finishResult });
  } catch (err) {
    try { await sesami.logout(deviceId); } catch {}
    res.status(503).json({ error: 'RC5000 error', detail: err.message });
  }
});

// POST /api/sesami/operation/cancel
router.post('/operation/cancel', authMiddleware, async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  try {
    const result = await sesami.cancelOperation(deviceId);
    await sesami.logout(deviceId);
    res.json({ ok: true, result });
  } catch (err) {
    try { await sesami.logout(deviceId); } catch {}
    res.status(503).json({ error: 'RC5000 error', detail: err.message });
  }
});

// POST /api/sesami/logout — force logout for a specific device
router.post('/logout', authMiddleware, async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  try {
    await sesami.logout(deviceId);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: true, warning: err.message });
  }
});

// POST /api/sesami/force-reset/:deviceId — manager-only emergency reset
// Accepts an optional bearerToken to authenticate cancel+logout, then clears persisted session
router.post('/force-reset/:deviceId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Managers only' });
  const { deviceId } = req.params;
  const { bearerToken } = req.body;
  const device = db.getDeviceById(deviceId);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const results = {};
  if (bearerToken) {
    const axios = require('axios');
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const baseURL = `${device.useHttps ? 'https' : 'http'}://${device.ip}:${device.port}/api/pos/v3`;
    const client = axios.create({ baseURL, timeout: 5000, httpsAgent: agent, validateStatus: null,
      headers: { Authorization: `Bearer ${bearerToken}` }
    });
    try { const r = await client.post('/operations/cancel'); results.cancel = r.status; } catch (e) { results.cancel = e.message; }
    try { const r = await client.post('/operations/finish'); results.finish = r.status; } catch (e) { results.finish = e.message; }
    try { const r = await client.post('/logout');            results.logout = r.status; } catch (e) { results.logout = e.message; }
  }

  // Always clear the persisted session regardless
  db.clearDeviceSession(deviceId);
  sesami.sessions.delete(deviceId);
  results.sessionCleared = true;

  console.log(`[RC5000 force-reset] device ${device.name}:`, results);
  res.json({ ok: true, results });
});

// POST /api/sesami/payout — start a payout/refund operation
router.post('/payout', authMiddleware, async (req, res) => {
  const { deviceId, amount } = req.body
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' })
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' })
  try {
    const amountCents = Math.round(amount * 100)
    const result = await sesami.startPayoutAmount(deviceId, amountCents)
    if (result.result !== 0) {
      await sesami.logout(deviceId)
      return res.status(409).json({ error: 'Could not start payout. Device may be busy.', result })
    }
    res.json({ operationId: result.operationId, amountCents, sessionStarted: true })
  } catch (err) {
    console.error('[RC5000 payout error]', err.message, err.stack?.split('\n')[1])
    try { await sesami.logout(deviceId) } catch {}
    res.status(503).json({ error: 'RC5000 error', detail: err.message })
  }
})

// POST /api/sesami/operation/finish-refund — finalize refund (with or without RC5000)
router.post('/operation/finish-refund', authMiddleware, async (req, res) => {
  const { deviceId, operationId, cartItems, cartTotal, amountDispensed, reason, manual } = req.body
  const settings = db.getSettings()
  const device = deviceId ? db.getDeviceById(deviceId) : null

  try {
    if (!manual && deviceId && operationId) {
      await sesami.finishOperation(deviceId)
      await sesami.logout(deviceId)
    }
  } catch (err) {
    console.warn('[RC5000 finish-refund]', err.message)
  }

  const tx = {
    id: uuidv4(), date: new Date().toISOString(),
    cashierId:      req.user.id,
    cashierName:    req.user.name,
    deviceId:       deviceId || null,
    deviceName:     device?.name || (manual ? 'Manual' : 'RC5000'),
    total:          -(Math.abs(cartTotal || 0)),
    amountReceived: -(Math.abs(amountDispensed || cartTotal || 0)),
    change:         0,
    totalIn:        0,
    totalOut:       Math.abs(amountDispensed || cartTotal || 0),
    currency:       settings.currency || 'EUR',
    status:         'refund',
    operationType:  5,
    isManual:       !!manual,
    rcStatus:       manual ? null : 4,
    items:          (cartItems || []).map(i => ({ ...i, price: -Math.abs(i.price) })),
    reason:         reason || ''
  }
  db.saveTransaction(tx)
  res.json({ ok: true, transaction: tx })
})

// POST /api/sesami/operation/finish-manual — manual payment (no RC5000)
router.post('/operation/finish-manual', authMiddleware, async (req, res) => {
  const { cartItems, cartTotal } = req.body
  const settings = db.getSettings()
  const tx = {
    id: uuidv4(), date: new Date().toISOString(),
    cashierId:      req.user.id,
    cashierName:    req.user.name,
    deviceId:       null,
    deviceName:     'Manual',
    total:          cartTotal || 0,
    amountReceived: cartTotal || 0,
    change:         0,
    currency:       settings.currency || 'EUR',
    status:         'completed',
    operationType:  10,   // PayinAmount
    isManual:       true,
    rcStatus:       null,
    items:          cartItems || []
  }
  db.saveTransaction(tx)
  res.json({ ok: true, transaction: tx })
})

// GET /api/sesami/content/:deviceId — cash levels (login → /content/current → logout)
router.get('/content/:deviceId', authMiddleware, async (req, res) => {
  const { deviceId } = req.params;
  const device = db.getDeviceById(deviceId);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  try {
    const data = await sesami.getContent(deviceId);
    res.json({ ok: true, device: { id: device.id, name: device.name }, levels: data.levels || data });
  } catch (err) {
    console.error('[RC5000 content]', err.message);
    res.status(503).json({ error: 'RC5000 error', detail: err.message });
  }
});

// GET /api/sesami/transactions?date=2026-03-04&status=completed,refund&cashierId=x,y&page=1&limit=100
router.get('/transactions', authMiddleware, (req, res) => {
  const { date, status, cashierId, operationType, rcStatus, isManual, page = 1, limit = 100 } = req.query;
  const filters = {
    date:           date           || null,
    statuses:       status         ? status.split(',')        : null,
    cashierIds:     cashierId      ? cashierId.split(',')     : null,
    operationTypes: operationType  ? operationType.split(',') : null,
    rcStatuses:     rcStatus       ? rcStatus.split(',')      : null,
    isManual:       isManual !== undefined ? isManual === 'true' : undefined,
    page:       Math.max(1, parseInt(page)),
    limit:      Math.min(100, Math.max(1, parseInt(limit)))
  };
  res.json(db.getTransactions(filters));
});

module.exports = router;
