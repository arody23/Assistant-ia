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

import { getConfig, upsertSession, upsertConversation, insertMessages, recentHistory, getConversationByPhone } from "./supabase.js";
import { generateReply, transcribeAudio, analyzeProductImage } from "./groq.js";
import { searchCatalog, productUrl, getActiveProductNames, buildAvailableSummary, getActiveProducts } from "./catalog.js";
import { buildClientContextBlock } from "./prompt-builder.js";
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

function replyDelayMs(cfg) {
  const base = cfg?.delay_ms || 800;
  const min = Math.max(400, base - 400);
  const max = base + 1200;
  return min + Math.floor(Math.random() * (max - min));
}

let client = null;
let isReady = false;
let initializing = false;
let reconnecting = false;
let startPromise = null;

const initRetries = parseInt(process.env.WA_INIT_RETRIES || "3", 10);
const initRetryDelayMs = parseInt(process.env.WA_INIT_RETRY_DELAY_MS || "15000", 10);

export function getClient() { return client; }
export function isClientReady() { return isReady; }

function bindClientEvents(waClient) {
  waClient.on("qr", async (qr) => {
    await log("info", "Nouveau QR généré → ouvre le dashboard pour scanner");
    try {
      const dataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
      await upsertSession({ status: "qr_pending", connected: false, qr_code: dataUrl });
    } catch (e) {
      await log("error", `QR encode échec: ${e.message}`);
    }
  });

  waClient.on("authenticated", async () => {
    await log("success", "WhatsApp authentifié");
    await upsertSession({ status: "authenticated", qr_code: null });
  });

  waClient.on("auth_failure", async (m) => {
    isReady = false;
    await log("error", `Authentification échouée: ${m}`);
    await upsertSession({
      status: "disconnected", connected: false,
      qr_code: null, phone_number: null, connected_at: null,
    });
  });

  waClient.on("ready", async () => {
    isReady = true;
    const me = waClient.info?.wid?.user || "";
    await log("success", `Bot WhatsApp prêt · numéro +${me}`);
    await upsertSession({
      status: "ready", connected: true,
      phone_number: `+${me}`, qr_code: null,
      connected_at: new Date().toISOString(),
    });
  });

  waClient.on("disconnected", async (reason) => {
    isReady = false;
    await log("warn", `Déconnecté: ${reason}`);
    await upsertSession({
      status: "disconnected", connected: false, qr_code: null,
      phone_number: null, connected_at: null,
    });
    if (reconnecting || initializing) return;
    setTimeout(() => startWhatsApp().catch(e => log("error", `Reconnect échec: ${e.message}`)), 5000);
  });

  waClient.on("message", handleMessage);
}

function createClient() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: sessionDir }),
    authTimeoutMs: parseInt(process.env.WA_AUTH_TIMEOUT_MS || "120000", 10),
    // Cache local (défaut lib) — évite les échecs réseau vers GitHub (ECONNRESET)
    webVersionCache: { type: "local" },
    puppeteer: {
      headless: true,
      defaultViewport: null,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      protocolTimeout: parseInt(process.env.WA_PROTOCOL_TIMEOUT_MS || "300000", 10),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--disable-extensions",
      ],
    },
  });
}

async function destroyClient() {
  try { await client?.destroy(); } catch {}
  client = null;
  isReady = false;
}

async function startWhatsAppOnce() {
  await upsertSession({
    status: "initializing", connected: false, qr_code: null,
    phone_number: null, connected_at: null,
  });

  client = createClient();
  bindClientEvents(client);

  await log("info", "Lancement de Chromium (Puppeteer)…");
  await client.initialize();
  await log("info", "Client WhatsApp initialisé");
}

