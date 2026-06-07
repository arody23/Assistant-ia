/**
 * WhatsApp client (whatsapp-web.js) avec mesures anti-bannissement.
 *
 * Best practices appliquées :
 *  - LocalAuth (session persistante → pas de re-scan à chaque démarrage)
 *  - Délai aléatoire avant réponse (1.2 → 2.8 s)
 *  - Indicateur "en train d'écrire" (sendStateTyping)
 *  - Présence "online" toggle naturel
 *  - Rate limit (30 réponses / min par défaut)
 *  - Ignorer les groupes (configurable)
 *  - Ignorer les messages > 30 s (replays/stale)
 *  - Ne jamais répondre à soi-même ni aux statuts
 */

import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import os from "os";

import { getConfig, upsertSession, upsertConversation, insertMessages, recentHistory } from "./supabase.js";
import { generateReply, transcribeAudio } from "./groq.js";
import { log } from "./logger.js";

const sessionDir = process.env.WA_SESSION_DIR || "./.wwebjs_auth";
const minDelay = parseInt(process.env.WA_REPLY_DELAY_MIN_MS || "1200", 10);
const maxDelay = parseInt(process.env.WA_REPLY_DELAY_MAX_MS || "2800", 10);
const rateLimit = parseInt(process.env.WA_RATE_LIMIT_PER_MIN || "30", 10);

// Sliding window rate limit
const recentReplies = [];
function canReply() {
  const now = Date.now();
  while (recentReplies.length && now - recentReplies[0] > 60_000) recentReplies.shift();
  return recentReplies.length < rateLimit;
}
function markReply() { recentReplies.push(Date.now()); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => minDelay + Math.floor(Math.random() * (maxDelay - minDelay));

let client = null;
let isReady = false;

export function getClient() { return client; }
export function isClientReady() { return isReady; }

export async function startWhatsApp() {
  await upsertSession({ status: "disconnected", connected: false, qr_code: null });

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionDir }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr) => {
    await log("info", "Nouveau QR généré → ouvre le dashboard pour scanner");
    try {
      const dataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
      await upsertSession({ status: "qr_pending", connected: false, qr_code: dataUrl });
    } catch (e) {
      await log("error", `QR encode échec: ${e.message}`);
    }
  });

  client.on("authenticated", async () => {
    await log("success", "WhatsApp authentifié");
    await upsertSession({ status: "authenticated", qr_code: null });
  });

  client.on("auth_failure", async (m) => {
    isReady = false;
    await log("error", `Authentification échouée: ${m}`);
    await upsertSession({ status: "disconnected", connected: false });
  });

  client.on("ready", async () => {
    isReady = true;
    const me = client.info?.wid?.user || "";
    await log("success", `Bot WhatsApp prêt · numéro +${me}`);
    await upsertSession({
      status: "ready", connected: true,
      phone_number: `+${me}`, qr_code: null,
      connected_at: new Date().toISOString(),
    });
  });

  client.on("disconnected", async (reason) => {
    isReady = false;
    await log("warn", `Déconnecté: ${reason}`);
    await upsertSession({ status: "disconnected", connected: false });
    // Reconnexion automatique
    setTimeout(() => startWhatsApp().catch(e => log("error", `Reconnect échec: ${e.message}`)), 5000);
  });

  client.on("message", handleMessage);

  await client.initialize();
}

async function handleMessage(msg) {
  try {
    // Filtres rapides
    if (msg.fromMe) return;
    if (msg.isStatus) return;

    const cfg = await getConfig();
    if (!cfg.bot_active) return;

    const behavior = cfg.behavior || {};
    const chat = await msg.getChat();
    if (chat.isGroup && behavior.ignore_groups !== false) return;

    // Stale message guard
    const ageSec = (Date.now() / 1000) - (msg.timestamp || 0);
    if (ageSec > 30) return;

    if (!canReply()) {
      await log("warn", `Rate limit atteint, message de ${msg.from} ignoré`);
      return;
    }

    // Extraire le texte (texte ou audio transcrit)
    let userText = "";
    let mediaType = "text";

    if (msg.type === "chat" || msg.type === "text") {
      userText = msg.body || "";
    } else if ((msg.type === "audio" || msg.type === "ptt") && behavior.voice_reply !== false) {
      mediaType = "audio";
      const media = await msg.downloadMedia();
      if (!media) return;
      const ext = (media.mimetype || "audio/ogg").split("/")[1].split(";")[0] || "ogg";
      const tmp = path.join(os.tmpdir(), `wa_${Date.now()}.${ext}`);
      fs.writeFileSync(tmp, Buffer.from(media.data, "base64"));
      try {
        userText = await transcribeAudio(tmp, `voice.${ext}`, cfg);
        await log("info", `Vocal transcrit (${userText.length} chars) de ${msg.from}`);
      } finally {
        fs.unlink(tmp, () => {});
      }
    } else {
      // image / document / autre → on répond poliment
      userText = "[Le client a envoyé un média non supporté]";
    }

    if (!userText.trim()) return;

    // Contact info
    const contact = await msg.getContact();
    const phone = (msg.from || "").replace("@c.us", "");
    const displayName = contact.pushname || contact.name || contact.shortName || phone;

    // Indicateur "en train d'écrire" + délai humain
    try { await chat.sendStateTyping(); } catch {}
    await sleep(randomDelay());

    // Récupérer l'historique
    const { data: existingConv } = await (await import("./supabase.js")).supabase
      .from("conversations").select("id").eq("phone", phone).maybeSingle();

    let history = [];
    if (existingConv?.id && behavior.remember_history !== false) {
      history = await recentHistory(existingConv.id, cfg.memory_msgs || 8);
    }

    // Génération Groq
    const { reply, model } = await generateReply({ message: userText, history, cfg });
    if (!reply) return;

    // Envoi
    try { await chat.clearState(); } catch {}
    await msg.reply(reply);
    markReply();

    // Persistance
    const conversationId = await upsertConversation({ phone, name: displayName, last_message: reply.slice(0, 200) });
    if (conversationId) {
      const ts = new Date().toISOString();
      await insertMessages(conversationId, [
        { role: "user", content: userText, ts, media_type: mediaType },
        { role: "assistant", content: reply, model, ts, media_type: "text" },
      ]);
    }
    await log("success", `Répondu à ${displayName} via ${model}`);
  } catch (e) {
    await log("error", `Handler message: ${e.message}`);
  }
}

export async function logoutWhatsApp() {
  if (!client) return;
  try { await client.logout(); } catch {}
  try { await client.destroy(); } catch {}
  isReady = false;
  client = null;
  // Wipe session folder
  try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
  await upsertSession({ status: "disconnected", connected: false, qr_code: null, phone_number: null, connected_at: null });
  await log("warn", "Session WhatsApp réinitialisée");
}
