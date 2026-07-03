# Déploiement Railway — Bot WhatsApp VSM

Le bot **doit** tourner 24/7 avec Chromium. Railway convient ; Vercel ne convient pas.

## Architecture

```
Vercel (frontend)  →  Supabase  ←  Railway (server-nodejs)
                              ↘
                               Groq API
```

| Service | Hébergeur | Dossier |
|---------|-----------|---------|
| Dashboard React | **Vercel** | `frontend/` |
| Bot WhatsApp | **Railway** | `server-nodejs/` |
| Base de données | **Supabase** | — |

---

## 1. Créer le service Railway

1. Va sur [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → sélectionne `arody23/Assistant-ia`
3. **Settings → Root Directory** : `server-nodejs`
4. Railway détecte le `Dockerfile` et `railway.toml` automatiquement

---

## 2. Volume persistant (session WhatsApp)

Sans volume, tu devras **re-scanner le QR** à chaque redéploiement.

1. Railway → ton service → **Volumes** → **Add Volume**
2. **Mount path** : `/data`
3. Variable d'environnement (déjà dans le Dockerfile) :
   ```
   WA_SESSION_DIR=/data/.wwebjs_auth
   ```

---

## 3. Variables d'environnement Railway ⚠️ OBLIGATOIRE

**Sans ces variables, le build réussit mais le bot ne démarre pas.**

1. Railway → ton service → **Variables**
2. Clique **Raw Editor** et colle le contenu de `railway.variables.example`
3. Remplace :
   - `YOUR_SUPABASE_SERVICE_ROLE_KEY` → Supabase → Settings → API → **service_role** (secret)
   - `YOUR_GROQ_API_KEY` → [console.groq.com](https://console.groq.com)
   - `CORS_ORIGINS` → ton URL Vercel (ou `*` temporairement)
4. Clique **Deploy** / **Redeploy**

| Variable | Obligatoire | Où la trouver |
|----------|-------------|---------------|
| `SUPABASE_URL` | ✅ | Supabase → Settings → API |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase → service_role (secret) |
| `GROQ_API_KEY` | ✅ | console.groq.com |
| `SITE_URL` | recommandé | https://www.vsmcollection.com |
| `CORS_ORIGINS` | recommandé | URL Vercel du dashboard |
| `WA_SESSION_DIR` | recommandé | `/data/.wwebjs_auth` |

> `PORT` est injecté par Railway — **ne pas le définir**.

> **Ne pas** définir `PUPPETEER_EXECUTABLE_PATH` sur Railway.

**Vérification** après deploy :
```
https://TON-URL-RAILWAY/api/health
→ {"ok":true,"ready":false}  (ok:true = variables OK, ready:true après scan QR)
→ {"ok":false,"missing":["SUPABASE_URL",...]}  (ajoute les variables manquantes)
```

---

## 4. Domaine public

1. Railway → **Settings → Networking** → **Generate Domain**
2. Tu obtiens une URL du type : `https://vsm-bot-production.up.railway.app`
3. Teste : `https://TON-URL/api/health` → `{"ok":true,"ready":...}`

---

## 5. Connecter le dashboard Vercel

Dans les variables Vercel (`frontend`) :

```
REACT_APP_SUPABASE_URL=https://ehmgjgrekjoaohnnlfmw.supabase.co
REACT_APP_SUPABASE_ANON_KEY=ta-clé-anon
REACT_APP_NODE_URL=https://TON-URL-RAILWAY
REACT_APP_BACKEND_URL=https://ton-backend-python-optionnel
```

Redéploie Vercel après modification des variables.

---

## 6. Premier démarrage

1. Attends le déploiement Railway (2–5 min, Chromium démarre lentement)
2. Ouvre le dashboard → **WhatsApp** → scanne le QR
3. Vérifie les logs Railway : `Bot WhatsApp prêt · numéro +...`

---

## 7. Commandes utiles

```bash
# Build local (test)
cd server-nodejs
docker build -t vsm-bot .
docker run -p 3002:3002 --env-file .env -v vsm-session:/data vsm-bot
```

---

## Dépannage

| Problème | Solution |
|----------|----------|
| QR à chaque deploy | Ajoute le volume `/data` |
| `Target closed` / Chromium crash | Vérifie les logs ; augmente `WA_INIT_RETRIES` |
| CORS error dashboard | Mets l'URL Vercel exacte dans `CORS_ORIGINS` |
| Health check timeout | Normal au 1er boot (jusqu'à 3 min) |

---

## Coût estimé

Railway : ~5–15 $/mois (RAM Chromium ~512 Mo–1 Go recommandés).
