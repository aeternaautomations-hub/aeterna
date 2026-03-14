// src/utils/messages.js
const { formatDateTime } = require('./helpers');

function mainMenu(ptName) {
  return `Ciao! 💪 Sono l'assistente virtuale di ${ptName}.
Come posso aiutarti?

1️⃣ Prenota una sessione
2️⃣ Recupera una sessione saltata
3️⃣ Vedi i tuoi appuntamenti
4️⃣ Disdici un appuntamento
5️⃣ Parla con il coach
6️⃣ Info e prezzi`;
}

function sessionTypesMenu() {
  return `Perfetto! Scegli il tipo di sessione:
1) Functional
2) Forza
3) Cardio
4) Mobilità
5) Stretching`;
}

function availabilityMenu(slots) {
  if (!slots.length) {
    return 'Al momento non ci sono slot disponibili nei prossimi 7 giorni. Vuoi parlare con il coach (5)?';
  }

  const rows = slots.map((slot, i) => `${i + 1}) ${formatDateTime(slot.start)} - ${slot.typeLabel || 'Sessione'}`);
  return `Ecco gli slot liberi disponibili:
${rows.join('\n')}
\nScrivi il numero dello slot che preferisci.`;
}

function bookingConfirmation(booking, ptAddress) {
  return `✅ Prenotazione confermata!

Tipo: ${booking.sessionType}
Data: ${formatDateTime(booking.startTime)}
Luogo: ${ptAddress}
ID prenotazione: ${booking.id}

Ti invierò un promemoria 24h e 2h prima.`;
}

function genericError() {
  return 'Mi dispiace, al momento c\'è un problema tecnico. Riprova tra poco 🙏';
}

module.exports = {
  availabilityMenu,
  bookingConfirmation,
  genericError,
  mainMenu,
  sessionTypesMenu
};