export async function startWhatsApp() {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    if (initializing) return;
    initializing = true;

    try {
      for (let attempt = 1; attempt <= initRetries; attempt++) {
        try {
          if (attempt > 1) {
            await destroyClient();
            await log("info", `Nouvelle tentative WhatsApp (${attempt}/${initRetries})…`);
          }
          await startWhatsAppOnce();
          return;
        } catch (e) {
          await log("error", `WhatsApp init (${attempt}/${initRetries}): ${e.message}`);
          await destroyClient();
          const isLast = attempt >= initRetries;
          await upsertSession({
            status: isLast ? "disconnected" : "initializing",
            connected: false, qr_code: null,
            phone_number: null, connected_at: null,
          });
          if (isLast) throw e;
          await sleep(initRetryDelayMs);
        }
      }
    } finally {
      initializing = false;
    }
  })();

  try {
    await startPromise;
  } finally {
    startPromise = null;
  }
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

    if (!canReply() && behavior.anti_spam !== false) {
      await log("warn", `Rate limit atteint, message de ${msg.from} ignoré`);
      return;
    }

    // Extraire le texte (texte, audio transcrit, ou image analysée)
    let userText = "";
    let mediaType = "text";
    let visionContext = "";
    let visionSearchTerms = "";

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
    } else if (msg.type === "image" && behavior.image_reply !== false) {
      mediaType = "image";
      const media = await msg.downloadMedia();
      if (!media) return;
      const mime = (media.mimetype || "image/jpeg").split(";")[0];
      const buf = Buffer.from(media.data, "base64");
      if (buf.length > 3.5 * 1024 * 1024) {
        await log("warn", `Image trop lourde pour vision (${Math.round(buf.length / 1024)} Ko)`);
        userText = msg.body?.trim()
          ? `${msg.body}\n[Image reçue mais trop lourde pour analyse — précise le nom du produit]`
          : "[Image reçue mais trop lourde pour analyse automatique — envoie le nom de la collection]";
      } else {
        const caption = msg.body?.trim() || "";
        const productNames = await getActiveProductNames();
        const collectionsSummary = buildAvailableSummary(await getActiveProducts());
        const vision = await analyzeProductImage({
          base64: media.data,
          mimeType: mime,
          cfg,
          caption,
          productNames,
          collectionsSummary,
        });
        userText = vision.userMessage;
        visionContext = vision.visionContext;
        visionSearchTerms = vision.searchTerms;
        await log("info", `Image analysée · VSM=${vision.parsed.is_vsm_product} · ${vision.parsed.product_guess || "?"}`);
      }
    } else {
      userText = "[Le client a envoyé un média non supporté pour le moment]";
    }

    if (!userText.trim()) return;

    // Contact info
    const contact = await msg.getContact();
    const phone = (msg.from || "").replace("@c.us", "");
    const displayName = contact.pushname || contact.name || contact.shortName || phone;

    // Indicateur "en train d'écrire" + délai humain
    try { await chat.sendStateTyping(); } catch {}
    await sleep(replyDelayMs(cfg));

    // Récupérer l'historique
    const existingConv = await getConversationByPhone(phone);

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

    // Catalogue e-commerce (products + product_variants)
    let catalog = await searchCatalog(visionSearchTerms || userText, cfg);
    if (mediaType === "image" && !catalog.context) {
      catalog = await searchCatalog("collections produits disponibles vsm", cfg);
    }

    // Génération Groq
    const { reply, model } = await generateReply({
      message: userText,
      history,
      cfg,
      catalogContext: catalog.context,
      visionContext,
      clientContext,
    });
    if (!reply) return;

    // Envoi
    try { await chat.clearState(); } catch {}
    await msg.reply(reply);
    markReply();

    // Image produit + lien (pas si le client vient déjà d'envoyer une photo)
    if (behavior.send_product_images !== false && catalog.primary?.image_url && mediaType !== "image") {
      try {
        const url = productUrl(catalog.primary);
        const media = await MessageMedia.fromUrl(catalog.primary.image_url, { unsafeMime: true });
        await client.sendMessage(msg.from, media, {
          caption: `${catalog.primary.name.trim()} — ${url}`,
        });
      } catch (e) {
        await log("warn", `Envoi image produit échoué: ${e.message}`);
      }
    }

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
  await reconnectWhatsApp();
}

/** Force une nouvelle session : purge disque + redémarre WhatsApp (génère un QR). */
export async function reconnectWhatsApp() {
  if (reconnecting) {
    await log("info", "Reconnexion déjà en cours");
    return;
  }

  reconnecting = true;
  initializing = false;
  isReady = false;
  startPromise = null;

  if (client) {
    try { await client.logout(); } catch {}
    await destroyClient();
  }

  try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}

  await upsertSession({
    status: "initializing",
    connected: false,
    qr_code: null,
    phone_number: null,
    connected_at: null,
  });
  await log("warn", "Reconnexion WhatsApp — génération d'un nouveau QR");

  try {
    await startWhatsApp();
  } finally {
    reconnecting = false;
  }
}
