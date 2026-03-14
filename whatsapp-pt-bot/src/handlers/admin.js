// src/handlers/admin.js
const { getClientsWithSessions, getStats, setConversationState } = require('../database');
const { normalizePhone } = require('../utils/helpers');

function isAdmin(phone) {
  return normalizePhone(phone) === normalizePhone(process.env.ADMIN_PHONE || '');
}

async function handleAdminCommand(phone, text, sendMessage, jid) {
  if (!isAdmin(phone)) return false;

  const command = text.trim();

  if (command === '!stats') {
    const stats = getStats();
    await sendMessage(jid, {
      text: `📊 Statistiche\nPrenotazioni oggi: ${stats.today}\nPrenotazioni settimana: ${stats.week}\nTotale clienti: ${stats.clients}`
    });
    return true;
  }

  if (command === '!clienti') {
    const clients = getClientsWithSessions();
    const lines = clients.map((c) => `+${c.phone} (${c.name || 'Sconosciuto'}): ${c.sessions} sessioni`).join('\n');
    await sendMessage(jid, { text: `👥 Clienti\n${lines || 'Nessun cliente.'}` });
    return true;
  }

  if (command.startsWith('!reset')) {
    const parts = command.split(' ');
    const target = normalizePhone(parts[1] || '');
    if (!target) {
      await sendMessage(jid, { text: 'Uso corretto: !reset 39XXXXXXXXXX' });
      return true;
    }
    setConversationState(target, 'IDLE', {});
    await sendMessage(jid, { text: `Stato resettato per +${target}` });
    return true;
  }

  return false;
}

module.exports = {
  handleAdminCommand,
  isAdmin
};
