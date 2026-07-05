import Groq from "groq-sdk";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { log } from "./logger.js";
import {
  getPrompts,
  substitutePlaceholders,
  buildSystemPrompt,
  detectArchivedCollection,
  buildArchivedHint,
} from "./prompt-builder.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

function parseVisionJson(raw) {
  const text = (raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : text;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * Analyse une image client (vision Groq).
 * Le prompt vision est configurable via dashboard → behavior.prompts.vision
 */
export async function analyzeProductImage({
  base64, mimeType, cfg, caption = "", productNames = [], collectionsSummary = "",
}) {
  const names = productNames.length ? productNames.join(", ") : "Renescentia, Classic of life";
  const prompts = getPrompts(cfg);
  const visionPrompt = substitutePlaceholders(prompts.vision, {
    COLLECTIONS: names,
    COLLECTION: names,
  });

  const prompt = `${visionPrompt}

Un client a envoyé cette photo${caption ? ` avec le message: "${caption}"` : ""}.

Réponds UNIQUEMENT en JSON valide:
{
  "is_vsm_product": "yes" | "no" | "uncertain",
  "confidence": "high" | "medium" | "low",
  "product_guess": "nom collection si reconnu, sinon null",
  "garment_type": "type de vêtement",
  "colors_visible": ["couleurs"],
  "text_on_garment": "texte sur le vêtement ou null",
  "summary_fr": "résumé court en français"
}`;

  const dataUrl = `data:${mimeType || "image/jpeg"};base64,${base64}`;
  const c = await groq.chat.completions.create({
    model: cfg.vision_model || VISION_MODEL,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    }],
    max_tokens: 600,
    temperature: 0.2,
  });

  const raw = c.choices[0]?.message?.content || "";
  const parsed = parseVisionJson(raw) || {
    is_vsm_product: "uncertain",
    confidence: "low",
    product_guess: null,
    garment_type: "",
    colors_visible: [],
    text_on_garment: null,
    summary_fr: raw.slice(0, 400),
  };

  const searchTerms = [
    caption, parsed.product_guess, parsed.text_on_garment,
    parsed.garment_type, ...(parsed.colors_visible || []), parsed.summary_fr,
  ].filter(Boolean).join(" ");

  const userMessage = [
    caption ? `Message client: ${caption}` : "Le client a envoyé une photo.",
    `Analyse image: ${parsed.summary_fr}`,
    parsed.product_guess ? `Produit identifié: ${parsed.product_guess}` : null,
  ].filter(Boolean).join("\n");

  const archived = detectArchivedCollection(searchTerms, cfg);
  const guessNorm = (parsed.product_guess || "").toLowerCase();
  const guessIsActive = names.some((n) => {
    const nn = n.toLowerCase();
    return guessNorm && (nn.includes(guessNorm) || guessNorm.includes(nn));
  });

  const lines = [
    "ANALYSE IMAGE:",
    `- VSM: ${parsed.is_vsm_product} (${parsed.confidence})`,
    parsed.product_guess ? `- Collection: ${parsed.product_guess}` : null,
    parsed.text_on_garment ? `- Texte vêtement: ${parsed.text_on_garment}` : null,
    `- Résumé: ${parsed.summary_fr}`,
  ];

  if (parsed.is_vsm_product === "no") {
    lines.push(`→ ${substitutePlaceholders(getPrompts(cfg).not_in_catalog, { COLLECTIONS: names })}`);
  } else if (archived && !guessIsActive) {
    lines.push(`→ ${buildArchivedHint(cfg, archived, collectionsSummary || names)}`);
  } else {
    lines.push("→ Utilise UNIQUEMENT le catalogue injecté pour prix/stock. Ne dis pas qu'une collection active est discontinuée.");
  }

  return {
    parsed,
    searchTerms,
    userMessage,
    visionContext: lines.filter(Boolean).join("\n"),
    model: cfg.vision_model || VISION_MODEL,
  };
}

export async function generateReply({ message, history = [], cfg, catalogContext = "", visionContext = "", clientContext = "", extra = "" }) {
  const systemContent = buildSystemPrompt(cfg, { catalogContext, visionContext, clientContext, extra });
  const memMsgs = (history || []).slice(-(cfg.memory_msgs || 8));
  const messages = [{ role: "system", content: systemContent }, ...memMsgs, { role: "user", content: message }];

  const primary = cfg.model || "llama-3.1-8b-instant";
  const fallback = cfg.fallback_model || "llama-3.3-70b-versatile";

  try {
    const c = await groq.chat.completions.create({
      model: primary, messages,
      max_tokens: cfg.max_tokens || 512,
      temperature: cfg.temperature ?? 0.4,
    });
    return { reply: c.choices[0]?.message?.content || "", model: primary };
  } catch (err) {
    await log("warn", `Modèle ${primary} échec, fallback ${fallback}: ${err.message}`);
    const c = await groq.chat.completions.create({
      model: fallback, messages,
      max_tokens: cfg.max_tokens || 1024,
      temperature: cfg.temperature ?? 0.4,
    });
    return { reply: c.choices[0]?.message?.content || "", model: fallback };
  }
}

export async function transcribeAudio(filePath, fileName, cfg) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), fileName);
  form.append("model", cfg.whisper_model || "whisper-large-v3");
  const { data } = await axios.post(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    form,
    {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, ...form.getHeaders() },
      maxBodyLength: 30 * 1024 * 1024,
    }
  );
  return data.text || "";
}
