// src/handlers/appointments.js
const { getFutureEventsByPhone } = require('../calendar');
const { formatDateTime } = require('../utils/helpers');

async function showAppointments(phone, sendMessage, jid) {
  const events = await getFutureEventsByPhone(phone);

  if (!events.length) {
    await sendMessage(jid, { text: 'Non hai appuntamenti futuri al momento.' });
    return;
  }

  const text = events
    .map((e, i) => `${i + 1}) ${formatDateTime(e.start.dateTime)} - ${e.summary}`)
    .join('\n');

  await sendMessage(jid, { text: `📅 I tuoi prossimi appuntamenti:\n${text}` });
}

module.exports = {
  showAppointments
};
