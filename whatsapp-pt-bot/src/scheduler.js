// src/scheduler.js
const cron = require('node-cron');
const { generatePreWorkoutTip } = require('./ai');
const {
  getRemindersCandidates,
  hasReminderBeenSent,
  logReminder,
  resetInactiveConversations
} = require('./database');
const { dayjs, formatDateTime, log } = require('./utils/helpers');

function createScheduler(sendTextByPhone) {
  const timezone = process.env.TIMEZONE || 'Europe/Rome';

  cron.schedule('0 * * * *', async () => {
    try {
      log('SCHEDULER', 'Avvio controllo promemoria orario');

      const resetCount = resetInactiveConversations(30);
      if (resetCount > 0) {
        log('SCHEDULER', `Conversazioni resettate per timeout: ${resetCount}`);
      }

      const appointments = getRemindersCandidates();
      for (const appt of appointments) {
        const hoursLeft = dayjs(appt.start_time).diff(dayjs(), 'hour', true);

        if (hoursLeft <= 24 && hoursLeft > 23 && !hasReminderBeenSent(appt.id, 'REMINDER_24H')) {
          const msg = `⏰ Promemoria: domani hai una sessione ${appt.session_type} alle ${formatDateTime(appt.start_time)} presso ${process.env.PT_ADDRESS}.`;
          await sendTextByPhone(appt.phone, msg);
          logReminder(appt.id, 'REMINDER_24H');
        }

        if (hoursLeft <= 2 && hoursLeft > 1 && !hasReminderBeenSent(appt.id, 'REMINDER_2H')) {
          const tip = await generatePreWorkoutTip(appt.session_type);
          const msg = `🚀 Manca poco alla tua sessione delle ${formatDateTime(appt.start_time)}.\nConsiglio pre-allenamento: ${tip}\n\nRispondi con CONFERMO.`;
          await sendTextByPhone(appt.phone, msg);
          logReminder(appt.id, 'REMINDER_2H');
        }

        if (hoursLeft <= 1 && hoursLeft > 0 && appt.confirmed === 0 && !hasReminderBeenSent(appt.id, 'FOLLOWUP_1H')) {
          await sendTextByPhone(appt.phone, 'Ti leggo silenzioso: riesci a confermare la presenza? 💬');
          logReminder(appt.id, 'FOLLOWUP_1H');
        }
      }

      log('SCHEDULER', 'Controllo promemoria completato');
    } catch (error) {
      log('SCHEDULER', 'Errore nel job promemoria', error.message);
    }
  }, { timezone });

  log('SCHEDULER', 'Scheduler attivo (ogni ora, minuto 0)');
}

module.exports = {
  createScheduler
};
