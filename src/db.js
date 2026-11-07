import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { cfg } from './config.js';

fs.mkdirSync(path.join(cfg.dataDir, 'uploads'), { recursive: true });

export const db = new Database(path.join(cfg.dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,            -- telegram id
  name TEXT NOT NULL,
  username TEXT,
  photo_url TEXT,
  is_member INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER,
  can_message INTEGER NOT NULL DEFAULT 0,
  last_joker_month TEXT
);

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active',   -- draft | active | visited | archived
  title TEXT NOT NULL DEFAULT '',
  why TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  budget INTEGER NOT NULL DEFAULT 1,       -- 0 бесплатно, 1 до 1000, 2 до 3000, 3 дороже
  duration TEXT NOT NULL DEFAULT 'short',  -- short | half | day
  time_of_day TEXT NOT NULL DEFAULT '[]',  -- morning/day/evening/night, пусто = когда угодно
  area TEXT NOT NULL DEFAULT '',
  outdoor INTEGER NOT NULL DEFAULT 0,
  needs_booking INTEGER NOT NULL DEFAULT 0,
  available_until TEXT,                    -- YYYY-MM-DD
  fixed_at TEXT,                           -- YYYY-MM-DDTHH:MM (концерт и т.п.)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  visited_at INTEGER,
  times_shown INTEGER NOT NULL DEFAULT 0,
  last_shown_at INTEGER
);

CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL,                    -- voting | extra | scheduling | booked | done | skipped
  stage INTEGER NOT NULL DEFAULT 1,        -- 1 основное голосование, 2 довыбор
  started_at INTEGER NOT NULL,
  started_by INTEGER,
  deadline INTEGER NOT NULL,
  picked_card_id INTEGER REFERENCES cards(id),
  pick_reason TEXT,                        -- consensus | joker | best
  joker_user_id INTEGER,
  closed_at INTEGER,
  slot TEXT,                               -- YYYY-MM-DD@HH или YYYY-MM-DD@HH:MM
  booker_id INTEGER,
  reminded_before INTEGER NOT NULL DEFAULT 0,
  nagged_slots_on TEXT,
  reminded_votes INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS participation (
  round_id INTEGER NOT NULL REFERENCES rounds(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  mood_set INTEGER NOT NULL DEFAULT 0,
  moods TEXT NOT NULL DEFAULT '[]',
  pass INTEGER NOT NULL DEFAULT 0,
  done_stage INTEGER NOT NULL DEFAULT 0,
  joker_card_id INTEGER,
  slots_done INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (round_id, user_id)
);

CREATE TABLE IF NOT EXISTS votes (
  round_id INTEGER NOT NULL REFERENCES rounds(id),
  user_id INTEGER NOT NULL,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  value INTEGER NOT NULL,                  -- -1 не хочу, 1 можно, 2 очень хочу
  stage INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (round_id, user_id, card_id)
);

CREATE TABLE IF NOT EXISTS shown (
  round_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  card_id INTEGER NOT NULL,
  PRIMARY KEY (round_id, user_id, card_id)
);

CREATE TABLE IF NOT EXISTS availability (
  round_id INTEGER NOT NULL REFERENCES rounds(id),
  user_id INTEGER NOT NULL,
  slot TEXT NOT NULL,
  PRIMARY KEY (round_id, user_id, slot)
);

CREATE TABLE IF NOT EXISTS memories (
  round_id INTEGER NOT NULL REFERENCES rounds(id),
  user_id INTEGER NOT NULL,
  rating INTEGER,
  comment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (round_id, user_id)
);

CREATE TABLE IF NOT EXISTS memory_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL REFERENCES rounds(id),
  user_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Миграции для уже существующих баз
for (const sql of [
  "ALTER TABLE cards ADD COLUMN photos TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE cards ADD COLUMN links TEXT NOT NULL DEFAULT '[]'",
]) {
  try {
    db.exec(sql);
  } catch {
    /* колонка уже есть */
  }
}
db.exec("UPDATE cards SET photos=json_array(photo) WHERE photos='[]' AND photo<>''");
db.exec("UPDATE cards SET links=json_array(json_object('url',link,'label','')) WHERE links='[]' AND link<>''");

const cache = new Map();
const st = (sql) => {
  let s = cache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    cache.set(sql, s);
  }
  return s;
};
export const all = (sql, ...p) => st(sql).all(...p);
export const get = (sql, ...p) => st(sql).get(...p);
export const run = (sql, ...p) => st(sql).run(...p);
export const tx = (fn) => db.transaction(fn)();

export function getSetting(key, def = null) {
  const r = get('SELECT value FROM settings WHERE key=?', key);
  return r ? r.value : def;
}
export function setSetting(key, value) {
  run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, String(value));
}
