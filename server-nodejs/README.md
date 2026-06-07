# VSM Bot — Backend Node.js (Production)

Backend Node.js / Express prêt à être déployé pour la marque **VSM Collection**.
Gère le bot WhatsApp avec **Groq AI** (texte + transcription vocale Whisper).

## 🚀 Démarrage rapide

```bash
cd server-nodejs
cp .env.example .env       # éditer les clés
npm install
npm run dev                # ou npm start
```

Le serveur démarre sur `http://localhost:3001/api`.

## 🔑 Variables d'environnement

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Clé Groq (https://console.groq.com/keys) |
| `GROQ_TEXT_MODEL` | Modèle principal (`llama-3.1-8b-instant`) |
| `GROQ_FALLBACK_MODEL` | Fallback (`llama-3.3-70b-versatile`) |
| `GROQ_WHISPER_MODEL` | Modèle Whisper (`whisper-large-v3`) |
| `MONGO_URL` | Optionnel — sinon storage en mémoire |
| `WHATSAPP_TOKEN` | Token WhatsApp Cloud API (Meta) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID du numéro Meta |
| `WHATSAPP_VERIFY_TOKEN` | Token de vérification webhook |

## 📡 Endpoints exposés

- `GET  /api/config` / `POST /api/config`
- `POST /api/chat` — { message, history, conversation_id }
- `POST /api/transcribe` — multipart audio
- `GET  /api/conversations` / `GET /api/conversations/:id/messages`
- `GET  /api/stats`
- `GET/DELETE /api/logs` / `POST /api/logs/simulate`
- `POST /api/whatsapp/connect|disconnect`
- `GET/POST /api/whatsapp/webhook` (Meta Cloud API)

## 🔌 Brancher WhatsApp Business (Meta)

1. Créer un compte sur https://business.facebook.com/
2. Activer WhatsApp Cloud API et récupérer `WHATSAPP_TOKEN` + `PHONE_NUMBER_ID`
3. Dans la console Meta → Webhooks → URL :
   `https://ton-domaine.com/api/whatsapp/webhook`
   Verify Token : valeur de `WHATSAPP_VERIFY_TOKEN`
4. S'abonner aux événements `messages`

## 🎨 Frontend React

Le dashboard React (`/app/frontend/`) communique avec ces endpoints.
Pour le connecter à ce backend Node.js, mets dans `frontend/.env` :

```
REACT_APP_BACKEND_URL=http://localhost:3001
```

## 🧱 Structure

```
server-nodejs/
├── package.json
├── .env.example
├── README.md
└── src/
    ├── server.js       # Entrée Express + routes
    ├── config.js       # Config par défaut + prompt VSM
    ├── logs.js         # Logs in-memory
    └── whatsapp.js     # Webhook Meta + transcription audio
```

Made in DRC · Worn Worldwide.
