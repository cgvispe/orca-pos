/**
 * seed.js — Populates the database with initial data on first run.
 * Called automatically from db.js if tables are empty.
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./database');

function seed() {
  const db = getDb();

  // ── Users ────────────────────────────────────────────────────────────────
  const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  if (userCount === 0) {
    const insert = db.prepare(
      'INSERT INTO users (id, name, username, password, role) VALUES (?, ?, ?, ?, ?)'
    );
    insert.run(uuidv4(), 'Administrator', 'admin',   bcrypt.hashSync('password', 10), 'manager');
    insert.run(uuidv4(), 'Cashier',       'cashier', bcrypt.hashSync('password', 10), 'cashier');
    console.log('[seed] Users created');
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  const settingsCount = db.prepare('SELECT COUNT(*) as n FROM settings').get().n;
  if (settingsCount === 0) {
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const defaults = {
      businessName:   'ORCA POS',
      currency:       'EUR',
      currencySymbol: '€',
      locale:         'es-ES',
      themeMode:      'dark',
      themePrimary:   '#00c4b3',
      themeFont:      'Inter',
      logoUrl:        ''
    };
    for (const [key, value] of Object.entries(defaults)) {
      upsert.run(key, value);
    }
    console.log('[seed] Settings created');
  }

  // ── Categories ───────────────────────────────────────────────────────────
  const catCount = db.prepare('SELECT COUNT(*) as n FROM categories').get().n;
  if (catCount === 0) {
    const insert = db.prepare('INSERT INTO categories (name) VALUES (?)');
    ['Drinks', 'Food', 'Snacks'].forEach(name => insert.run(name));
    console.log('[seed] Categories created');
  }

  // ── Items ─────────────────────────────────────────────────────────────────
  const itemCount = db.prepare('SELECT COUNT(*) as n FROM items').get().n;
  if (itemCount === 0) {
    const insert = db.prepare(
      'INSERT INTO items (id, code, name, price, category, emoji, active) VALUES (?, ?, ?, ?, ?, ?, 1)'
    );
    const items = [
      [uuidv4(), 'DRI001', 'Espresso',      1.50, 'Drinks', '☕'],
      [uuidv4(), 'DRI002', 'Cappuccino',    2.50, 'Drinks', '☕'],
      [uuidv4(), 'DRI003', 'Orange Juice',  2.00, 'Drinks', '🍊'],
      [uuidv4(), 'FOO001', 'Croissant',     1.80, 'Food',   '🥐'],
      [uuidv4(), 'FOO002', 'Sandwich',      4.50, 'Food',   '🥪'],
      [uuidv4(), 'SNA001', 'Chips',         1.20, 'Snacks', '🥨'],
      [uuidv4(), 'SNA002', 'Chocolate Bar', 1.50, 'Snacks', '🍫'],
    ];
    items.forEach(i => insert.run(...i));
    console.log('[seed] Items created');
  }

  // No default device — manager must configure RC5000 devices manually
}

module.exports = { seed };
