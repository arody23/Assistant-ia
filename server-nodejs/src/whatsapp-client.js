/**
 * WhatsApp client (whatsapp-web.js) avec mesures anti-bannissement.
 *
 * Best practices appliquées :
 *  - LocalAuth (session persistante → pas de re-scan à chaque démarrage)
 *  - Délai aléatoire avant réponse (1.2 → 2.8 s)
 *  - Indicateur "en train d'écrire" (sendStateTyping)
 *  - Rate limit (30 réponses / min par défaut)
 *  - Anti-backlog au redémarrage (filigrane + warmup + dédup IDs)
 *  - Arrêt propre SIGTERM (destroy sans logout → session conservée sur volume)
 */

import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import os from "os";

import { getConfig, upsertSession, upsertConversation, insertMessages, recentHistory, getConversationByPhone, updateConversationProfile, getWhatsappMedia } from "./supabase.js";
import { generateReply, transcribeAudio, analyzeProductImage } from "./groq.js";
import { searchCatalog, productUrl, getActiveProductNames, buildAvailableSummary, getActiveProducts } from "./catalog.js";
import { buildClientContextBlock } from "./prompt-builder.js";
import { isOrderFlowActive, detectCancelOrder, buildOrderFlowBlock, processOrderBotReply, stripOrderBotMarkers } from "./order-bot.js";
import { shouldSendProductImage, markProductImageSent } from "./product-images.js";
import { selectAmbassadorAssets, assetsToImages } from "./asset-picker.js";
import { log } from "./logger.js";
import { resolveWaIdentity } from "./phone-utils.js";
import {
  loadWaState,
  markReady,
  markProcessed,
  wasProcessed,
  normalizeMsgTimestamp,
  clearProcessedIds,
} from "./wa-session-state.js";

const sessionDir = process.env.WA_SESSION_DIR || "./.wwebjs_auth";
const minDelay = parseInt(process.env.WA_REPLY_DELAY_MIN_MS || "1200", 10);
const maxDelay = parseInt(process.env.WA_REPLY_DELAY_MAX_MS || "2800", 10);
const rateLimit = parseInt(process.env.WA_RATE_LIMIT_PER_MIN || "30", 10);
const warmupMs = parseInt(process.env.WA_BACKLOG_WARMUP_MS || "120000", 10);
const maxMsgAgeSec = parseInt(process.env.WA_MAX_MSG_AGE_SEC || "45", 10);

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
let softRestarting = false;
let startPromise = null;
let autoReconnectTimer = null;
let waState = loadWaState(sessionDir);

const initRetries = parseInt(process.env.WA_INIT_RETRIES || "3", 10);
const initRetryDelayMs = parseInt(process.env.WA_INIT_RETRY_DELAY_MS || "15000", 10);

export function getClient() { return client; }
export function isClientReady() { return isReady; }

function getMsgId(msg) {
  return msg?.id?._serialized || msg?.id || null;
}

function shouldIgnoreBacklog(msg) {
  const msgId = getMsgId(msg);
  if (wasProcessed(waState, msgId)) return { ignore: true, reason: "déjà traité", msgId };

  const msgTs = normalizeMsgTimestamp(msg.timestamp);
  const nowSec = Math.floor(Date.now() / 1000);
  const ageSec = nowSec - msgTs;

  const ignoreBefore = waState.ignoreBeforeSec || 0;
  if (ignoreBefore && msgTs > 0 && msgTs < ignoreBefore) {
    return { ignore: true, reason: "antérieur au démarrage", msgId };
  }

  if (waState.warmupUntilMs && Date.now() < waState.warmupUntilMs && ageSec > 2) {
    return { ignore: true, reason: "backlog (warmup)", msgId };
  }

  if (ageSec > maxMsgAgeSec) {
    return { ignore: true, reason: `trop ancien (${ageSec}s)`, msgId };
  }

  return { ignore: false, msgId };
}

async function snapshotAndMarkBacklog(waClient) {
  try {
    const chats = await waClient.getChats();
    const perChat = parseInt(process.env.WA_BACKLOG_SNAPSHOT_PER_CHAT || "50", 10);
    let count = 0;
    for (const chat of chats) {
      try {
        const msgs = await chat.fetchMessages({ limit: perChat });
        for (const m of msgs) {
          const id = getMsgId(m);
          if (id) {
            waState = markProcessed(sessionDir, waState, id);
            count++;
          }
        }
        try { await chat.sendSeen(); } catch {}
      } catch {}
    }
    if (count) await log("info", `Backlog snapshot: ${count} message(s) marqués sans réponse`);
  } catch (e) {
    await log("warn", `Snapshot backlog: ${e.message}`);
  }
}

