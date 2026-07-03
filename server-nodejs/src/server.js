/**
 * VSM Bot — Serveur Node.js (production)
 * --------------------------------------
 *  Stack : Express + whatsapp-web.js + Groq AI + Supabase
 *  But   : faire tourner le bot WhatsApp et synchroniser l'état dans Supabase.
 *          Le dashboard React lit Supabase en direct (realtime).
 *
 *  Endpoints REST (utilitaires/admin) :
 *    GET  /api/health     → ping
 *    GET  /api/status     → état du client WhatsApp
 *    POST /api/logout     → déconnecter et purger la session
 *    POST /api/reconnect  → idem logout + attend le redémarrage WhatsApp
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { startWhatsApp, reconnectWhatsApp, isClientReady, getClient } from "./whatsapp-client.js";
import { log } from "./logger.js";

const app = express();
const PORT = process.env.PORT || 3001;

const origins = (process.env.CORS_ORIGINS || "*").split(",").map(s => s.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, ready: isClientReady() }));
app.get("/api/status", (_req, res) => {
  const c = getClient();
  res.json({
    ready: isClientReady(),
    phone: c?.info?.wid?.user ? `+${c.info.wid.user}` : null,
  });
});

async function handleReconnect(_req, res) {
  try {
    // Ne pas bloquer la réponse HTTP — la reconnexion peut prendre 1-3 min (Chromium + QR)
    reconnectWhatsApp().catch(async (e) => {
      await log("error", `WhatsApp reconnect: ${e.message}`);
    });
    res.json({ ok: true, message: "Reconnexion lancée" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

app.post("/api/logout", handleReconnect);
app.post("/api/reconnect", handleReconnect);

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal error" });
});

app.listen(PORT, async () => {
  await log("info", `Serveur Node.js démarré sur le port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`\n  ✓ VSM Bot Node.js prêt — http://localhost:${PORT}/api\n`);
  await log("info", "Initialisation du client WhatsApp (whatsapp-web.js)…");
  startWhatsApp().catch(async (e) => {
    await log("error", `WhatsApp init: ${e.message}`);
  });
});

// Graceful shutdown
process.on("SIGINT", async () => { await log("warn", "Shutdown SIGINT"); process.exit(0); });
process.on("SIGTERM", async () => { await log("warn", "Shutdown SIGTERM"); process.exit(0); });
