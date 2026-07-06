/**
 * Classification CRM automatique (WhatsApp).
 */

const HOT = /\b(commander|j['']achète|je prends|urgent|aujourd['']hui|maintenant|valide|confirme)\b/i;
const WARM = /\b(prix|dispo|taille|couleur|livraison|intéressé|interesse)\b/i;
const SUPPORT = /\b(sav|réclamation|remboursement|échange|problème|défectueux|cassé)\b/i;
const INFO = /\b(horaire|boutique|adresse|où|comment|qui êtes)\b/i;

const SEGMENTS = {
  prospect_cold: "Prospect froid",
  prospect_warm: "Prospect tiède",
  prospect_hot: "Prospect chaud",
  client: "Client",
  client_loyal: "Client fidèle",
  order_abandoned: "Commande abandonnée",
  order_done: "Commande terminée",
  support: "Support / SAV",
  info: "Demande d'information",
};

export function classifyConversation({
  userText = "",
  profile = {},
  orderActive = false,
  orderDraft = null,
  hasPastOrders = false,
  messageCount = 0,
}) {
  const t = userText || "";
  let segment = "prospect_cold";
  let interestDelta = 0;
  let purchaseProbability = 10;
  let urgency = "low";
  let sentiment = "neutral";

  if (SUPPORT.test(t)) {
    segment = "support";
    urgency = "high";
    sentiment = "frustrated";
  } else if (orderDraft?.status === "collecting" && !orderActive) {
    segment = "order_abandoned";
    purchaseProbability = 40;
  } else if (orderDraft?.status === "done") {
    segment = "order_done";
    purchaseProbability = 90;
  } else if (hasPastOrders) {
    segment = messageCount > 10 ? "client_loyal" : "client";
    purchaseProbability = 70;
  } else if (HOT.test(t) || orderActive) {
    segment = "prospect_hot";
    interestDelta = 3;
    purchaseProbability = 75;
    urgency = "high";
  } else if (WARM.test(t)) {
    segment = "prospect_warm";
    interestDelta = 2;
    purchaseProbability = 45;
    urgency = "medium";
  } else if (INFO.test(t)) {
    segment = "info";
    interestDelta = 1;
    purchaseProbability = 15;
  }

  if (/\b(merci|parfait|super|génial)\b/i.test(t)) sentiment = "positive";
  if (/\b(pas content|déçu|nul|arnaque)\b/i.test(t)) sentiment = "negative";

  const tags = [...new Set([...(profile.tags || []), SEGMENTS[segment] || segment])].slice(-8);

  return {
    segment,
    segment_label: SEGMENTS[segment] || segment,
    interest_delta: interestDelta,
    purchase_probability: purchaseProbability,
    urgency,
    sentiment,
    tags,
    crm: {
      last_segment: segment,
      last_sentiment: sentiment,
      purchase_probability: purchaseProbability,
      urgency,
      classified_at: new Date().toISOString(),
    },
  };
}
