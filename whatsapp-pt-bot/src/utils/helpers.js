// src/utils/helpers.js
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

function ts() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

function log(scope, message, data) {
  if (data !== undefined) {
    console.log(`[${ts()}] [${scope}] ${message}`, data);
    return;
  }
  console.log(`[${ts()}] [${scope}] ${message}`);
}

function normalizePhone(input = '') {
  return String(input).replace(/\D/g, '');
}

function extractPhoneFromJid(jid = '') {
  return normalizePhone(jid.split('@')[0] || '');
}

function isGreeting(text = '') {
  const normalized = text.toLowerCase().trim();
  const greetings = ['ciao', 'hello', 'hey', 'buongiorno', 'buonasera', 'salve'];
  return greetings.some((g) => normalized === g || normalized.startsWith(`${g} `));
}

function parseMenuChoice(text = '') {
  return String(text).trim().replace(/[️⃣\s]/g, '');
}

function formatDateTime(iso, tz = process.env.TIMEZONE || 'Europe/Rome') {
  return dayjs(iso).tz(tz).format('DD/MM/YYYY HH:mm');
}

function minutesDiffFromNow(iso) {
  return dayjs(iso).diff(dayjs(), 'minute');
}

module.exports = {
  dayjs,
  extractPhoneFromJid,
  formatDateTime,
  isGreeting,
  log,
  minutesDiffFromNow,
  normalizePhone,
  parseMenuChoice,
  ts
};
