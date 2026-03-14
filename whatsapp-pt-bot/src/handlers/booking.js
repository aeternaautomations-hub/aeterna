// src/handlers/booking.js
const {
  createAppointment,
  getConversation,
  setConversationState,
  upsertClient
} = require('../database');
const { createCalendarEvent, getAvailableSlotsNext7Days } = require('../calendar');
const { availabilityMenu, bookingConfirmation, sessionTypesMenu } = require('../utils/messages');

const SESSION_TYPES = {
  '1': 'Functional',
  '2': 'Forza',
  '3': 'Cardio',
  '4': 'Mobilità',
  '5': 'Stretching',
  functional: 'Functional',
  forza: 'Forza',
  cardio: 'Cardio',
  mobilità: 'Mobilità',
  mobilita: 'Mobilità',
  stretching: 'Stretching'
};

async function startBookingFlow(phone, sendMessage, jid) {
  setConversationState(phone, 'BOOKING_TYPE', {});
  await sendMessage(jid, { text: sessionTypesMenu() });
}

async function handleBookingType(phone, text, sendMessage, jid) {
  const normalized = text.toLowerCase().trim();
  const sessionType = SESSION_TYPES[normalized];

  if (!sessionType) {
    await sendMessage(jid, { text: 'Scelta non valida. Inserisci un numero da 1 a 5.' });
    return;
  }

  const slots = await getAvailableSlotsNext7Days(sessionType, 60);
  setConversationState(phone, 'BOOKING_SLOT', { sessionType, slots });
  await sendMessage(jid, { text: availabilityMenu(slots) });
}

async function handleBookingSlot(phone, text, sendMessage, jid, pushName = 'Cliente') {
  const conv = getConversation(phone);
  const stateData = JSON.parse(conv.state_data || '{}');
  const index = Number(text.trim()) - 1;

  if (!stateData.slots || !stateData.slots[index]) {
    await sendMessage(jid, { text: 'Numero slot non valido. Riprova con il numero corretto.' });
    return;
  }

  const selected = stateData.slots[index];
  setConversationState(phone, 'CONFIRMING', {
    sessionType: stateData.sessionType,
    selected
  });

  await sendMessage(jid, {
    text: `Confermi la prenotazione?
Tipo: ${stateData.sessionType}
Quando: ${selected.start}

Rispondi con SI oppure NO.`
  });

  upsertClient(phone, pushName);
}

async function handleBookingConfirm(phone, text, sendMessage, jid, pushName = 'Cliente') {
  const conv = getConversation(phone);
  const stateData = JSON.parse(conv.state_data || '{}');
  const answer = text.toLowerCase().trim();

  if (answer !== 'si' && answer !== 'sì' && answer !== 'no') {
    await sendMessage(jid, { text: 'Rispondi con SI per confermare oppure NO per annullare.' });
    return;
  }

  if (answer === 'no') {
    setConversationState(phone, 'IDLE', {});
    await sendMessage(jid, { text: 'Nessun problema! Scrivi 1 quando vuoi riprovare.' });
    return;
  }

  const event = await createCalendarEvent({
    sessionType: stateData.sessionType,
    clientName: pushName,
    phone,
    startTime: stateData.selected.start,
    endTime: stateData.selected.end
  });

  const appointment = createAppointment({
    event_id: event.id,
    phone,
    client_name: pushName,
    session_type: stateData.sessionType,
    start_time: stateData.selected.start,
    end_time: stateData.selected.end
  });

  setConversationState(phone, 'IDLE', {});
  await sendMessage(jid, {
    text: bookingConfirmation(
      {
        id: appointment.id,
        sessionType: appointment.session_type,
        startTime: appointment.start_time
      },
      process.env.PT_ADDRESS
    )
  });
}

module.exports = {
  handleBookingConfirm,
  handleBookingSlot,
  handleBookingType,
  startBookingFlow
};
