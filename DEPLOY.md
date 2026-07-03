# Déploiement VSM Bot — Production

## 1. Supabase

1. Exécute `server-nodejs/supabase-schema.sql` dans le SQL Editor Supabase.
2. Vérifie que les tables e-commerce `products` et `product_variants` existent.
3. Active Realtime sur `bot_config`, `whatsapp_sessions`, `messages`, `logs`.

## 2. Bot WhatsApp — Railway (recommandé)

Voir le guide détaillé : **`server-nodejs/RAILWAY.md`**

Résumé :

1. Railway → New Project → GitHub → repo `Assistant-ia`
2. **Root Directory** : `server-nodejs`
3. Ajoute un **Volume** monté sur `/data` (session WhatsApp persistante)
4. Variables : `SUPABASE_*`, `GROQ_API_KEY`, `CORS_ORIGINS`, `SITE_URL`
5. Génère un **domaine public** Railway → copie l'URL dans `REACT_APP_NODE_URL` (Vercel)

Le `Dockerfile` inclut Node 20 + Chromium. Pas besoin de VPS manuel.

### Alternative : VPS Linux

```bash
cd server-nodejs
cp .env.example .env
npm ci
npm start
# PM2 : pm2 start src/server.js --name vsm-bot
```

## 3. Dashboard React — Vercel

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
