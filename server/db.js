/**
 * db.js — Database access layer.
 * All functions use better-sqlite3 (synchronous).
 * Public interface is intentionally compatible with the previous JSON implementation.
 */
const { getDb } = require('./database');
const { seed }  = require('./seed');

// Initialise DB and seed on first run
const db = getDb();
seed();

// ── Users ──────────────────────────────────────────────────────────────────

function normalizeUser(u) {
  return { ...u, canRefund: !!u.can_refund }
}

function getUsers() {
  return db.prepare('SELECT * FROM users').all().map(normalizeUser);
}

function getUserByUsername(username) {
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  return u ? { ...u, canRefund: !!u.can_refund } : null;
}

function getUserById(id) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return u ? { ...u, canRefund: !!u.can_refund } : null;
}

function saveUser(user) {
  db.prepare(`
    INSERT INTO users (id, name, username, password, role, can_refund)
    VALUES (@id, @name, @username, @password, @role, @canRefund)
  `).run({ ...user, canRefund: user.canRefund ? 1 : 0 });
}

function updateUser(id, fields) {
  const allowed = ['name', 'username', 'password', 'can_refund'];
  const sets = Object.keys(fields)
    .filter(k => allowed.includes(k))
    .map(k => `${k} = @${k}`)
    .join(', ');
  if (!sets) return;
  db.prepare(`UPDATE users SET ${sets} WHERE id = @id`).run({ ...fields, id });
}

function deleteUser(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ── Items ──────────────────────────────────────────────────────────────────

function getItems() {
  return db.prepare('SELECT * FROM items WHERE active = 1').all().map(normalizeItem);
}

function getAllItems() {
  return db.prepare('SELECT * FROM items').all().map(normalizeItem);
}

function getItemById(id) {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  return row ? normalizeItem(row) : null;
}

function saveItem(item) {
  db.prepare(`
    INSERT INTO items (id, code, name, price, category, emoji, image_url, active)
    VALUES (@id, @code, @name, @price, @category, @emoji, @imageUrl, @active)
  `).run({
    id: item.id, code: item.code, name: item.name,
    price: item.price, category: item.category || '',
    emoji: item.emoji || '', imageUrl: item.imageUrl || null,
    active: item.active !== false ? 1 : 0
  });
}

function updateItem(id, fields) {
  const map = {
    code: 'code', name: 'name', price: 'price', category: 'category',
    emoji: 'emoji', imageUrl: 'image_url', active: 'active'
  };
  const sets = Object.keys(fields)
    .filter(k => map[k] !== undefined)
    .map(k => `${map[k]} = @${k}`)
    .join(', ');
  if (!sets) return;
  const params = { id };
  for (const k of Object.keys(fields)) {
    if (map[k] !== undefined) {
      params[k] = k === 'active' ? (fields[k] ? 1 : 0) : fields[k];
    }
  }
  db.prepare(`UPDATE items SET ${sets} WHERE id = @id`).run(params);
}

function normalizeItem(row) {
  return {
    id: row.id, code: row.code, name: row.name, price: row.price,
    category: row.category, emoji: row.emoji,
    imageUrl: row.image_url || null, active: row.active === 1
  };
}

// ── Categories ─────────────────────────────────────────────────────────────

function getCategories() {
  return db.prepare('SELECT name FROM categories ORDER BY name').all().map(r => r.name);
}

function saveCategories(cats) {
  const tx = db.transaction((list) => {
    db.prepare('DELETE FROM categories').run();
    const ins = db.prepare('INSERT INTO categories (name) VALUES (?)');
    list.forEach(name => ins.run(name));
  });
  tx(cats);
}

function addCategory(name) {
  db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
}

function deleteCategory(name) {
  db.prepare('DELETE FROM categories WHERE name = ?').run(name);
}

// ── Settings ───────────────────────────────────────────────────────────────

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const flat = {};
  rows.forEach(r => { flat[r.key] = r.value; });
  return {
    businessName:   flat.businessName   || 'ORCA POS',
    currency:       flat.currency       || 'EUR',
    currencySymbol: flat.currencySymbol || '€',
    locale:         flat.locale         || 'es-ES',
    theme: {
      mode:         flat.themeMode    || 'dark',
      primary:      flat.themePrimary || '#00c4b3',
      primaryColor: flat.themePrimary || '#00c4b3',
      font:         flat.themeFont    || 'Inter',
      fontFamily:   flat.themeFont    || 'Inter',
      logoUrl:      flat.logoUrl      || ''
    }
  };
}

