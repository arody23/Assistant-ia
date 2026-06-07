/**
 * Router WhatsApp Cloud API (Meta)
 * --------------------------------
 *  - GET  /api/whatsapp/webhook  : vérification du webhook (Meta)
 *  - POST /api/whatsapp/webhook  : réception messages text + voice
 *  - POST /api/whatsapp/connect / disconnect : simulation pour le dashboard
 *
 *  Doc Meta : https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 *  Pour activer en production :
 *   1. Créer un compte WhatsApp Business (Meta Business Suite)
 *   2. Obtenir WHATSAPP_TOKEN et WHATSAPP_PHONE_NUMBER_ID
 *   3. Configurer le webhook sur Meta avec WHATSAPP_VERIFY_TOKEN
 */

import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

const META_API = "https://graph.facebook.com/v20.0";

async function sendWhatsAppText({ to, body }) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return;
  await axios.post(
    `${META_API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, text: { body } },
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
  );
}

async function downloadWhatsAppMedia(mediaId) {
  const meta = await axios.get(`${META_API}/${mediaId}`, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
  });
  const url = meta.data.url;
  const bin = await axios.get(url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    responseType: "arraybuffer",
  });
  const tmp = path.join(os.tmpdir(), `wa_${Date.now()}.ogg`);
  fs.writeFileSync(tmp, bin.data);
  return tmp;
}

export function buildWhatsAppRouter({ generateReply, transcribeAudio, getConfig, setConfig, addLog }) {
  const router = express.Router();

  // Verification du webhook
  router.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      addLog("success", "Webhook WhatsApp vérifié");
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  // Réception des messages
  router.post("/webhook", async (req, res) => {
    res.sendStatus(200); // ACK immédiat
    try {
      const entry = req.body.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];
      if (!message) return;

      const from = message.from;
      const cfg = await getConfig();
      if (!cfg.bot_active) return;

      let userText = "";
      if (message.type === "text") {
        userText = message.text.body;
      } else if (message.type === "audio" && cfg.behavior?.voice_reply) {
        const tmp = await downloadWhatsAppMedia(message.audio.id);
        userText = await transcribeAudio(tmp, "voice.ogg", cfg);
        fs.unlink(tmp, () => {});
        addLog("info", `Vocal transcrit de ${from} : "${userText.slice(0, 60)}"`);
      } else {
        return;
      }

      const { reply } = await generateReply({ message: userText, history: [], cfg });
      await sendWhatsAppText({ to: from, body: reply });
      addLog("success", `Réponse envoyée à ${from}`);
    } catch (e) {
      addLog("error", `Webhook WhatsApp : ${e.message}`);
    }
  });

  // Simulation depuis le dashboard
  router.post("/connect", async (_req, res) => {
    await setConfig({ whatsapp: { connected: true, phone_number: "+243 81 234 5678", connected_at: new Date().toISOString() } });
    addLog("success", "WhatsApp connecté (simulation)");
    res.json({ connected: true });
  });
  router.post("/disconnect", async (_req, res) => {
    await setConfig({ whatsapp: { connected: false, phone_number: "", connected_at: null } });
    addLog("warn", "WhatsApp déconnecté");
    res.json({ connected: false });
  });

  return router;
}
