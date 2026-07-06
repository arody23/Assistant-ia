/**
 * Garde-fous anti-hallucination avant envoi client.
 */

import { buildConversationRulesBlock } from "./prompt-builder.js";

const STOCK_PATTERN = /\b\d+\s*(pi[eè]ces?|en stock|restants?|disponibles?)\b/i;
const DB_LEAK = /\b(base de donn[eé]es|sql|supabase|introuvable en base|pas dans la db|erreur technique)\b/i;

export function buildPolicyBlock(cfg = {}) {
  return buildConversationRulesBlock(cfg);
}

export function sanitizeReply(text, { saleFlow = {}, orderActive = false } = {}) {
  let out = (text || "").trim();
  if (!out) return out;

  out = out.replace(DB_LEAK, "");

  const earlyStates = ["idle", "collection_pick", "ask_size", "ask_color"];
  if (!orderActive && earlyStates.includes(saleFlow.state)) {
    if (STOCK_PATTERN.test(out)) {
      out = out.replace(STOCK_PATTERN, "").trim();
    }
  }

  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out || "Dis-moi ce que tu cherches et je t'oriente.";
}

export function logDecision(trace = {}) {
  const parts = [
    trace.intent ? `intent=${trace.intent}` : null,
    trace.state ? `state=${trace.state}` : null,
    trace.match ? `match=${trace.match}` : null,
    trace.product ? `product=${trace.product}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