function saveSettings(settings) {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction(() => {
    if (settings.businessName   !== undefined) upsert.run('businessName',   settings.businessName);
    if (settings.currency       !== undefined) upsert.run('currency',       settings.currency);
    if (settings.currencySymbol !== undefined) upsert.run('currencySymbol', settings.currencySymbol);
    if (settings.locale         !== undefined) upsert.run('locale',         settings.locale);
    if (settings.theme) {
      if (settings.theme.mode    !== undefined) upsert.run('themeMode',    settings.theme.mode);
      if (settings.theme.primary !== undefined) upsert.run('themePrimary', settings.theme.primary);
      if (settings.theme.font    !== undefined) upsert.run('themeFont',    settings.theme.font);
      if (settings.theme.logoUrl !== undefined) upsert.run('logoUrl',      settings.theme.logoUrl);
    }
  });
  tx();
}

// ── RC5000 Session persistence ─────────────────────────────────────────────
// Persists bearer tokens across server restarts using the settings table

function saveDeviceSession(deviceId, token) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(`session_${deviceId}`, token);
}

function getDeviceSession(deviceId) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`session_${deviceId}`);
  return row?.value || null;
}

function clearDeviceSession(deviceId) {
  db.prepare('DELETE FROM settings WHERE key = ?').run(`session_${deviceId}`);
}

// ── Devices (RC5000) ────────────────────────────────────────────────────────

function getDevices() {
  return db.prepare('SELECT * FROM devices').all().map(normalizeDevice);
}

function getActiveDevices() {
  return db.prepare('SELECT * FROM devices WHERE active = 1').all().map(normalizeDevice);
}

function getDeviceById(id) {
  const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
  return row ? normalizeDevice(row) : null;
}

function saveDevice(device) {
  db.prepare(`
    INSERT INTO devices (id, name, ip, port, use_https, pos_id, username, secret_key, is_default, active)
    VALUES (@id, @name, @ip, @port, @useHttps, @posId, @username, @secretKey, @isDefault, @active)
  `).run({
    id: device.id, name: device.name, ip: device.ip,
    port: device.port || '4443', useHttps: device.useHttps ? 1 : 0,
    posId: device.posId, username: device.username, secretKey: device.secretKey,
    isDefault: device.isDefault ? 1 : 0, active: device.active !== false ? 1 : 0
  });
}

function updateDevice(id, fields) {
  const map = {
    name: 'name', ip: 'ip', port: 'port', useHttps: 'use_https',
    posId: 'pos_id', username: 'username', secretKey: 'secret_key',
    isDefault: 'is_default', active: 'active'
  };
  const boolFields = ['useHttps', 'isDefault', 'active'];
  const sets = Object.keys(fields)
    .filter(k => map[k] !== undefined)
    .map(k => `${map[k]} = @${k}`)
    .join(', ');
  if (!sets) return;
  const params = { id };
  for (const k of Object.keys(fields)) {
    if (map[k] !== undefined) {
      params[k] = boolFields.includes(k) ? (fields[k] ? 1 : 0) : fields[k];
    }
  }
  db.prepare(`UPDATE devices SET ${sets} WHERE id = @id`).run(params);
}

function deleteDevice(id) {
  db.prepare('DELETE FROM devices WHERE id = ?').run(id);
}

function setDefaultDevice(id) {
  const tx = db.transaction(() => {
    db.prepare('UPDATE devices SET is_default = 0').run();
    db.prepare('UPDATE devices SET is_default = 1 WHERE id = ?').run(id);
  });
  tx();
}

