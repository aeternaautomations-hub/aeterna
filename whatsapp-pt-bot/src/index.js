// src/index.js
const dotenv = require('dotenv');

dotenv.config();

const http = require('http');
const { startBot } = require('./bot');
const { initDatabase } = require('./database');
const { createScheduler } = require('./scheduler');
const { log } = require('./utils/helpers');

function validateEnv() {
  const required = [
    'OPENAI_API_KEY',
    'GOOGLE_CALENDAR_ID',
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'PT_NAME',
    'PT_ADDRESS',
    'ADMIN_PHONE',
    'SESSION_NAME'
  ];

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Variabili .env mancanti: ${missing.join(', ')}`);
  }
}

async function bootstrap() {
  validateEnv();
  initDatabase();

  const { sendTextByPhone } = await startBot();
  createScheduler(sendTextByPhone);

  const port = Number(process.env.PORT || 3000);
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, timestamp: new Date().toISOString() }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp PT Bot attivo');
  });

  server.listen(port, () => {
    log('APP', `Server health-check avviato su porta ${port}`);
  });
}

bootstrap().catch((error) => {
  log('FATAL', 'Avvio fallito', error.message);
  process.exit(1);
});