function dismissMessage(msg) {
  const id = getMsgId(msg);
  if (id) waState = markProcessed(sessionDir, waState, id);
}

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
    isReady = false;
    waState = markReady(sessionDir, waState, { warmupMs });
    waState = clearProcessedIds(sessionDir, waState);
    await snapshotAndMarkBacklog(waClient);
    isReady = true;
    const me = waClient.info?.wid?.user || "";
    await log("success", `Bot WhatsApp prêt · +${me} · anti-backlog ${warmupMs / 1000}s`);
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
    if (reconnecting || initializing || softRestarting) return;
    scheduleSoftRestart(8000);
  });

  waClient.on("message", handleMessage);
}

function createClient() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: sessionDir }),
    authTimeoutMs: parseInt(process.env.WA_AUTH_TIMEOUT_MS || "120000", 10),
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

function scheduleSoftRestart(delayMs = 5000) {
  if (autoReconnectTimer || reconnecting) return;
  autoReconnectTimer = setTimeout(() => {
    autoReconnectTimer = null;
    restartWhatsApp().catch((e) => log("error", `Auto-restart WA: ${e.message}`));
  }, delayMs);
}

/** Redémarre le client SANS effacer la session (redeploy, déconnexion réseau). */
export async function restartWhatsApp() {
  if (reconnecting) return;
  if (softRestarting) return;
  softRestarting = true;
  try {
    await log("info", "Redémarrage WhatsApp (session conservée sur disque)…");
    await destroyClient();
    startPromise = null;
    await startWhatsApp();
  } finally {
    softRestarting = false;
  }
}

