// src/handlers/menu.js
const { mainMenu } = require('../utils/messages');

async function sendMainMenu(sendMessage, jid) {
  await sendMessage(jid, { text: mainMenu(process.env.PT_NAME) });
}

module.exports = {
  sendMainMenu
};
