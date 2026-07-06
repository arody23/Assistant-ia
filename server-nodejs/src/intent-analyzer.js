/**
 * Analyse d'intention légère (avant appel LLM).
 * Le workflow métier est piloté par conversation-state.js.
 */

const SIZES = ["3xl", "xxl", "xl", "l", "m", "s", "xs"];

const PATTERNS = {
  greeting: /\b(bonjour|bonsoir|salut|hello|hey|coucou|mbote)\b/i,
  order: /\b(commander|passer commande|je veux commander|prendre une commande|valide|confirme ma commande|j['']achète|je prends)\b/i,
  cancel: /\b(annule|annuler|stop|laisse tomber|oublie)\b/i,
  delivery: /\b(livraison|frais de livraison|commune|zone de livraison|livrer|délai)\b/i,
  availability: /\b(dispo|disponible|en stock|stock|avoir|trouver|existe)\b/i,
  price: /\b(prix|co[uû]t|combien|tarif)\b/i,
  collection: /\b(collection|produit|article|hoodie|t-?shirt|veste|renescentia|classic|eclipse)\b/i,
  ambassador: /\b(ambassadeur|kit|programme|commission)\b/i,
  support: /\b(sav|réclamation|remboursement|échange|problème|défectueux)\b/i,
  thanks: /\b(merci|thanks|ok parfait|super)\b/i,
};

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

export function parseSize(text) {
  const q = norm(text);
  for (const s of SIZES) {
    if (new RegExp(`\\b${s}\\b`).test(q)) return s.toUpperCase();
  }
  return null;
}

export function parseColor(text, knownColors = []) {
  const q = norm(text);
  for (const c of knownColors) {
    const n = norm(c);
    if (n && q.includes(n)) return c;
  }
  const basic = ["noir", "blanc", "rouge", "bleu", "vert", "gris", "beige", "marron", "jaune", "orange", "rose", "violet"];
  for (const c of basic) {
    if (new RegExp(`\\b${c}\\b`).test(q)) return c;
  }
  return null;
}

export function analyzeIntent(text, { saleFlow = {}, history = [] } = {}) {
  const t = text || "";
  const intents = [];

  if (PATTERNS.cancel.test(t)) intents.push("cancel");
  if (PATTERNS.order.test(t)) intents.push("order");
  if (PATTERNS.delivery.test(t)) intents.push("delivery");
  if (PATTERNS.support.test(t)) intents.push("support");
  if (PATTERNS.ambassador.test(t)) intents.push("ambassador");
  if (PATTERNS.price.test(t)) intents.push("price");
  if (PATTERNS.availability.test(t)) intents.push("availability");
  if (PATTERNS.collection.test(t)) intents.push("collection");
  if (PATTERNS.greeting.test(t) && t.length < 40) intents.push("greeting");
  if (PATTERNS.thanks.test(t)) intents.push("thanks");

  const size = parseSize(t);
  const color = parseColor(t, saleFlow.known_colors || []);

  if (size) intents.push("size_answer");
  if (color) intents.push("color_answer");

  const primary = intents[0]
    || (saleFlow.state && saleFlow.state !== "idle" ? "follow_up" : "general");

  return {
    primary,
    all: [...new Set(intents)],
    size,
    color,
    isShort: t.trim().split(/\s+/).length <= 4,
    hasHistory: (history || []).length > 0,
  };
}
