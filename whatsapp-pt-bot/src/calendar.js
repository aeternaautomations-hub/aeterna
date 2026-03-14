// src/calendar.js
const { google } = require('googleapis');
const { dayjs, log } = require('./utils/helpers');

let calendarClient;

function getCalendarClient() {
  if (calendarClient) return calendarClient;

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });

  calendarClient = google.calendar({ version: 'v3', auth });
  return calendarClient;
}

async function listEventsBetween(timeMin, timeMax) {
  const calendar = getCalendarClient();
  const res = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime'
  });
  return res.data.items || [];
}

async function getAvailableSlotsNext7Days(sessionType, durationMinutes = 60) {
  const tz = process.env.TIMEZONE || 'Europe/Rome';
  const start = dayjs().tz(tz).startOf('hour').add(1, 'hour');
  const end = start.add(7, 'day');

  const events = await listEventsBetween(start.toISOString(), end.toISOString());
  const busyIntervals = events.map((e) => ({
    start: dayjs(e.start.dateTime || e.start.date),
    end: dayjs(e.end.dateTime || e.end.date)
  }));

  const slots = [];
  let cursor = start;

  while (cursor.isBefore(end) && slots.length < 12) {
    const hour = cursor.hour();
    const isWorkHour = hour >= 8 && hour < 20;
    const isValidDay = cursor.day() >= 1 && cursor.day() <= 6;
    const slotEnd = cursor.add(durationMinutes, 'minute');

    if (isWorkHour && isValidDay) {
      const overlaps = busyIntervals.some((b) => cursor.isBefore(b.end) && slotEnd.isAfter(b.start));
      if (!overlaps) {
        slots.push({
          start: cursor.toISOString(),
          end: slotEnd.toISOString(),
          typeLabel: sessionType
        });
      }
    }

    cursor = cursor.add(1, 'hour');
  }

  return slots;
}

async function createCalendarEvent({ sessionType, clientName, phone, startTime, endTime }) {
  const calendar = getCalendarClient();
  const event = {
    summary: `Sessione ${sessionType} - ${clientName}`,
    description: `Cliente WhatsApp: +${phone}`,
    start: { dateTime: startTime, timeZone: process.env.TIMEZONE || 'Europe/Rome' },
    end: { dateTime: endTime, timeZone: process.env.TIMEZONE || 'Europe/Rome' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 24 * 60 },
        { method: 'popup', minutes: 120 }
      ]
    }
  };

  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: event
  });

  log('CALENDAR', `Evento creato ${res.data.id}`);
  return res.data;
}

async function deleteCalendarEvent(eventId) {
  const calendar = getCalendarClient();
  await calendar.events.delete({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    eventId
  });
}

async function getFutureEventsByPhone(phone) {
  const events = await listEventsBetween(dayjs().toISOString(), dayjs().add(180, 'day').toISOString());
  return events.filter((e) => (e.description || '').includes(phone));
}

module.exports = {
  createCalendarEvent,
  deleteCalendarEvent,
  getAvailableSlotsNext7Days,
  getFutureEventsByPhone
};
