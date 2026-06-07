# VSM BOT — Dashboard de gestion du chatbot WhatsApp

## Problem Statement (original)
> "Je travaille sur un projet pour mon chatbot comme support client de ma marque www.vsmcollection.com. Ce chatbot sera là pour répondre aux messages sur WhatsApp via Node.js. ... Je veux utiliser IA de Groq pour la partie bot, le reste de travail je le ferai sur VS Code, utilise React pour langage. Et le côté serveur doit être Node.js."

## Architecture livrée

| Couche | Stack | Localisation | Statut |
|---|---|---|---|
| Dashboard React | React 19 + Tailwind + shadcn + Lucide | `/app/frontend/` | ✅ Live |
| Backend démo (preview Emergent) | FastAPI + Python + Groq SDK + MongoDB | `/app/backend/` | ✅ Live |
| Backend Node.js (production VS Code) | Node 18 + Express + Groq SDK + Multer + MongoDB | `/app/server-nodejs/` | ✅ Code prêt |
| IA | Groq (llama-3.1-8b-instant + llama-3.3-70b-versatile + Whisper Large v3) | API key dans `.env` | ✅ Connectée |

Les deux backends (FastAPI ici / Node.js pour VS Code) exposent **exactement les mêmes endpoints `/api/*`** afin que le frontend React fonctionne avec l'un ou l'autre sans modification.

## Personas
- **Admin VSM (toi)** : pilote le bot, ajuste le prompt, surveille les conversations.
- **Client WhatsApp** : envoie texte/notes vocales, reçoit des réponses du bot.

## Identité visuelle
- Palette : `#080808` (black) · `#c8a96e` (gold) · `#f0ede8` (cream)
- Fonts : Bebas Neue (display) · Outfit (body) · JetBrains Mono (logs/tech)
- Esthétique : luxury streetwear, sharp edges, grain subtle, hairline gold borders

## Implémenté (07/06/2026)
- ✅ Dashboard React responsive (sidebar drawer mobile, hamburger, overlay)
- ✅ 8 sections : Overview, Conversations, Playground, Instructions IA, WhatsApp, Config API, Comportement, Logs
- ✅ KPIs animés + graph d'activité 7 jours
- ✅ Playground : test direct du bot (texte + enregistrement vocal MediaRecorder + import audio)
- ✅ Intégration Groq (chat + Whisper transcription) testée — réponse réelle en ~355ms
- ✅ MongoDB persistence (config, conversations, messages)
- ✅ Backend Node.js complet livré dans `/app/server-nodejs/` (Express + Groq SDK + Multer + webhook Meta)
- ✅ Webhook WhatsApp Cloud API (Meta) prêt à brancher dans `whatsapp.js`
- ✅ 13/13 tests backend pytest passés · UI desktop & mobile validés

## Backlog (P0/P1/P2)
- **P0** — Brancher WhatsApp Cloud API en prod (Meta Business : récupérer `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, configurer webhook)
- **P1** — Connecter une vraie base de données produits (Supabase ou MongoDB) pour les images & prix VSM
- **P1** — Ajouter envoi d'image produit via WhatsApp (Meta API media upload)
- **P2** — Streaming des réponses Groq (SSE) dans le Playground
- **P2** — Authentification admin sur le dashboard (Emergent Google Auth ou JWT)
- **P2** — Analytics avancées (par produit, conversion, taux d'engagement)
- **P2** — Multi-langue (Lingala, EN) avec détection automatique

## Endpoints exposés
- `GET/POST /api/config`
- `POST /api/chat`
- `POST /api/transcribe` (multipart)
- `GET /api/conversations`, `GET /api/conversations/:id/messages`, `DELETE /api/conversations/:id`
- `GET /api/stats`
- `GET/DELETE /api/logs`, `POST /api/logs/simulate`
- `POST /api/whatsapp/connect|disconnect`
- `GET/POST /api/whatsapp/webhook` (Node.js only — Meta)

## Pour copier dans VS Code
```bash
cp -r /app/server-nodejs/ ~/Desktop/vsm-bot-server/
cd ~/Desktop/vsm-bot-server/
cp .env.example .env
npm install && npm run dev
```
Mettre `REACT_APP_BACKEND_URL=http://localhost:3001` dans le `.env` du frontend.
