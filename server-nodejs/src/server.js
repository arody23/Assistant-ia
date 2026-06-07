/**
 * VSM Collection — WhatsApp Customer Support Bot
 * ==============================================
 *  Stack : Node.js + Express + Groq AI
 *  Endpoints : /api/chat, /api/transcribe, /api/config, /api/conversations,
 *              /api/stats, /api/logs, /api/whatsapp/{connect,disconnect,webhook}
 *
 *  Démarrage :
 *    1. cp .env.example .env  (et remplir tes clés)
 *    2. npm install
 *    3. npm run dev   (ou npm start)
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";
import axios from "axios";
import Groq from "groq-sdk";
import { MongoClient } from "mongodb";

import { defaultConfig, defaultSystemPrompt } from "./config.js";
import { buildWhatsAppRouter } from "./whatsapp.js";
import { addLog, getLogs, clearLogs, simulateLogs } from "./logs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------------------------------------------------------------
// Init
// ----------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3001;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) console.warn("[WARN] GROQ_API_KEY manquante dans .env");
const groq = new Groq({ apiKey: GROQ_API_KEY });

// CORS
const origins = (process.env.CORS_ORIGINS || "*").split(",").map(s => s.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins }));
app.use(express.json({ limit: "5mb" }));

// MongoDB (optionnel)
let db = null;
if (process.env.MONGO_URL) {
  try {
    const client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    db = client.db(process.env.DB_NAME || "vsm_bot");
    addLog("success", "MongoDB connecté");
  } catch (e) {
    addLog("error", `MongoDB indisponible : ${e.message}`);
  }
}

// In-memory store si pas de Mongo
const memory = { config: { ...defaultConfig }, conversations: [], messages: [] };

async function getConfig() {
  if (db) {
    const doc = await db.collection("bot_config").findOne({ _id: "main" });
    if (!doc) {
      await db.collection("bot_config").insertOne({ _id: "main", ...defaultConfig });
      return defaultConfig;
    }
    delete doc._id;
    return doc;
  }
  return memory.config;
}
async function setConfig(patch) {
  if (db) {
    await db.collection("bot_config").updateOne(
      { _id: "main" },
      { $set: { ...patch, updated_at: new Date().toISOString() } },
      { upsert: true }
    );
  } else {
    memory.config = { ...memory.config, ...patch, updated_at: new Date().toISOString() };
  }
  return getConfig();
}

// Multer pour audio
const upload = multer({ dest: path.join(__dirname, "../tmp/") });
fs.mkdirSync(path.join(__dirname, "../tmp/"), { recursive: true });

// ----------------------------------------------------------------------------
// Groq helpers
// ----------------------------------------------------------------------------
async function generateReply({ message, history = [], cfg }) {
  const systemMsg = { role: "system", content: cfg.system_prompt || defaultSystemPrompt };
  const memMsgs = (history || []).slice(-(cfg.memory_msgs || 8));
  const messages = [systemMsg, ...memMsgs, { role: "user", content: message }];

  const primary = cfg.model || "llama-3.1-8b-instant";
  const fallback = cfg.fallback_model || "llama-3.3-70b-versatile";

  try {
    const c = await groq.chat.completions.create({
      model: primary,
      messages,
      max_tokens: cfg.max_tokens || 512,
      temperature: cfg.temperature ?? 0.4,
    });
    return { reply: c.choices[0]?.message?.content || "", model: primary };
  } catch (err) {
    addLog("warn", `Modèle ${primary} a échoué, fallback ${fallback}: ${err.message}`);
    const c = await groq.chat.completions.create({
      model: fallback,
      messages,
      max_tokens: cfg.max_tokens || 1024,
      temperature: cfg.temperature ?? 0.4,
    });
    return { reply: c.choices[0]?.message?.content || "", model: fallback };
  }
}

async function transcribeAudio(filePath, fileName, cfg) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), fileName);
  form.append("model", cfg.whisper_model || "whisper-large-v3");

  const { data } = await axios.post(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    form,
    { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, ...form.getHeaders() }, maxBodyLength: 30 * 1024 * 1024 }
  );
  return data.text || "";
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------
app.get("/api", (_req, res) => res.json({ app: "VSM Bot API (Node.js)", ok: true, groq: !!GROQ_API_KEY }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --- Config ---
app.get("/api/config", async (_req, res) => res.json(await getConfig()));
app.post("/api/config", async (req, res) => {
  const cfg = await setConfig(req.body || {});
  addLog("success", "Configuration mise à jour");
  res.json(cfg);
});

// --- Chat ---
app.post("/api/chat", async (req, res) => {
  try {
    const cfg = await getConfig();
    if (!cfg.bot_active) return res.json({ reply: "🤖 Bot désactivé.", model: "n/a" });

    const start = Date.now();
    const { reply, model } = await generateReply({
      message: req.body.message,
      history: req.body.history || [],
      cfg,
    });
    const elapsed = Date.now() - start;
    addLog("info", `Réponse via ${model} en ${elapsed}ms`);

    const convId = req.body.conversation_id || `conv_${Date.now()}`;
    if (db) {
      const ts = new Date().toISOString();
      await db.collection("messages").insertMany([
        { conversation_id: convId, role: "user", content: req.body.message, ts },
        { conversation_id: convId, role: "assistant", content: reply, model, ts },
      ]);
      await db.collection("conversations").updateOne(
        { id: convId },
        { $set: { id: convId, last_message: reply.slice(0, 100), last_ts: ts, name: `Client ${convId.slice(-6)}` }, $inc: { messages_count: 2 } },
        { upsert: true }
      );
    }
    res.json({ reply, model, elapsed_ms: elapsed, conversation_id: convId });
  } catch (e) {
    addLog("error", `Chat échec : ${e.message}`);
    res.status(502).json({ error: e.message });
  }
});

// --- Transcription ---
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Fichier audio manquant" });
  try {
    const cfg = await getConfig();
    const text = await transcribeAudio(req.file.path, req.file.originalname, cfg);
    addLog("success", `Transcription Whisper : ${text.length} chars`);
    res.json({ text, model: cfg.whisper_model });
  } catch (e) {
    addLog("error", `Whisper échec : ${e.message}`);
    res.status(502).json({ error: e.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// --- Conversations ---
app.get("/api/conversations", async (_req, res) => {
  if (!db) return res.json(memory.conversations);
  const items = await db.collection("conversations").find({}, { projection: { _id: 0 } }).sort({ last_ts: -1 }).limit(50).toArray();
  res.json(items);
});

app.get("/api/conversations/:id/messages", async (req, res) => {
  if (!db) return res.json([]);
  const items = await db.collection("messages").find({ conversation_id: req.params.id }, { projection: { _id: 0 } }).sort({ ts: 1 }).toArray();
  res.json(items);
});

// --- Stats ---
app.get("/api/stats", async (_req, res) => {
  let messagesToday = 0, convs = 0, totalMsgs = 0;
  if (db) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    messagesToday = await db.collection("messages").countDocuments({ ts: { $gte: todayStart.toISOString() } });
    convs = await db.collection("conversations").countDocuments();
    totalMsgs = await db.collection("messages").countDocuments();
  }
  const series = [];
  const labels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  for (let i = 6; i >= 0; i--) {
    const idx = (new Date().getDay() - i + 7) % 7;
    series.push({ label: labels[idx], value: Math.max(0, messagesToday - i * 3 + (i % 3) * 5) });
  }
  res.json({
    messages_today: messagesToday,
    unique_clients: convs,
    products_viewed: Math.min(totalMsgs * 2, 9999),
    resolution_rate: 92,
    delta_messages: "+18%", delta_clients: "+7%", delta_products: "+12%", delta_resolution: "+3%",
    peak_hour: "14h–17h", avg_response_ms: 1240, weekly_series: series,
  });
});

// --- Logs ---
app.get("/api/logs", (_req, res) => res.json(getLogs()));
app.delete("/api/logs", (_req, res) => { clearLogs(); addLog("info", "Logs effacés"); res.json({ ok: true }); });
app.post("/api/logs/simulate", (_req, res) => { simulateLogs(); res.json({ ok: true }); });

// --- WhatsApp routes (webhook Meta + simulation) ---
app.use("/api/whatsapp", buildWhatsAppRouter({ generateReply, transcribeAudio, getConfig, setConfig, addLog }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal error" });
});

app.listen(PORT, () => {
  addLog("info", `Backend Node.js démarré sur le port ${PORT}`);
  console.log(`\n  ✓ VSM Bot API ready on http://localhost:${PORT}/api\n`);
});
