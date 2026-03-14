// src/database.js
const Database = require('better-sqlite3');
const path = require('path');
const { dayjs, log } = require('./utils/helpers');

const dbPath = path.join(__dirname, '..', 'data.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      phone TEXT PRIMARY KEY,
      name TEXT,
      created_at TEXT NOT NULL,
      last_seen TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      phone TEXT PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'IDLE',
      state_data TEXT,
      last_interaction TEXT NOT NULL,
      FOREIGN KEY (phone) REFERENCES clients(phone)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT,
      phone TEXT NOT NULL,
      client_name TEXT,
      session_type TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'BOOKED',
      confirmed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (phone) REFERENCES clients(phone)
    );

    CREATE TABLE IF NOT EXISTS message_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminder_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      reminder_type TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      UNIQUE(appointment_id, reminder_type),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );
  `);

  log('DB', `Database inizializzato: ${dbPath}`);
}

function upsertClient(phone, name = 'Cliente') {
  const now = dayjs().toISOString();
  const stmt = db.prepare(`
    INSERT INTO clients (phone, name, created_at, last_seen)
    VALUES (@phone, @name, @created_at, @last_seen)
    ON CONFLICT(phone) DO UPDATE SET
      name = COALESCE(excluded.name, clients.name),
      last_seen = excluded.last_seen
  `);

  stmt.run({ phone, name, created_at: now, last_seen: now });
}

function getConversation(phone) {
  const row = db.prepare('SELECT * FROM conversations WHERE phone = ?').get(phone);
  if (!row) {
    const now = dayjs().toISOString();
    db.prepare('INSERT INTO conversations (phone, state, state_data, last_interaction) VALUES (?, ?, ?, ?)')
      .run(phone, 'IDLE', '{}', now);
    return { phone, state: 'IDLE', state_data: '{}', last_interaction: now };
  }
  return row;
}

function setConversationState(phone, state, stateData = {}) {
  const now = dayjs().toISOString();
  db.prepare(`
    INSERT INTO conversations (phone, state, state_data, last_interaction)
    VALUES (@phone, @state, @state_data, @last_interaction)
    ON CONFLICT(phone) DO UPDATE SET
      state = excluded.state,
      state_data = excluded.state_data,
      last_interaction = excluded.last_interaction
  `).run({ phone, state, state_data: JSON.stringify(stateData || {}), last_interaction: now });
}

function touchConversation(phone) {
  db.prepare('UPDATE conversations SET last_interaction = ? WHERE phone = ?')
    .run(dayjs().toISOString(), phone);
}

function resetInactiveConversations(timeoutMinutes = 30) {
  const threshold = dayjs().subtract(timeoutMinutes, 'minute').toISOString();
  const info = db.prepare("UPDATE conversations SET state='IDLE', state_data='{}' WHERE last_interaction < ? AND state != 'IDLE'")
    .run(threshold);
  return info.changes;
}

function saveMessage(phone, role, content) {
  db.prepare('INSERT INTO message_history (phone, role, content, created_at) VALUES (?, ?, ?, ?)')
    .run(phone, role, content, dayjs().toISOString());
}

function getRecentMessages(phone, limit = 5) {
  return db.prepare('SELECT role, content FROM message_history WHERE phone = ? ORDER BY id DESC LIMIT ?')
    .all(phone, limit)
    .reverse();
}

function createAppointment(appointment) {
  const stmt = db.prepare(`
    INSERT INTO appointments
      (event_id, phone, client_name, session_type, start_time, end_time, status, confirmed, created_at)
    VALUES
      (@event_id, @phone, @client_name, @session_type, @start_time, @end_time, @status, @confirmed, @created_at)
  `);
  const result = stmt.run({
    ...appointment,
    status: appointment.status || 'BOOKED',
    confirmed: appointment.confirmed || 0,
    created_at: dayjs().toISOString()
  });
  return getAppointmentById(result.lastInsertRowid);
}

function getAppointmentById(id) {
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
}

function getUpcomingAppointmentsByPhone(phone) {
  return db.prepare(`
    SELECT * FROM appointments
    WHERE phone = ? AND status = 'BOOKED' AND start_time >= ?
    ORDER BY start_time ASC
  `).all(phone, dayjs().toISOString());
}

function markAppointmentCancelled(id) {
  db.prepare("UPDATE appointments SET status='CANCELLED' WHERE id = ?").run(id);
}

function findAppointmentByEventId(eventId) {
  return db.prepare('SELECT * FROM appointments WHERE event_id = ?').get(eventId);
}

function getRemindersCandidates() {
  return db.prepare(`
    SELECT * FROM appointments
    WHERE status='BOOKED' AND start_time >= ?
    ORDER BY start_time ASC
  `).all(dayjs().toISOString());
}

function hasReminderBeenSent(appointmentId, type) {
  const row = db.prepare('SELECT id FROM reminder_logs WHERE appointment_id = ? AND reminder_type = ?').get(appointmentId, type);
  return !!row;
}

function logReminder(appointmentId, type) {
  db.prepare('INSERT OR IGNORE INTO reminder_logs (appointment_id, reminder_type, sent_at) VALUES (?, ?, ?)')
    .run(appointmentId, type, dayjs().toISOString());
}

function markAppointmentConfirmedByPhone(phone) {
  const now = dayjs();
  const appointment = db.prepare(`
    SELECT * FROM appointments
    WHERE phone = ? AND status='BOOKED' AND start_time >= ? AND start_time <= ?
    ORDER BY start_time ASC LIMIT 1
  `).get(phone, now.toISOString(), now.add(4, 'hour').toISOString());

  if (!appointment) return null;

  db.prepare('UPDATE appointments SET confirmed = 1 WHERE id = ?').run(appointment.id);
  return getAppointmentById(appointment.id);
}

function getStats() {
  const todayStart = dayjs().startOf('day').toISOString();
  const weekStart = dayjs().startOf('week').toISOString();

  const today = db.prepare("SELECT COUNT(*) as total FROM appointments WHERE status='BOOKED' AND created_at >= ?")
    .get(todayStart).total;
  const week = db.prepare("SELECT COUNT(*) as total FROM appointments WHERE status='BOOKED' AND created_at >= ?")
    .get(weekStart).total;
  const clients = db.prepare('SELECT COUNT(*) as total FROM clients').get().total;

  return { today, week, clients };
}

function getClientsWithSessions() {
  return db.prepare(`
    SELECT c.phone, c.name, COUNT(a.id) as sessions
    FROM clients c
    LEFT JOIN appointments a ON a.phone = c.phone
    GROUP BY c.phone, c.name
    ORDER BY sessions DESC
  `).all();
}

module.exports = {
  createAppointment,
  findAppointmentByEventId,
  getAppointmentById,
  getClientsWithSessions,
  getConversation,
  getRecentMessages,
  getRemindersCandidates,
  getStats,
  getUpcomingAppointmentsByPhone,
  hasReminderBeenSent,
  initDatabase,
  logReminder,
  markAppointmentCancelled,
  markAppointmentConfirmedByPhone,
  resetInactiveConversations,
  saveMessage,
  setConversationState,
  touchConversation,
  upsertClient
};
