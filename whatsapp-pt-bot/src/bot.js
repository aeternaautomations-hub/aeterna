// src/bot.js
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qr = require('qrcode-terminal');

const { generateAIReply } = require('./ai');
const { showAppointments } = require('./handlers/appointments');
const { handleAdminCommand } = require('./handlers/admin');
const { handleCancelSelection, startCancelFlow } = require('./handlers/cancel');
const {
  handleBookingConfirm,
  handleBookingSlot,
  handleBookingType,
  startBookingFlow
} = require('./handlers/booking');
const { sendMainMenu } = require('./handlers/menu');
const {
  getConversation,
  markAppointmentConfirmedByPhone,
  saveMessage,
  touchConversation,
  upsertClient
} = require('./database');
const { extractPhoneFromJid, isGreeting, log, parseMenuChoice } = require('./utils/helpers');
const { genericError, mainMenu } = require('./utils/messages');

function normalizeTextFromMessage(msg) {
  return (
    msg?.message?.conversation
    || msg?.message?.extendedTextMessage?.text
    || msg?.message?.imageMessage?.caption
    || ''
  ).trim();
}

function toJid(phone) {
  return `${phone}@s.whatsapp.net`;
}

function inferMenuChoiceFromText(text = '') {
  const t = text.toLowerCase().trim();

  if (['menu', 'menù', 'help', 'aiuto'].includes(t)) return 'MENU';
  if (t.includes('prenot') || t.includes('sessione') || t.includes('allenamento domani') || t.includes('allenarmi')) return '1';
  if (t.includes('recuper')) return '2';
  if (t.includes('appuntament') && (t.includes('ved') || t.includes('mostra') || t.includes('prossim'))) return '3';
  if (t.includes('disdici') || t.includes('annulla')) return '4';
  if (t.includes('coach') || t.includes('operatore')) return '5';
  if (t.includes('prezz') || t.includes('costo') || t.includes('tariff')) return '6';

  return null;
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'info' }),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr: qrCode } = update;

    if (qrCode) {
      qr.generate(qrCode, { small: true });
      log('BAILEYS', 'QR generato: scansiona con WhatsApp per autorizzare.');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      log('BAILEYS', `Connessione chiusa. Riconnessione: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(() => startBot(), 5000);
      }
    } else if (connection === 'open') {
      log('BAILEYS', 'Connessione WhatsApp attiva ✅');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;
        if (!jid || !jid.endsWith('@s.whatsapp.net')) continue;

        const text = normalizeTextFromMessage(msg);
        if (!text) continue;

        const phone = extractPhoneFromJid(jid);
        const pushName = msg.pushName || 'Cliente';

        upsertClient(phone, pushName);
        touchConversation(phone);
        saveMessage(phone, 'user', text);

        log('MSG_IN', `Da +${phone}: ${text}`);

        if ((await handleAdminCommand(phone, text, sock.sendMessage.bind(sock), jid)) === true) {
          continue;
        }

        if (text.toLowerCase().trim() === 'confermo') {
          const confirmed = markAppointmentConfirmedByPhone(phone);
          if (confirmed) {
            await sock.sendMessage(jid, { text: 'Perfetto, presenza confermata ✅ A presto!' });
            continue;
          }
        }

        if (isGreeting(text)) {
          await sock.sendMessage(jid, { text: mainMenu(process.env.PT_NAME) });
          continue;
        }

        const conv = getConversation(phone);
        const explicitChoiceRaw = parseMenuChoice(text);
        const explicitChoice = ['1', '2', '3', '4', '5', '6'].includes(explicitChoiceRaw)
          ? explicitChoiceRaw
          : null;
        const inferredChoice = inferMenuChoiceFromText(text);
        const choice = explicitChoice || inferredChoice;

        if (choice === 'MENU') {
          await sock.sendMessage(jid, { text: mainMenu(process.env.PT_NAME) });
          continue;
        }

        if (conv.state === 'BOOKING_TYPE') {
          await handleBookingType(phone, text, sock.sendMessage.bind(sock), jid);
          continue;
        }

        if (conv.state === 'BOOKING_SLOT') {
          await handleBookingSlot(phone, text, sock.sendMessage.bind(sock), jid, pushName);
          continue;
        }

        if (conv.state === 'CONFIRMING') {
          await handleBookingConfirm(phone, text, sock.sendMessage.bind(sock), jid, pushName);
          continue;
        }

        if (conv.state === 'CANCEL_SELECT') {
          await handleCancelSelection(phone, text, sock.sendMessage.bind(sock), jid);
          continue;
        }

        if (choice === '1') {
          await startBookingFlow(phone, sock.sendMessage.bind(sock), jid);
          continue;
        }

        if (choice === '2') {
          await sock.sendMessage(jid, { text: 'Ti aiuto a recuperare una sessione saltata. Prima disdici quella attuale con opzione 4, poi prenotiamo il recupero.' });
          continue;
        }

        if (choice === '3') {
          await showAppointments(phone, sock.sendMessage.bind(sock), jid);
          continue;
        }

        if (choice === '4') {
          await startCancelFlow(phone, sock.sendMessage.bind(sock), jid);
          continue;
        }

        if (choice === '5') {
          await sock.sendMessage(jid, {
            text: `Ti metto in contatto con il coach ${process.env.PT_NAME}. Ti risponderà appena possibile 💬\n\nSe vuoi, puoi continuare ad usare il menu scrivendo 1-6 oppure "menu".`
          });
          continue;
        }

        if (choice === '6') {
          await sock.sendMessage(jid, {
            text: 'Capito 👍 Al momento non posso comunicare prezzi/listini in autonomia. Ti metto in contatto con il coach per i costi aggiornati.\n\nSe vuoi intanto prenotare, scrivi 1 oppure "prenotare". Se vuoi rivedere tutte le opzioni scrivi "menu".'
          });
          continue;
        }

        const aiText = await generateAIReply(phone, text);
        await sock.sendMessage(jid, { text: aiText });
      } catch (error) {
        log('MSG_ERR', 'Errore gestione messaggio', error.message);
        const jid = msg?.key?.remoteJid;
        if (jid) {
          await sock.sendMessage(jid, { text: genericError() });
          await sendMainMenu(sock.sendMessage.bind(sock), jid).catch(() => {});
        }
      }
    }
  });

  const sendTextByPhone = async (phone, text) => {
    try {
      await sock.sendMessage(toJid(phone), { text });
      log('MSG_OUT', `A +${phone}: ${text}`);
    } catch (error) {
      log('MSG_OUT_ERR', `Invio fallito a +${phone}`, error.message);
    }
  };

  return { sock, sendTextByPhone };
}

module.exports = {
  startBot
};
