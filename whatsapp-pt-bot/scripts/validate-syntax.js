#!/usr/bin/env node
// scripts/validate-syntax.js
const { execSync } = require('child_process');

const files = [
  'src/index.js',
  'src/bot.js',
  'src/ai.js',
  'src/calendar.js',
  'src/database.js',
  'src/scheduler.js',
  'src/handlers/menu.js',
  'src/handlers/booking.js',
  'src/handlers/cancel.js',
  'src/handlers/appointments.js',
  'src/handlers/admin.js',
  'src/utils/messages.js',
  'src/utils/helpers.js'
];

for (const file of files) {
  execSync(`node --check ${file}`, { stdio: 'inherit' });
}

console.log('✅ Syntax check completato');
