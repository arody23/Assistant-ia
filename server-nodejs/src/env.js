/**
 * Validation des variables d'environnement (Railway / Docker / local).
 * Ne pas appeler process.exit — le serveur HTTP doit démarrer pour le healthcheck.
 */

const REQUIRED = [
  { key: "SUPABASE_URL", hint: "https://xxx.supabase.co" },
  { key: "SUPABASE_SERVICE_KEY", hint: "clé service_role (Supabase → Settings → API)" },
  { key: "GROQ_API_KEY", hint: "clé API Groq (console.groq.com)" },
];

const RECOMMENDED = [
  { key: "SITE_URL", hint: "https://www.vsmcollection.com" },
  { key: "CORS_ORIGINS", hint: "https://ton-app.vercel.app" },
  { key: "WA_SESSION_DIR", hint: "/data/.wwebjs_auth (volume Railway)" },
];

export function getEnvStatus() {
  const missing = REQUIRED.filter(({ key }) => !process.env[key]?.trim()).map(({ key }) => key);
  const recommended = RECOMMENDED.filter(({ key }) => !process.env[key]?.trim()).map(({ key }) => key);
  return {
    ok: missing.length === 0,
    missing,
    recommended,
    required: REQUIRED,
  };
}

export function logEnvStatus() {
  const { ok, missing, recommended } = getEnvStatus();
  if (!ok) {
    // eslint-disable-next-line no-console
    console.error("\n[FATAL] Variables d'environnement manquantes sur Railway :");
    missing.forEach((k) => {
      const meta = REQUIRED.find((r) => r.key === k);
      // eslint-disable-next-line no-console
      console.error(`  - ${k}${meta?.hint ? ` (${meta.hint})` : ""}`);
    });
    // eslint-disable-next-line no-console
    console.error("\n→ Railway Dashboard → ton service → Variables → Raw Editor → ajoute-les → Redeploy\n");
    return false;
  }
  if (recommended.length) {
    // eslint-disable-next-line no-console
    console.warn("[WARN] Variables recommandées absentes:", recommended.join(", "));
  }
  return true;
}
