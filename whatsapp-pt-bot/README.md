<!-- README.md -->
# WhatsApp PT Bot (Raspberry Pi 3)

Bot WhatsApp demo commerciale per Personal Trainer, ottimizzato per **Raspberry Pi 3** (Bullseye/Bookworm 64bit).

## Stack usato
- **Baileys** (`@whiskeysockets/baileys`) per connessione WhatsApp nativa (senza browser)
- **Node.js 18+**
- **OpenAI API** (`gpt-4o-mini`)
- **Google Calendar API v3** con **Service Account** (no OAuth interattivo)
- **SQLite** con `better-sqlite3`
- **PM2** per process management

---

## 1) Prerequisiti Raspberry Pi 3
```bash
sudo apt-get update
sudo apt-get install -y curl git build-essential python3 make g++
```

Installa Node.js 18:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

---

## 2) Setup progetto
```bash
git clone <REPO_URL>
cd whatsapp-pt-bot
npm install
cp .env.example .env
```

Compila `.env`:
```env
OPENAI_API_KEY=sk-...
GOOGLE_CALENDAR_ID=...@group.calendar.google.com
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PT_NAME=Marco Rossi
PT_ADDRESS=Via Roma 10, Milano
ADMIN_PHONE=39XXXXXXXXXX
SESSION_NAME=pt-bot-demo
PORT=3000
TIMEZONE=Europe/Rome
```

> Nota: nel `.env`, `GOOGLE_PRIVATE_KEY` deve mantenere i `\n`.

---

## 3) Setup Google Calendar con Service Account (headless)

### Passo A — Crea progetto su Google Cloud
1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea (o seleziona) un progetto
3. Abilita API: **Google Calendar API**

### Passo B — Crea Service Account
1. `IAM & Admin` → `Service Accounts`
2. `Create Service Account`
3. Nome ad esempio: `pt-bot-service`
4. Crea e continua (ruoli minimi: `Editor` sul calendario target o gestione via share calendar)

### Passo C — Genera chiave JSON
1. Apri il Service Account creato
2. `Keys` → `Add Key` → `Create new key`
3. Seleziona `JSON` e scarica il file

Dal JSON estrai:
- `client_email` → `GOOGLE_CLIENT_EMAIL`
- `private_key` → `GOOGLE_PRIVATE_KEY` (con newline escapati come `\n`)

### Passo D — Condividi il calendario
1. Apri Google Calendar (web)
2. Seleziona il calendario usato dal PT
3. `Impostazioni e condivisione` → `Condividi con persone specifiche`
4. Aggiungi `client_email` del service account
5. Permesso: `Apporta modifiche agli eventi`

### Passo E — Recupera Calendar ID
In impostazioni calendario, copia `ID calendario` e incollalo in `GOOGLE_CALENDAR_ID`.

---

## 4) Avvio bot
```bash
npm start
```
Al primo avvio vedrai il **QR code** nel terminale: scansiona con WhatsApp.

La sessione viene salvata in:
- `./auth_info_baileys/`

Quindi ai riavvii non serve una nuova scansione (se la sessione non viene invalidata).

---

## 5) Avvio con PM2 (consigliato produzione/demo)
```bash
sudo npm install -g pm2
./scripts/start-pm2.sh
pm2 logs whatsapp-pt-bot
```

Il processo parte con:
- `--max-old-space-size=512` (ottimizzazione memoria RPi3)

---

## 6) Funzioni implementate
- Menu principale in italiano
- Prenotazione sessione con scelta tipo e slot (Google Calendar)
- Salvataggio locale su SQLite (`data.sqlite`)
- Promemoria automatici ogni ora:
  - 24h prima
  - 2h prima con consiglio AI
  - follow-up se manca conferma
- Disdetta con regola 12h + proposta 3 slot recupero
- Visualizzazione appuntamenti futuri
- Fallback AI OpenAI su messaggi liberi
- Stato conversazione persistente con timeout 30 minuti
- Comandi admin:
  - `!stats`
  - `!clienti`
  - `!reset 39XXXXXXXXXX`

---

## 7) Troubleshooting rapido
- **QR non compare**: verifica terminale TTY e log `pm2 logs`
- **Errori Google Calendar**: verifica condivisione calendario al service account
- **OpenAI error**: verifica API key e credito
- **Memoria RPi3**: chiudi servizi non necessari, usa PM2 con limite memoria già impostato

---

## 8) Struttura
```text
whatsapp-pt-bot/
├── package.json
├── .env.example
├── README.md
├── src/
│   ├── index.js
│   ├── bot.js
│   ├── ai.js
│   ├── calendar.js
│   ├── database.js
│   ├── scheduler.js
│   ├── handlers/
│   │   ├── menu.js
│   │   ├── booking.js
│   │   ├── cancel.js
│   │   ├── appointments.js
│   │   └── admin.js
│   └── utils/
│       ├── messages.js
│       └── helpers.js
└── scripts/
    ├── setup.sh
    └── start-pm2.sh
```
