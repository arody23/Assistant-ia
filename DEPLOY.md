# Déploiement VSM Bot — Production

## 1. Supabase

1. Exécute `server-nodejs/supabase-schema.sql` dans le SQL Editor Supabase.
2. Vérifie que les tables e-commerce `products` et `product_variants` existent.
3. Active Realtime sur `bot_config`, `whatsapp_sessions`, `messages`, `logs`.

## 2. Serveur Node.js (bot WhatsApp) — obligatoire

Héberge sur un VPS Windows ou Linux avec Chrome/Chromium installé.

```bash
cd server-nodejs
cp .env.example .env
# Remplis SUPABASE_URL, SUPABASE_SERVICE_KEY, GROQ_API_KEY
npm ci
npm start
```

**Production** : utilise PM2 ou systemd pour garder le processus actif.

```bash
npm install -g pm2
pm2 start src/server.js --name vsm-bot
pm2 save
```

Variables importantes :
- `PORT=3002`
- `SITE_URL=https://www.vsmcollection.com`
- `CORS_ORIGINS=https://ton-dashboard.vercel.app`

## 3. Dashboard React

```bash
cd frontend
cp .env.example .env
# REACT_APP_SUPABASE_* + REACT_APP_NODE_URL=https://ton-serveur-bot:3002
npm ci --legacy-peer-deps
npm run build
```

Déploie le dossier `build/` sur **Vercel**, **Netlify** ou ton hébergeur statique.

## 4. Backend Python (optionnel)

Uniquement pour le **Playground** de test dans le dashboard.

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 3001
```

## 5. Personnalisation sans code

Tout se configure depuis le dashboard :

| Section | Contenu |
|---------|---------|
| **Instructions IA** | Prompt principal, prompts séparés (vision, archivé, hors catalogue), mots-clés, collections archivées |
| **Comportement** | Langues multiples, ton, longueur, emojis, toggles bot |
| **Config API** | Modèles Groq, tokens, température, délai de réponse |
| **WhatsApp** | Scan QR, reset session |

## 6. Checklist post-déploiement

- [ ] Bot Node répond sur `/api/health` → `ok: true`
- [ ] QR scanné → statut `ready` dans le dashboard
- [ ] Test message WhatsApp → réponse Groq
- [ ] Dashboard accessible en HTTPS
