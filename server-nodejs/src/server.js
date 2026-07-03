/**
 * VSM Bot — Serveur Node.js (production)
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { getEnvStatus, logEnvStatus } from "./env.js";

const app = express();
const PORT = process.env.PORT || 3002;

const origins = (process.env.CORS_ORIGINS || "*").split(",").map(s => s.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins }));
app.use(express.json({ limit: "5mb" }));

let isClientReady = () => false;
let getClient = () => null;
let startWhatsApp = async () => {};
let reconnectWhatsApp = async () => {};
let log = async (level, message) => { console.log(`[${level}] ${message}`); };

app.get("/api/health", (_req, res) => {
  const env = getEnvStatus();
  res.status(200).json({
    ok: env.ok,
    ready: env.ok ? isClientReady() : false,
    missing: env.missing.length ? env.missing : undefined,
  });
});

app.get("/api/status", (_req, res) => {
  const env = getEnvStatus();
  if (!env.ok) {
    return res.status(503).json({ ready: false, error: "Variables manquantes", missing: env.missing });
  }
  const c = getClient();
  res.json({
    ready: isClientReady(),
    phone: c?.info?.wid?.user ? `+${c.info.wid.user}` : null,
  });
});

async function handleReconnect(_req, res) {
  const env = getEnvStatus();
  if (!env.ok) {
    return res.status(503).json({ ok: false, error: "Variables manquantes", missing: env.missing });
  }
  try {
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
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal error" });
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`\n  ✓ VSM Bot HTTP — port ${PORT} (0.0.0.0)\n`);

  if (!logEnvStatus()) {
    console.log("  ⚠ Bot WhatsApp NON démarré — configure les variables Railway puis Redeploy.\n");
    return;
  }

  const wa = await import("./whatsapp-client.js");
  const logger = await import("./logger.js");
  startWhatsApp = wa.startWhatsApp;
  reconnectWhatsApp = wa.reconnectWhatsApp;
  isClientReady = wa.isClientReady;
  getClient = wa.getClient;
  log = logger.log;

  await log("info", `Serveur Node.js démarré sur le port ${PORT}`);
  await log("info", "Initialisation du client WhatsApp (whatsapp-web.js)…");
  startWhatsApp().catch(async (e) => {
    await log("error", `WhatsApp init: ${e.message}`);
  });
});

process.on("SIGINT", async () => { await log("warn", "Shutdown SIGINT"); process.exit(0); });
process.on("SIGTERM", async () => { await log("warn", "Shutdown SIGTERM"); process.exit(0); });
