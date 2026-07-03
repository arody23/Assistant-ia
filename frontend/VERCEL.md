# Déploiement Vercel — Dashboard React

## Configuration projet Vercel

| Paramètre | Valeur |
|-----------|--------|
| **Root Directory** | `frontend` (recommandé) |
| **Framework** | Create React App |
| **Build Command** | `npm run build` |
| **Output Directory** | `build` |
| **Install Command** | `npm ci --legacy-peer-deps` |

Si tu déploies depuis la **racine** du repo sans changer Root Directory, le `vercel.json` à la racine configure tout automatiquement.

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
