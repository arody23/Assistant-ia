# Déploiement Vercel — Dashboard React

## Configuration projet Vercel

**Repo GitHub :** `arody23/Assistant-ia` (pas `assistant`).

| Paramètre | Valeur |
|-----------|--------|
| **Root Directory** | `frontend` ← obligatoire |
| **Framework Preset** | Create React App (ou Other) |
| **Build Command** | `npm run build` |
| **Output Directory** | `build` |
| **Install Command** | `npm ci --legacy-peer-deps` |
| **Node.js Version** | 24.x (Settings → General, ou via `engines` dans `package.json`) |

Le nom du projet / domaine Vercel (`assistant-iaa`, etc.) est **cosmétique** — Vercel génère un sous-domaine `.vercel.app` automatiquement si le nom choisi est pris.

### Les `npm warn deprecated` ne font pas échouer le build

Ce sont des avertissements de dépendances anciennes (CRA 5). Cherche la vraie erreur **en bas des logs** : `Error:`, `Failed to compile`, `ERESOLVE`, ou `Command "npm run build" exited with 1`.

Si tu déploies depuis la **racine** sans Root Directory, le `vercel.json` racine configure tout — mais **Root Directory = frontend** est plus simple.

## Variables d'environnement (obligatoires)

Dans Vercel → **Settings → Environment Variables** :

```
REACT_APP_SUPABASE_URL=https://ehmgjgrekjoaohnnlfmw.supabase.co
REACT_APP_SUPABASE_ANON_KEY=ta-clé-anon
REACT_APP_NODE_URL=https://ton-bot.up.railway.app
```

`REACT_APP_BACKEND_URL` est **optionnel** (Playground Python uniquement). Le dashboard fonctionne sans.

> Après avoir ajouté des variables : **Redeploy** obligatoire (les variables `REACT_APP_*` sont injectées au build).

## Erreur 404

| Cause | Solution |
|-------|----------|
| Page entière 404 | Root Directory = `frontend`, Output = `build` |
| Console 404 sur `/api/...` | Normal si backend Python non déployé — corrigé, le dashboard utilise Supabase direct |
| Variables manquantes | Ajoute `REACT_APP_SUPABASE_*` puis Redeploy |

## Test

1. Ouvre `https://ton-app.vercel.app` → le dashboard s'affiche
2. Section **WhatsApp** → QR ou statut en ligne
3. `/api/health` sur Railway doit répondre (pas sur Vercel)
