// src/ai.js
const OpenAI = require('openai');
const { getRecentMessages, saveMessage } = require('./database');

let openaiClient = null;

function getOpenAIClient() {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY mancante nel file .env');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

function buildSystemPrompt() {
  return `Sei l'assistente virtuale di ${process.env.PT_NAME}, un personal trainer professionale.
Sei cordiale, motivante e conciso. Rispondi sempre in italiano.
Puoi rispondere a domande su allenamento, nutrizione di base, recupero muscolare.
Se la domanda riguarda una prenotazione, invita l'utente a usare il menu.
Non inventare prezzi o disponibilità.`;
}

async function generateAIReply(phone, userMessage) {
  const client = getOpenAIClient();

  saveMessage(phone, 'user', userMessage);
  const history = getRecentMessages(phone, 5);

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history,
    { role: 'user', content: userMessage }
  ];

  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.6,
    messages
  });

  const text = res.choices?.[0]?.message?.content?.trim() || 'Al momento non riesco a rispondere, riprova tra poco.';
  saveMessage(phone, 'assistant', text);
  return text;
}

async function generatePreWorkoutTip(sessionType) {
  const client = getOpenAIClient();

  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: 'Sei un personal trainer. Dai un solo consiglio pre-allenamento, pratico e breve (max 30 parole), in italiano.'
      },
      {
        role: 'user',
        content: `Dammi un consiglio pre-allenamento per una sessione di tipo: ${sessionType}.`
      }
    ]
  });

  return res.choices?.[0]?.message?.content?.trim() || 'Ricordati di idratarti e fare 5 minuti di riscaldamento leggero.';
}

module.exports = {
  generateAIReply,
  generatePreWorkoutTip
};
