const Database = require("better-sqlite3");
const path = require("path");
const { mkdirSync } = require("fs");

const DB_PATH = path.join(process.cwd(), "data", "bot.db");
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    prefix TEXT DEFAULT '!',
    welcome_channel TEXT,
    welcome_message TEXT,
    leave_channel TEXT,
    leave_message TEXT,
    log_channel TEXT,
    auto_role TEXT,
    levels_enabled INTEGER DEFAULT 1,
    levels_channel TEXT,
    levels_message TEXT DEFAULT '{user} vient de passer au niveau **{level}** !',
    economy_enabled INTEGER DEFAULT 1,
    suggestion_channel TEXT,
    report_channel TEXT,
    birthday_channel TEXT,
    ticket_category TEXT,
    ticket_support_role TEXT,
    automod_enabled INTEGER DEFAULT 0,
    automod_anti_spam INTEGER DEFAULT 0,
    automod_anti_link INTEGER DEFAULT 0,
    automod_badwords TEXT DEFAULT '[]',
    starboard_channel TEXT,
    starboard_threshold INTEGER DEFAULT 3,
    spam_threshold INTEGER DEFAULT 5,
    spam_interval INTEGER DEFAULT 3,
    mention_threshold INTEGER DEFAULT 5,
    raid_threshold INTEGER DEFAULT 10,
    raid_interval INTEGER DEFAULT 10,
    nuke_threshold INTEGER DEFAULT 3,
    mute_duration INTEGER DEFAULT 10,
    log_messages_channel TEXT,
    log_membres_channel TEXT,
    log_moderation_channel TEXT,
    log_serveur_channel TEXT
  );
  CREATE TABLE IF NOT EXISTS member_levels (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
    xp INTEGER DEFAULT 0, level INTEGER DEFAULT 0,
    messages INTEGER DEFAULT 0, last_xp INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS member_economy (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
    balance INTEGER DEFAULT 0, bank INTEGER DEFAULT 0,
    last_daily INTEGER DEFAULT 0, last_work INTEGER DEFAULT 0, last_crime INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, moderator_id TEXT, reason TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS sanctions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, moderator_id TEXT,
    type TEXT, reason TEXT, duration INTEGER, expires_at INTEGER, active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, channel_id TEXT, message_id TEXT, host_id TEXT,
    prize TEXT, winners_count INTEGER DEFAULT 1,
    entries TEXT DEFAULT '[]', ends_at INTEGER, ended INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS birthdays (
    guild_id TEXT, user_id TEXT, day INTEGER, month INTEGER, year INTEGER,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS reaction_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, channel_id TEXT, message_id TEXT, emoji TEXT, role_id TEXT
  );
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, channel_id TEXT, user_id TEXT,
    subject TEXT, status TEXT DEFAULT 'open',
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, channel_id TEXT, message_id TEXT, user_id TEXT,
    content TEXT, status TEXT DEFAULT 'pending',
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS custom_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, name TEXT, response TEXT, created_by TEXT,
    UNIQUE(guild_id, name)
  );
  CREATE TABLE IF NOT EXISTS counting (
    guild_id TEXT PRIMARY KEY, channel_id TEXT,
    current_number INTEGER DEFAULT 0, last_user_id TEXT, record INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT, channel_id TEXT, message TEXT, remind_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, name TEXT, description TEXT,
    price INTEGER, role_id TEXT, emoji TEXT DEFAULT '🛍️'
  );
  CREATE TABLE IF NOT EXISTS automod_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, type TEXT, content TEXT, action TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

function getGuildSettings(guildId) {
  let s = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(guildId);
  if (!s) {
    db.prepare("INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)").run(guildId);
    s = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(guildId);
  }
  return s;
}

function getMemberLevel(guildId, userId) {
  let r = db.prepare("SELECT * FROM member_levels WHERE guild_id = ? AND user_id = ?").get(guildId, userId);
  if (!r) {
    db.prepare("INSERT OR IGNORE INTO member_levels (guild_id, user_id) VALUES (?, ?)").run(guildId, userId);
    r = db.prepare("SELECT * FROM member_levels WHERE guild_id = ? AND user_id = ?").get(guildId, userId);
  }
  return r;
}

function getMemberEconomy(guildId, userId) {
  let r = db.prepare("SELECT * FROM member_economy WHERE guild_id = ? AND user_id = ?").get(guildId, userId);
  if (!r) {
    db.prepare("INSERT OR IGNORE INTO member_economy (guild_id, user_id) VALUES (?, ?)").run(guildId, userId);
    r = db.prepare("SELECT * FROM member_economy WHERE guild_id = ? AND user_id = ?").get(guildId, userId);
  }
  return r;
}

function xpForLevel(level) { return Math.floor(100 * Math.pow(1.5, level)); }

function levelFromXp(xp) {
  let level = 0, needed = xpForLevel(0);
  while (xp >= needed) { xp -= needed; level++; needed = xpForLevel(level); }
  return level;
}

module.exports = { db, getGuildSettings, getMemberLevel, getMemberEconomy, xpForLevel, levelFromXp };

db.prepare(`
  CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_id TEXT UNIQUE NOT NULL,
    guild_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    guild_name TEXT,
    role_count INTEGER DEFAULT 0,
    channel_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS autoroles (
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  type TEXT DEFAULT 'all',
  PRIMARY KEY (guild_id, role_id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS reactionroles (
  message_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  mode TEXT DEFAULT 'button'
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS reactionrole_items (
  message_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  label TEXT,
  emoji TEXT,
  PRIMARY KEY (message_id, role_id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (guild_id, key)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS ticket_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  panel_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT DEFAULT '🎫',
  category_id TEXT,
  support_role_id TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS ticket_panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT DEFAULT 'Support',
  embed_title TEXT DEFAULT 'Ouvrir un ticket',
  embed_description TEXT DEFAULT 'Clique pour ouvrir un ticket',
  embed_color TEXT DEFAULT '#7c3aed',
  button_label TEXT DEFAULT 'Ouvrir un ticket',
  welcome_message TEXT DEFAULT 'Bonjour {user} !',
  channel_id TEXT,
  created_at INTEGER DEFAULT (unixepoch())
)`).run();
// ══ TICKET MIGRATION ══
const ticketCols = [
  "ALTER TABLE ticket_panels ADD COLUMN two_step_close INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN two_step_ticket INTEGER DEFAULT 1",
  "ALTER TABLE ticket_panels ADD COLUMN auto_pin INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN ticket_padding INTEGER DEFAULT 4",
  "ALTER TABLE ticket_panels ADD COLUMN category_open_id TEXT",
  "ALTER TABLE ticket_panels ADD COLUMN category_closed_id TEXT",
  "ALTER TABLE ticket_panels ADD COLUMN ticket_open_name TEXT DEFAULT 'Ticket-{count}'",
  "ALTER TABLE ticket_panels ADD COLUMN ticket_close_name TEXT DEFAULT 'Closed-{count}'",
  "ALTER TABLE ticket_panels ADD COLUMN support_role_id TEXT",
  "ALTER TABLE ticket_panels ADD COLUMN additional_roles TEXT DEFAULT '[]'",
  "ALTER TABLE ticket_panels ADD COLUMN transcript_channel_id TEXT",
  "ALTER TABLE ticket_panels ADD COLUMN log_channel_id TEXT",
  "ALTER TABLE ticket_panels ADD COLUMN log_ticket_created INTEGER DEFAULT 1",
  "ALTER TABLE ticket_panels ADD COLUMN log_ticket_closed INTEGER DEFAULT 1",
  "ALTER TABLE ticket_panels ADD COLUMN log_ticket_opened INTEGER DEFAULT 1",
  "ALTER TABLE ticket_panels ADD COLUMN log_ticket_renamed INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN log_ticket_deleted INTEGER DEFAULT 1",
  "ALTER TABLE ticket_panels ADD COLUMN log_transcript_saved INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN claiming_enabled INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN claim_name TEXT DEFAULT 'Claimed-{count}'",
  "ALTER TABLE ticket_panels ADD COLUMN auto_save_transcript INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN dm_on_close INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN dm_on_create INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN select_style INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN thread_style INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN thread_channel_id TEXT",
  "ALTER TABLE ticket_panels ADD COLUMN form_enabled INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN form_title TEXT DEFAULT 'Please fill this out'",
  "ALTER TABLE ticket_panels ADD COLUMN form_questions TEXT DEFAULT '[]'",
  "ALTER TABLE ticket_panels ADD COLUMN max_open_per_user INTEGER DEFAULT 1",
  "ALTER TABLE ticket_panels ADD COLUMN max_open_total INTEGER DEFAULT 500",
  "ALTER TABLE ticket_panels ADD COLUMN schedule_enabled INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN ticket_count INTEGER DEFAULT 0",
  "ALTER TABLE ticket_panels ADD COLUMN open_roles TEXT DEFAULT '[]'",
  "ALTER TABLE ticket_panels ADD COLUMN close_roles TEXT DEFAULT '[]'",
  "ALTER TABLE ticket_panels ADD COLUMN ticket_open_message TEXT",
  "ALTER TABLE ticket_panels ADD COLUMN ticket_close_question TEXT",
  "ALTER TABLE ticket_panels ADD COLUMN panel_message_id TEXT",
  "ALTER TABLE ticket_panels ADD COLUMN channel_id TEXT",
  "ALTER TABLE ticket_panels ADD COLUMN dropdown_items TEXT DEFAULT '[]'",
  "ALTER TABLE ticket_panels ADD COLUMN escalate_panels TEXT DEFAULT '[]'",
  "ALTER TABLE ticket_panels ADD COLUMN buttons_per_row INTEGER DEFAULT 5",
];
for (const sql of ticketCols) { try { db.exec(sql); } catch(_) {} }

db.exec(`CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  panel_id INTEGER, guild_id TEXT, type TEXT,
  content TEXT, embed_title TEXT, embed_description TEXT,
  embed_color TEXT, embed_footer TEXT,
  UNIQUE(panel_id, type)
);`);
