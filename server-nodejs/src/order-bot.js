/**
 * Phase C — Commandes conversationnelles via WhatsApp IA
 * État multi-tour stocké dans conversations.profile.order_draft
 */

import { getSupabase } from "./supabase.js";
import { createOrderRecord } from "./orders.js";
import { log } from "./logger.js";

const ORDER_INTENT =
  /\b(commander|commande|je veux|j['']aimerais|acheter|passer commande|livraison|livrer|je n['']arrive pas|impossible de commander|prendre une|une commande|je prends|valide|confirme ma commande)\b/i;

const ORDER_MARKER_RE = /<!--ORDER_BOT:([\s\S]*?)-->/;

export function detectOrderIntent(text) {
  return ORDER_INTENT.test(text || "");
}

export function isOrderFlowActive(cfg, profile, userText) {
  if (cfg?.behavior?.order_via_whatsapp === false) return false;
  const draft = profile?.order_draft;
  if (draft?.status && draft.status !== "done") return true;
  return detectOrderIntent(userText);
}

export function emptyOrderDraft(phone = "") {
  return {
    status: "collecting",
    customer_name: "",
    customer_phone: phone ? `+${phone.replace(/\D/g, "")}` : "",
    delivery_address: "",
    delivery_date: "",
    urgent: false,
    items: [],
    updated_at: new Date().toISOString(),
  };
}

function draftSummary(draft) {
  const lines = ["--- COMMANDE EN COURS (brouillon client)"];
  lines.push(`Statut: ${draft.status || "collecting"}`);
  lines.push(`Nom: ${draft.customer_name || "?"}`);
  lines.push(`Téléphone: ${draft.customer_phone || "?"}`);
  lines.push(`Adresse: ${draft.delivery_address || "?"}`);
  lines.push(`Date/heure livraison: ${draft.delivery_date || "?"}`);
  lines.push(`Urgent: ${draft.urgent ? "oui" : "non"}`);
  if (draft.items?.length) {
    lines.push("Articles:");
    for (const it of draft.items) {
      lines.push(`  • ${it.product_name || "?"} — ${it.color || "?"} / ${it.size || "?"} ×${it.quantity || 1}`);
    }
  } else {
    lines.push("Articles: (aucun pour l'instant)");
  }
  const missing = missingFields(draft);
  if (missing.length) lines.push(`Champs manquants: ${missing.join(", ")}`);
  return lines.join("\n");
}

function missingFields(draft) {
  const miss = [];
  if (!draft.customer_name?.trim()) miss.push("nom complet");
  if (!draft.customer_phone?.trim()) miss.push("téléphone");
  if (!draft.delivery_address?.trim()) miss.push("adresse de livraison");
  if (!draft.delivery_date?.trim()) miss.push("date/heure de livraison");
  if (!draft.items?.length) miss.push("au moins un article (produit, taille, couleur)");
  else {
    const it = draft.items[0];
    if (!it.product_name?.trim()) miss.push("nom du produit");
    if (!it.size?.trim()) miss.push("taille");
  }
  return miss;
}

export function buildOrderFlowBlock(cfg, profile, catalog, phone) {
  const draft = profile?.order_draft?.status && profile.order_draft.status !== "done"
    ? profile.order_draft
    : emptyOrderDraft(phone);

  return [
    "--- PRISE DE COMMANDE WHATSAPP (mode actif)",
    "Le client souhaite commander ou finaliser une commande. Collecte les informations manquantes UNE PAR UNE, de façon naturelle.",
    "Champs requis: nom complet, téléphone, adresse de livraison, produit/collection, taille, couleur, date/heure souhaitée pour la livraison.",
    "Utilise UNIQUEMENT les prix et stocks du catalogue. Ne invente pas de disponibilité.",
    "Si le client ne peut pas commander sur le site, propose de prendre la commande ici.",
    "Demande confirmation explicite avant validation (« Tu confirmes cette commande ? »).",
    "",
    draftSummary(draft),
    "",
    "À la fin de CHAQUE réponse, ajoute une ligne invisible pour le système (le client ne la voit pas) :",
    '<!--ORDER_BOT:{"action":"update_draft","fields":{...}}-->',
    "Actions possibles:",
    '- update_draft: fusionne les champs connus (customer_name, customer_phone, delivery_address, delivery_date, urgent, items: [{product_name, size, color, quantity, product_id, unit_price}])',
    '- create_order: uniquement si TOUS les champs sont remplis ET le client a confirmé',
    '- cancel_order: si le client abandonne',
    "Exemple: <!--ORDER_BOT:{\"action\":\"update_draft\",\"fields\":{\"customer_name\":\"Jean\"}}-->",
    catalog?.primary
      ? `Produit probable du catalogue: ${catalog.primary.name} — prix catalogue à utiliser.`
      : null,
  ].filter(Boolean).join("\n");
}