async function startWhatsAppOnce() {
  if (client) await destroyClient();

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
  if (isReady && client) return;

  startPromise = (async () => {
    if (initializing) return;
    initializing = true;

    try {
      waState = loadWaState(sessionDir);
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
    if (!isReady) {
      dismissMessage(msg);
      return;
    }
    if (msg.fromMe) return;
    if (msg.isStatus) return;

    const backlog = shouldIgnoreBacklog(msg);
    if (backlog.ignore) {
      if (backlog.msgId) waState = markProcessed(sessionDir, waState, backlog.msgId);
      await log("info", `Message ignoré (${backlog.reason}) de ${msg.from}`);
      return;
    }

    const cfg = await getConfig();
    if (!cfg.bot_active) {
      dismissMessage(msg);
      return;
    }

    const behavior = cfg.behavior || {};
    const chat = await msg.getChat();
    if (chat.isGroup && behavior.ignore_groups !== false) {
      dismissMessage(msg);
      return;
    }

    if (!canReply() && behavior.anti_spam !== false) {
      await log("warn", `Rate limit atteint, message de ${msg.from} ignoré`);
      dismissMessage(msg);
      return;
    }

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

    if (!userText.trim()) {
      dismissMessage(msg);
      return;
    }

    const contact = await msg.getContact();
    const { phone, e164 } = resolveWaIdentity(contact, msg.from);
    const checkoutPhone = e164 || phone;
    const displayName = contact.pushname || contact.name || contact.shortName || phone;

    try { await chat.sendStateTyping(); } catch {}
    await sleep(replyDelayMs(cfg));

    const existingConv = await getConversationByPhone(phone)
      || (e164 && e164 !== phone ? await getConversationByPhone(e164) : null);

    let history = [];
    if (existingConv?.id && behavior.remember_history !== false) {
      history = await recentHistory(existingConv.id, cfg.memory_msgs || 8);
    }

    const profile = existingConv?.profile || {};

    if (detectCancelOrder(userText) && profile?.order_draft?.status && profile.order_draft.status !== "done") {
      const convId = existingConv?.id;
      if (convId) {
        await updateConversationProfile(convId, {
          profile: {
            ...profile,
            order_draft: { status: "done", cancelled_at: new Date().toISOString() },
          },
        });
      }
      await msg.reply("D'accord, j'annule la commande en cours. Dis-moi si tu veux autre chose.");
      dismissMessage(msg);
      return;
    }
    const clientContext = buildClientContextBlock({
      name: displayName,
      status: profile.status,
      tags: profile.tags,
      kit_paid: profile.kit_paid,
      ambassador_applied: profile.ambassador_applied,
      summary: existingConv?.summary,
      notes: existingConv?.notes,
    });

    let catalog = await searchCatalog(visionSearchTerms || userText, cfg);
    if (mediaType === "image" && !catalog.context) {
      catalog = await searchCatalog("collections produits disponibles vsm", cfg);
    }

    const orderActive = isOrderFlowActive(cfg, profile, userText);
    const orderBlock = orderActive ? await buildOrderFlowBlock(cfg, profile, catalog, checkoutPhone) : "";

    let { reply, model } = await generateReply({
      message: userText,
      history,
      cfg,
      catalogContext: catalog.context,
      visionContext,
      clientContext,
      extra: orderBlock,
    });
    if (!reply) {
      try { await chat.clearState(); } catch {}
      dismissMessage(msg);
      return;
    }

    let orderProfilePatch = null;
    if (orderActive) {
      const processed = await processOrderBotReply({ reply, profile, phone: checkoutPhone, catalog, cfg });
      reply = processed.reply;
      if (processed.profilePatch) {
        orderProfilePatch = { ...profile, ...processed.profilePatch };
      }
    } else {
      reply = stripOrderBotMarkers(reply);
    }

    try { await chat.clearState(); } catch {}
    await msg.reply(reply);
    markReply();

    if (backlog.msgId) waState = markProcessed(sessionDir, waState, backlog.msgId);

    let profilePatch = null;
    if (
      behavior.send_product_images !== false
      && shouldSendProductImage({ userText, catalog, profile })
      && mediaType !== "image"
    ) {
      try {
        const url = productUrl(catalog.primary);
        const media = await MessageMedia.fromUrl(catalog.primary.image_url, { unsafeMime: true });
        await client.sendMessage(msg.from, media, {
          caption: `${catalog.primary.name.trim()} — ${url}`,
        });
        profilePatch = markProductImageSent(profile, catalog.primary);
      } catch (e) {
        await log("warn", `Envoi image produit échoué: ${e.message}`);
      }
    }

    try {
      const waMedia = await getWhatsappMedia();
      const picked = selectAmbassadorAssets(userText, reply, waMedia);
      for (const img of assetsToImages(picked)) {
        const media = await MessageMedia.fromUrl(img.url, { unsafeMime: true });
        await client.sendMessage(msg.from, media, { caption: img.caption || "" });
      }
    } catch (e) {
      await log("warn", `Médias WhatsApp: ${e.message}`);
    }

    const conversationId = await upsertConversation({ phone, name: displayName, last_message: reply.slice(0, 200) });
    const convId = existingConv?.id || conversationId;
    let finalProfile = null;
    if (orderProfilePatch) finalProfile = { ...profile, ...orderProfilePatch };
    if (profilePatch) finalProfile = { ...(finalProfile || profile), ...profilePatch };
    if (finalProfile && convId) {
      if (e164) finalProfile = { ...finalProfile, wa_e164: e164 };
      await updateConversationProfile(convId, { profile: finalProfile });
    }
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
    try {
      const chat = await msg.getChat();
      await chat.clearState();
    } catch {}
  }
}

/** Arrêt propre (deploy Railway) — destroy sans logout, session LocalAuth conservée. */
export async function gracefulShutdownWhatsApp() {
  if (autoReconnectTimer) {
    clearTimeout(autoReconnectTimer);
    autoReconnectTimer = null;
  }
  await log("info", "Arrêt propre WhatsApp (session conservée)…");
  await destroyClient();
}

export async function logoutWhatsApp() {
  await reconnectWhatsApp();
}

/** Reset manuel dashboard — purge session + nouveau QR. */
export async function reconnectWhatsApp() {
  if (reconnecting) {
    await log("info", "Reconnexion déjà en cours");
    return;
  }

  reconnecting = true;
  initializing = false;
  isReady = false;
  startPromise = null;
  if (autoReconnectTimer) {
    clearTimeout(autoReconnectTimer);
    autoReconnectTimer = null;
  }

  if (client) {
    try { await client.logout(); } catch {}
    await destroyClient();
  }

  try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
  waState = { processedIds: [], ignoreBeforeSec: 0, lastReadyAtSec: 0, warmupUntilMs: 0 };

  await upsertSession({
    status: "initializing",
    connected: false,
    qr_code: null,
    phone_number: null,
    connected_at: null,
  });
  await log("warn", "Reset session WhatsApp — nouveau QR requis");

  try {
    await startWhatsApp();
  } finally {
    reconnecting = false;
  }
}
