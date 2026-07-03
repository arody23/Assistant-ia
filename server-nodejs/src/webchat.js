/**
 * API chat web (widget embarqué sur vsmcollection.com / ambassadeur.vsmcollection.com)
 */

import { getEnvStatus } from "./env.js";
import { getConfig, getConversationByPhone, upsertConversation, insertMessages, recentHistory } from "./supabase.js";
import { generateReply } from "./groq.js";
import { buildClientContextBlock } from "./prompt-builder.js";
import { searchCatalog } from "./catalog.js";
import { log } from "./logger.js";

function webPhone(sessionId) {
  return `web:${sessionId}`;
}

export function registerWebchatRoutes(app) {
  app.get("/api/webchat/config", async (_req, res) => {
    try {
      const cfg = await getConfig();
      const b = cfg.behavior || {};
      res.json({
        brand: b.brand_name || "VSM Collection",
        welcome: cfg.quick_replies?.welcome || "Bonjour ! Comment puis-je t'aider ?",
        ambassadorUrl: b.ambassador_url || "https://ambassadeur.vsmcollection.com/apply",
        shopUrl: b.shop_url || "https://www.vsmcollection.com",
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/webchat/message", async (req, res) => {
    const env = getEnvStatus();
    if (!env.ok) {
      return res.status(503).json({ error: "Bot non configuré", missing: env.missing });
    }

    const { sessionId, message, name } = req.body || {};
    if (!sessionId || !message?.trim()) {
      return res.status(400).json({ error: "sessionId et message requis" });
    }

    try {
      const cfg = await getConfig();
      if (!cfg.bot_active) {
        return res.status(503).json({ error: "Bot désactivé" });
      }

      const phone = webPhone(sessionId);
      const displayName = name || "Visiteur web";
      const existingConv = await getConversationByPhone(phone);
      const behavior = cfg.behavior || {};

      let history = [];
      if (existingConv?.id && behavior.remember_history !== false) {
        history = await recentHistory(existingConv.id, cfg.memory_msgs || 8);
      }

      const profile = existingConv?.profile || {};
      const clientContext = buildClientContextBlock({
        name: displayName,
        status: profile.status,
        tags: profile.tags,
        kit_paid: profile.kit_paid,
        ambassador_applied: profile.ambassador_applied,
        summary: existingConv?.summary,
        notes: existingConv?.notes,
      });

      const catalog = await searchCatalog(message, cfg);
      const { reply, model } = await generateReply({
        message: message.trim(),
        history,
        cfg,
        catalogContext: catalog.context,
        clientContext,
      });

      const conversationId = await upsertConversation({
        phone,
        name: displayName,
        last_message: reply.slice(0, 200),
        channel: "web",
      });

      if (conversationId) {
        const ts = new Date().toISOString();
        await insertMessages(conversationId, [
          { role: "user", content: message.trim(), ts, media_type: "text" },
          { role: "assistant", content: reply, model, ts, media_type: "text" },
        ]);
      }

      await log("info", `Webchat ${sessionId.slice(0, 8)}…`);
      res.json({ reply, model });
    } catch (e) {
      await log("error", `Webchat: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
}
