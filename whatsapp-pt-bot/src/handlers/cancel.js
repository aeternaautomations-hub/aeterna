// src/handlers/cancel.js
const { deleteCalendarEvent, getAvailableSlotsNext7Days } = require('../calendar');
const {
  getUpcomingAppointmentsByPhone,
  markAppointmentCancelled,
  setConversationState,
  getConversation
} = require('../database');
const { dayjs, formatDateTime } = require('../utils/helpers');

async function startCancelFlow(phone, sendMessage, jid) {
  const appointments = getUpcomingAppointmentsByPhone(phone);
  if (!appointments.length) {
    await sendMessage(jid, { text: 'Non vedo appuntamenti futuri da disdire.' });
    return;
  }

  const text = appointments
    .map((a, i) => `${i + 1}) ${formatDateTime(a.start_time)} - ${a.session_type}`)
    .join('\n');

  setConversationState(phone, 'CANCEL_SELECT', { appointments });
  await sendMessage(jid, { text: `Quale appuntamento vuoi disdire?\n${text}` });
}

async function handleCancelSelection(phone, text, sendMessage, jid) {
  const conv = getConversation(phone);
  const stateData = JSON.parse(conv.state_data || '{}');
  const idx = Number(text.trim()) - 1;
  const appointment = stateData.appointments?.[idx];

  if (!appointment) {
    await sendMessage(jid, { text: 'Scelta non valida, inserisci il numero corretto.' });
    return;
  }

  const hoursLeft = dayjs(appointment.start_time).diff(dayjs(), 'hour', true);
  let penaltyMessage = '';
  if (hoursLeft < 12) {
    penaltyMessage = '\n⚠️ Nota: cancellazione sotto le 12h, verrà applicata una penale.';
  }

  await deleteCalendarEvent(appointment.event_id);
  markAppointmentCancelled(appointment.id);

  const alternatives = await getAvailableSlotsNext7Days(appointment.session_type, 60);
  const altText = alternatives.slice(0, 3).map((s, i) => `${i + 1}) ${formatDateTime(s.start)}`).join('\n') || 'Nessuno slot alternativo trovato.';

  setConversationState(phone, 'IDLE', {});
  await sendMessage(jid, {
    text: `✅ Appuntamento disdetto.${penaltyMessage}\n\nEcco 3 alternative per il recupero:\n${altText}`
  });
}

module.exports = {
  handleCancelSelection,
  startCancelFlow
};