function normalizeDevice(row) {
  return {
    id: row.id, name: row.name, ip: row.ip, port: row.port,
    useHttps: row.use_https === 1, posId: row.pos_id,
    username: row.username, secretKey: row.secret_key,
    isDefault: row.is_default === 1, active: row.active === 1
  };
}

// ── Transactions ───────────────────────────────────────────────────────────

function getTransactions(filters = {}) {
  const { date, statuses, cashierIds, operationTypes, isManual, page = 1, limit = 100 } = filters;
  const conditions = [];
  const params = [];

  if (date) {
    conditions.push("date >= ? AND date < ?");
    params.push(date + 'T00:00:00.000Z', date + 'T23:59:59.999Z');
  }
  if (statuses && statuses.length) {
    conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  if (operationTypes && operationTypes.length) {
    const placeholders = operationTypes.map(() => '?').join(',');
    conditions.push('operation_type IN (' + placeholders + ')');
    params.push(...operationTypes.map(Number));
  }
  if (isManual !== null && isManual !== undefined && isManual !== '') {
    conditions.push('is_manual = ?');
    params.push(isManual ? 1 : 0);
  }
  if (cashierIds && cashierIds.length) {
    conditions.push(`cashier_id IN (${cashierIds.map(() => '?').join(',')})`);
    params.push(...cashierIds);
  }

  const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const rows  = db.prepare(`SELECT * FROM transactions ${where} ORDER BY date DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) as n FROM transactions ${where}`)
    .get(...params).n;

  return { data: rows.map(normalizeTransaction), total, page, limit, pages: Math.ceil(total / limit) };
}

function saveTransaction(tx) {
  db.prepare(`
    INSERT INTO transactions
      (id, date, cashier_id, cashier_name, device_id, device_name,
       total, amount_received, change_given, currency, status, items,
       operation_type, is_manual, rc_status, total_in, total_out)
    VALUES
      (@id, @date, @cashierId, @cashierName, @deviceId, @deviceName,
       @total, @amountReceived, @change, @currency, @status, @items,
       @operationType, @isManual, @rcStatus, @totalIn, @totalOut)
  `).run({
    id: tx.id, date: tx.date,
    cashierId:      tx.cashierId   || null,
    cashierName:    tx.cashierName || tx.cashier || null,
    deviceId:       tx.deviceId   || null,
    deviceName:     tx.deviceName || null,
    total:          tx.total,
    amountReceived: tx.amountReceived || tx.total,
    change:         tx.change || 0,
    currency:       tx.currency || 'EUR',
    status:         tx.status   || 'completed',
    items:          JSON.stringify(tx.items || []),
    operationType:  tx.operationType  || null,
    isManual:       tx.isManual ? 1 : 0,
    rcStatus:       tx.rcStatus       || null,
    totalIn:        tx.totalIn        || 0,
    totalOut:       tx.totalOut       || 0
  });
}

function normalizeTransaction(row) {
  return {
    id:             row.id,
    date:           row.date,
    cashierId:      row.cashier_id,
    cashierName:    row.cashier_name,
    deviceId:       row.device_id,
    deviceName:     row.device_name,
    total:          row.total,
    amountReceived: row.amount_received,
    change:         row.change_given,
    currency:       row.currency,
    status:         row.status,
    items:          JSON.parse(row.items || '[]'),
    operationType:  row.operation_type  || null,
    isManual:       !!row.is_manual,
    rcStatus:       row.rc_status       || null,
    totalIn:        row.total_in        || 0,
    totalOut:       row.total_out       || 0
  };
}

module.exports = {
  getUsers, getUserByUsername, getUserById, saveUser, updateUser, deleteUser,
  getItems, getAllItems, getItemById, saveItem, updateItem,
  getCategories, saveCategories, addCategory, deleteCategory,
  getSettings, saveSettings,
  saveDeviceSession, getDeviceSession, clearDeviceSession,
  getDevices, getActiveDevices, getDeviceById, saveDevice, updateDevice, deleteDevice, setDefaultDevice,
  getTransactions, saveTransaction
};
