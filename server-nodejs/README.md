# VSM Bot — Backend Node.js (Production)

WhatsApp customer support bot pour **VSM Collection**.
Stack : **whatsapp-web.js** (non-officiel) + **Groq AI** + **Supabase**.

## ⚡ Installation (sur ton poste local / VS Code / VPS)

```bash
cd server-nodejs
cp .env.example .env
# ouvre .env et complète SUPABASE_SERVICE_KEY (et autres si besoin)
npm install
npm start
```

Le serveur tourne sur `http://localhost:3001` et :
1. Génère un **QR code** → écrit dans Supabase table `whatsapp_sessions`
2. Le dashboard React le récupère en temps réel et l'affiche
3. Tu scannes avec WhatsApp → bot prêt
4. Tous les messages reçus déclenchent une réponse Groq, et sont stockés dans Supabase

## 🔑 Pré-requis

1. **Coller le schéma SQL** dans Supabase :
   - Ouvre `supabase-schema.sql`
   - Supabase Dashboard → SQL Editor → New query → coller → Run

2. **Récupérer la SERVICE ROLE KEY** :
   - Supabase Dashboard → Settings → API
   - Section "Project API keys" → copier `service_role` (secret)
   - La mettre dans `.env` → `SUPABASE_SERVICE_KEY=...`
   - ⚠️ NE JAMAIS exposer cette clé côté frontend

3. **Numéro WhatsApp dédié** au bot (pas ton numéro perso, pour limiter le risque de ban).

## 🛡️ Mesures anti-bannissement (déjà appliquées)

| Mesure | Détail |
|---|---|
| Session persistante | `LocalAuth` → 1 seul scan, ensuite reconnexion auto |
| Délai humain | 1.2 → 2.8 s aléatoire avant chaque réponse |
| Indicateur "en train d'écrire" | `chat.sendStateTyping()` |
| Rate limit | 30 réponses/min max (configurable `WA_RATE_LIMIT_PER_MIN`) |
| Ignore groupes | Activé par défaut (toggle dans le dashboard) |
| Ignore messages > 30 s | Pas de replays anciens |
| Ignore propres messages & statuts | Pas de boucle |
| Reconnexion auto | Sur disconnect → restart 5 s plus tard |

## 📡 Endpoints

- `GET  /api/health` → état serveur + WhatsApp ready ?
- `GET  /api/status` → numéro connecté
- `POST /api/logout` → purge session + force re-scan

Toutes les autres données (config, conversations, messages, logs) passent
directement via Supabase — pas besoin de REST API.

## 📂 Structure

```
server-nodejs/
├── supabase-schema.sql       ← À coller dans Supabase
├── package.json
├── .env.example
├── README.md
└── src/
    ├── server.js             ← Entrée Express + boot WhatsApp
    ├── whatsapp-client.js    ← whatsapp-web.js + handler messages
    ├── groq.js               ← Chat + Whisper
    ├── supabase.js           ← Client + helpers DB
    └── logger.js             ← Logs → Supabase + console
```

## 🐧 Pré-requis Chromium (Linux/VPS)

whatsapp-web.js utilise Puppeteer (Chromium headless). Sur un serveur Linux :

```bash
sudo apt install -y chromium-browser \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 \
  libpango-1.0-0 libatk1.0-0 libcairo2 libcups2
```

Sur macOS / Windows : Puppeteer installe Chromium automatiquement.

## 🔗 Connecter le dashboard React

Le dashboard utilise déjà la clé Supabase **anon** côté frontend. Aucun lien direct
entre le frontend et ce backend Node.js — tout passe par Supabase Realtime.

Tu peux donc déployer ce backend où tu veux (VPS, machine locale, Docker) sans
exposer aucun port à internet, tant qu'il a accès à Supabase et à Groq.

Made in DRC · Worn Worldwide.
