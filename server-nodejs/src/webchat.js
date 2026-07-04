/**
 * API chat web — général + programme ambassadeur (/chatbot)
 */

import { getEnvStatus } from "./env.js";
import {
  getConfig,
  getConversationByPhone,
  upsertConversation,
  insertMessages,
  recentHistory,
  getAmbassadorAssets,
} from "./supabase.js";
import { generateReply } from "./groq.js";
import {
  buildClientContextBlock,
  buildAmbassadorSystemPrompt,
  buildAssetsContextBlock,
} from "./prompt-builder.js";
import { searchCatalog } from "./catalog.js";
import { log } from "./logger.js";
import { selectAmbassadorAssets, assetsToImages } from "./asset-picker.js";

const INTEREST_WORDS = [
  "ambassadeur", "ambassade", "candidat", "candidature", "kit", "programme",
  "rejoindre", "inscription", "apply", "postuler", "aperçu", "apercu",
];

function webPhone(sessionId, channel = "web") {
  return `${channel}:${sessionId}`;
}

function scoreInterest(text) {
  const q = (text || "").toLowerCase();
  return INTEREST_WORDS.reduce((n, w) => (q.includes(w) ? n + 1 : n), 0);
}

async function handleChat({ req, res, channel, ambassador = false }) {
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

    const phone = webPhone(sessionId, ambassador ? "ambassador" : "web");
    const displayName = name || (ambassador ? "Visiteur ambassadeur" : "Visiteur web");
    const existingConv = await getConversationByPhone(phone);
    const behavior = cfg.behavior || {};
    const interestDelta = scoreInterest(message);

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

    const assets = ambassador ? await getAmbassadorAssets() : [];
    const assetsBlock = ambassador ? buildAssetsContextBlock(assets) : "";

    let reply;
    let model;

    if (ambassador) {
      const systemContent = buildAmbassadorSystemPrompt(cfg, { clientContext, assetsBlock });
      const memMsgs = history.slice(-(cfg.memory_msgs || 8));
      const messages = [
        { role: "system", content: systemContent },
        ...memMsgs,
        { role: "user", content: message.trim() },
      ];
      const primary = cfg.model || "llama-3.1-8b-instant";
      const fallback = cfg.fallback_model || "llama-3.3-70b-versatile";
      const Groq = (await import("groq-sdk")).default;
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      try {
        const c = await groq.chat.completions.create({
          model: primary,
          messages,
          max_tokens: cfg.max_tokens || 512,
          temperature: cfg.temperature ?? 0.4,
        });
        reply = c.choices[0]?.message?.content || "";
        model = primary;
      } catch (err) {
        await log("warn", `Ambassador ${primary} échec: ${err.message}`);
        const c = await groq.chat.completions.create({
          model: fallback,
          messages,
          max_tokens: cfg.max_tokens || 1024,
          temperature: cfg.temperature ?? 0.4,
        });
        reply = c.choices[0]?.message?.content || "";
        model = fallback;
      }
    } else {
      const catalog = await searchCatalog(message, cfg);
      const result = await generateReply({
        message: message.trim(),
        history,
        cfg,
        catalogContext: catalog.context,
        clientContext,
      });
      reply = result.reply;
      model = result.model;
    }

    const picked = ambassador ? selectAmbassadorAssets(message, reply, assets) : [];
    const images = assetsToImages(picked);

    const conversationId = await upsertConversation({
      phone,
      name: displayName,
      last_message: reply.slice(0, 200),
      channel: ambassador ? "ambassador" : "web",
      interest_delta: interestDelta,
    });

    if (conversationId) {
      const ts = new Date().toISOString();
      await insertMessages(conversationId, [
        { role: "user", content: message.trim(), ts, media_type: "text" },
        { role: "assistant", content: reply, model, ts, media_type: "text" },
      ]);
    }

    await log("info", `${ambassador ? "Ambassador" : "Web"} chat ${sessionId.slice(0, 8)}…`);
    res.json({ reply, model, images });
  } catch (e) {
    await log("error", `Webchat: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
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

  app.get("/api/webchat/ambassador/config", async (_req, res) => {
    try {
      const cfg = await getConfig();
      const b = cfg.behavior || {};
      const ac = b.ambassador_chat || {};
      res.json({
        brand: b.brand_name || "VSM Collection",
        welcome: ac.welcome || "Salut ! Je suis l'assistant du programme ambassadeur VSM. Pose-moi tes questions !",
        applyUrl: ac.apply_url || b.ambassador_url || "https://ambassadeur.vsmcollection.com/apply",
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/webchat/message", (req, res) => handleChat({ req, res, channel: "web", ambassador: false }));
  app.post("/api/webchat/ambassador/message", (req, res) => handleChat({ req, res, channel: "ambassador", ambassador: true }));
}
