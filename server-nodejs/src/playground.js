/**
 * Playground — test prompt Groq (même pipeline que WhatsApp)
 */

import { getEnvStatus } from "./env.js";
import { getConfig } from "./supabase.js";
import { generateReply, transcribeAudio } from "./groq.js";
import { searchCatalog } from "./catalog.js";
import fs from "fs";
import os from "os";
import path from "path";

export function registerPlaygroundRoutes(app) {
  app.post("/api/playground/chat", async (req, res) => {
    const env = getEnvStatus();
    if (!env.ok) {
      return res.status(503).json({ error: "Variables manquantes", missing: env.missing });
    }

    try {
      const { message, history = [], config: bodyConfig } = req.body || {};
      if (!message?.trim()) {
        return res.status(400).json({ error: "message requis" });
      }

      const dbCfg = await getConfig();
      const cfg = { ...dbCfg, ...(bodyConfig || {}) };
      const catalog = await searchCatalog(message, cfg);

      const start = Date.now();
      const { reply, model } = await generateReply({
        message: message.trim(),
        history: history.map((m) => ({ role: m.role, content: m.content })),
        cfg,
        catalogContext: catalog.context,
      });

      res.json({
        reply,
        model,
        elapsed_ms: Date.now() - start,
        catalog_match: catalog.primary?.name || null,
      });
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  app.post("/api/playground/transcribe", async (req, res) => {
    const env = getEnvStatus();
    if (!env.ok) {
      return res.status(503).json({ error: "Variables manquantes", missing: env.missing });
    }

    try {
      const { audioBase64, fileName, whisper_model } = req.body || {};
      if (!audioBase64) {
        return res.status(400).json({ error: "audioBase64 requis" });
      }

      const cfg = await getConfig();
      if (whisper_model) cfg.whisper_model = whisper_model;

      const ext = (fileName || "voice.webm").split(".").pop() || "webm";
      const tmp = path.join(os.tmpdir(), `pg_${Date.now()}.${ext}`);
      fs.writeFileSync(tmp, Buffer.from(audioBase64, "base64"));
      try {
        const text = await transcribeAudio(tmp, fileName || `voice.${ext}`, cfg);
        res.json({ text, model: cfg.whisper_model || "whisper-large-v3" });
      } finally {
        fs.unlink(tmp, () => {});
      }
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });
}
