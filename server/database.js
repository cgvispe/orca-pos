const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'orca.db');

let _db = null;

function migrateSchema(db) {
  // v2: can_refund column
  try { db.exec('ALTER TABLE users ADD COLUMN can_refund INTEGER NOT NULL DEFAULT 0'); } catch {}
  db.exec("UPDATE users SET can_refund = 1 WHERE role = 'manager' AND can_refund = 0");
  // v3: transaction fields
  try { db.exec('ALTER TABLE transactions ADD COLUMN operation_type INTEGER'); } catch {}
  try { db.exec('ALTER TABLE transactions ADD COLUMN is_manual INTEGER NOT NULL DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE transactions ADD COLUMN rc_status INTEGER'); } catch {}
  try { db.exec("UPDATE transactions SET operation_type = 10 WHERE operation_type IS NULL AND status = 'completed'"); } catch {}
  try { db.exec("UPDATE transactions SET operation_type = 5  WHERE operation_type IS NULL AND status = 'refund'"); } catch {}
  try { db.exec("UPDATE transactions SET is_manual = 1 WHERE device_name = 'Manual' AND is_manual = 0"); } catch {}
  // v4: total_in / total_out columns
  try { db.exec('ALTER TABLE transactions ADD COLUMN total_in REAL NOT NULL DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE transactions ADD COLUMN total_out REAL NOT NULL DEFAULT 0'); }  catch {}
  // Backfill: for payins totalIn=amountReceived, totalOut=change_given; for refunds totalOut=|amountReceived|
  try { db.exec("UPDATE transactions SET total_in=amount_received, total_out=change_given WHERE operation_type=10 AND total_in=0"); } catch {}
  try { db.exec("UPDATE transactions SET total_out=ABS(amount_received) WHERE operation_type=5 AND total_out=0"); } catch {}
}

function getDb() {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');   // better write performance + concurrent reads
  _db.pragma('foreign_keys = ON');

  initSchema(_db);
  migrateSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      username    TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('manager','cashier')),
      can_refund  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS devices (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      ip          TEXT NOT NULL,
      port        TEXT NOT NULL DEFAULT '4443',
      use_https   INTEGER NOT NULL DEFAULT 1,
      pos_id      TEXT NOT NULL,
      username    TEXT NOT NULL,
      secret_key  TEXT NOT NULL,
      is_default  INTEGER NOT NULL DEFAULT 0,
      active      INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categories (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id          TEXT PRIMARY KEY,
      code        TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      price       REAL NOT NULL,
      category    TEXT,
      emoji       TEXT,
      image_url   TEXT,
      active      INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id              TEXT PRIMARY KEY,
      date            TEXT NOT NULL,
      cashier_id      TEXT,
      cashier_name    TEXT,
      device_id       TEXT,
      device_name     TEXT,
      total           REAL NOT NULL,
      amount_received REAL NOT NULL,
      change_given    REAL NOT NULL DEFAULT 0,
      total_in        REAL NOT NULL DEFAULT 0,
      total_out       REAL NOT NULL DEFAULT 0,
      currency        TEXT NOT NULL DEFAULT 'EUR',
      status          TEXT NOT NULL DEFAULT 'completed',
      items           TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

module.exports = { getDb };
