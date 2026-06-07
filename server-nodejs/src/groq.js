import Groq from "groq-sdk";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { log } from "./logger.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generateReply({ message, history = [], cfg }) {
  const systemMsg = { role: "system", content: cfg.system_prompt || "" };
  const memMsgs = (history || []).slice(-(cfg.memory_msgs || 8));
  const messages = [systemMsg, ...memMsgs, { role: "user", content: message }];

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