export function parseOrderBotMarker(reply) {
  const match = (reply || "").match(ORDER_MARKER_RE);
  if (!match) return { cleanReply: (reply || "").trim(), payload: null };
  const cleanReply = reply.replace(ORDER_MARKER_RE, "").trim();
  try {
    return { cleanReply, payload: JSON.parse(match[1]) };
  } catch {
    return { cleanReply, payload: null };
  }
}

function mergeDraft(existing, fields = {}, catalog) {
  const draft = { ...(existing || emptyOrderDraft()), ...fields, items: [...(existing?.items || [])] };
  if (fields.items?.length) {
    draft.items = fields.items.map((it) => {
      const item = { quantity: 1, ...it };
      if (!item.unit_price && catalog?.primary) {
        item.unit_price = Number(catalog.primary.price) || 0;
        item.product_id = catalog.primary.id;
        if (!item.product_name) item.product_name = catalog.primary.name;
      }
      return item;
    });
  } else if (fields.product_name || fields.size || fields.color) {
    const base = draft.items[0] || { quantity: 1 };
    draft.items = [{
      ...base,
      product_name: fields.product_name || base.product_name,
      size: fields.size || base.size,
      color: fields.color || base.color,
      product_id: fields.product_id || base.product_id || catalog?.primary?.id || null,
      unit_price: fields.unit_price || base.unit_price || Number(catalog?.primary?.price) || 0,
      quantity: fields.quantity || base.quantity || 1,
    }];
  }
  draft.updated_at = new Date().toISOString();
  if (missingFields(draft).length === 0) draft.status = "confirming";
  else draft.status = "collecting";
  return draft;
}

async function resolveUnitPrices(draft) {
  const supabase = getSupabase();
  if (!supabase) return draft;
  const items = [];
  for (const it of draft.items || []) {
    const row = { ...it };
    if (!row.unit_price && row.product_id) {
      const { data } = await supabase.from("products").select("price,name").eq("id", row.product_id).maybeSingle();
      if (data) {
        row.unit_price = Number(data.price) || 0;
        if (!row.product_name) row.product_name = data.name;
      }
    }
    items.push(row);
  }
  return { ...draft, items };
}

export async function processOrderBotReply({ reply, profile, phone, catalog, cfg }) {
  const { cleanReply, payload } = parseOrderBotMarker(reply);
  if (!payload?.action) {
    return { reply: cleanReply, profilePatch: null, orderCreated: null };
  }

  let draft = profile?.order_draft?.status && profile.order_draft.status !== "done"
    ? { ...profile.order_draft }
    : emptyOrderDraft(phone);

  if (payload.action === "cancel_order") {
    return {
      reply: cleanReply,
      profilePatch: { order_draft: { status: "done", cancelled_at: new Date().toISOString() } },
      orderCreated: null,
    };
  }

  if (payload.action === "update_draft" && payload.fields) {
    draft = mergeDraft(draft, payload.fields, catalog);
    return {
      reply: cleanReply,
      profilePatch: { order_draft: draft },
      orderCreated: null,
    };
  }

  if (payload.action === "create_order") {
    draft = mergeDraft(draft, payload.fields || {}, catalog);
    draft = await resolveUnitPrices(draft);
    const missing = missingFields(draft);
    if (missing.length) {
      await log("warn", `Commande incomplète: ${missing.join(", ")}`);
      return {
        reply: cleanReply,
        profilePatch: { order_draft: { ...draft, status: "collecting" } },
        orderCreated: null,
      };
    }

    try {
      const { order, items } = await createOrderRecord({
        customer_name: draft.customer_name.trim(),
        customer_phone: draft.customer_phone.trim(),
        delivery_address: draft.delivery_address.trim(),
        delivery_date: draft.delivery_date.trim(),
        urgent: !!draft.urgent,
        items: draft.items,
        order_source: "whatsapp_bot",
        status: "pending",
      }, cfg);

      await log("success", `Commande #${order.id} créée via conversation WA`);

      return {
        reply: cleanReply,
        profilePatch: { order_draft: { status: "done", order_id: order.id, completed_at: new Date().toISOString() } },
        orderCreated: { order, items },
      };
    } catch (e) {
      await log("error", `Création commande bot: ${e.message}`);
      return {
        reply: `${cleanReply}\n\n(Désolé, un problème technique empêche d'enregistrer la commande. Notre équipe va te recontacter.)`,
        profilePatch: { order_draft: draft },
        orderCreated: null,
      };
    }
  }

  return { reply: cleanReply, profilePatch: null, orderCreated: null };
}
