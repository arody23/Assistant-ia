/**
 * Commandes conversationnelles WhatsApp — brouillon + création en base
 */

import { getSupabase } from "./supabase.js";
import { createOrderRecord } from "./orders.js";
import { log } from "./logger.js";
import {
  getCustomerCheckoutContext,
  getDeliveryZones,
  matchDeliveryZone,
  formatCheckoutCustomerBlock,
  formatDeliveryZonesCompact,
} from "./checkout-context.js";

const ORDER_INTENT =
  /\b(commander|passer commande|je veux commander|prendre une commande|confirme ma commande|valide ma commande|je n['']arrive pas.*commander|impossible de commander|annule.*commande|annuler la commande)\b/i;

const CANCEL_INTENT = /\b(annule|annuler|stop|laisse tomber|oublie la commande)\b/i;

const MARKER_PATTERNS = [
  /<!--\s*ORDER_BOT:\s*(\{[\s\S]*?\})\s*-->/i,
  /<!--\s*ORDER_BOT:\s*(\{[\s\S]*?)\s*\)?\s*$/im,
  /\bORDER_BOT:\s*(\{[\s\S]*?\})\s*\)?/i,
];

export function detectOrderIntent(text) {
  return ORDER_INTENT.test(text || "");
}

export function detectCancelOrder(text) {
  return CANCEL_INTENT.test(text || "");
}

export function isOrderFlowActive(cfg, profile, userText) {
  if (cfg?.behavior?.order_via_whatsapp === false) return false;
  if (CANCEL_INTENT.test(userText || "")) return false;
  const draft = profile?.order_draft;
  if (draft?.status && draft.status !== "done") return true;
  return detectOrderIntent(userText);
}

export function emptyOrderDraft(phone = "", checkout = {}) {
  const digits = String(phone || "").replace(/\D/g, "");
  return {
    status: "collecting",
    customer_name: checkout.name || "",
    customer_phone: checkout.phone || (digits ? `+${digits}` : ""),
    delivery_address: checkout.address || "",
    delivery_date: "",
    delivery_zone_id: null,
    delivery_fee: 0,
    urgent: false,
    items: [],
    updated_at: new Date().toISOString(),
  };
}

function tryParseJson(raw) {
  const s = (raw || "").trim();
  if (!s) return null;
  const attempts = [s, s.replace(/,\s*$/, ""), `${s}}`, `${s}}}`];
  for (const cand of attempts) {
    try {
      return JSON.parse(cand);
    } catch {
      /* next */
    }
  }
  return null;
}

/** Retire tout marqueur ORDER_BOT du texte visible client. */
export function stripOrderBotMarkers(text) {
  return (text || "")
    .replace(/<!--\s*ORDER_BOT:[\s\S]*?(?:-->|$)/gi, "")
    .replace(/\bORDER_BOT:\s*\{[\s\S]*?\}\s*\)?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseOrderBotMarker(reply) {
  const raw = reply || "";
  let payload = null;

  for (const re of MARKER_PATTERNS) {
    const match = raw.match(re);
    if (!match) continue;
    payload = tryParseJson(match[1]);
    if (payload?.action) break;
  }

  const cleanReply = stripOrderBotMarkers(raw);
  return { cleanReply, payload };
}

function draftSummary(draft) {
  const lines = ["--- COMMANDE EN COURS (brouillon)"];
  lines.push(`Nom: ${draft.customer_name || "?"}`);
  lines.push(`Téléphone: ${draft.customer_phone || "?"}`);
  lines.push(`Adresse: ${draft.delivery_address || "?"}`);
  lines.push(`Commune/zone: ${draft.delivery_zone_name || "?"}`);
  lines.push(`Frais livraison: ${Number(draft.delivery_fee || 0).toLocaleString("fr-FR")} FC`);
  lines.push(`Date/heure livraison: ${draft.delivery_date || "?"}`);
  lines.push(`Urgent: ${draft.urgent ? "oui" : "non"}`);
  if (draft.items?.length) {
    lines.push("Articles:");
    for (const it of draft.items) {
      lines.push(`  • ${it.product_name} — ${it.color || "?"} / ${it.size || "?"} ×${it.quantity || 1}`);
    }
  }
  const missing = missingFields(draft);
  if (missing.length) lines.push(`Manque: ${missing.join(", ")}`);
  return lines.join("\n");
}

function missingFields(draft) {
  const miss = [];
  if (!draft.customer_name?.trim()) miss.push("nom complet");
  if (!draft.customer_phone?.trim()) miss.push("téléphone");
  if (!draft.delivery_address?.trim()) miss.push("adresse + commune");
  if (!draft.delivery_date?.trim()) miss.push("date/heure livraison");
  if (!draft.items?.length) miss.push("article (produit, taille, couleur)");
  else {
    const it = draft.items[0];
    if (!it.product_name?.trim()) miss.push("nom produit");
    if (!it.size?.trim()) miss.push("taille");
  }
  return miss;
}

function normalizeOrderFields(fields = {}) {
  const f = { ...fields };
  if (f.delivery_time) {
    f.delivery_date = [f.delivery_date, f.delivery_time].filter(Boolean).join(" ").trim();
    delete f.delivery_time;
  }
  if (typeof f.urgent === "string") {
    f.urgent = /^(true|oui|yes|1|urgent)$/i.test(f.urgent);
  }
  return f;
}

export async function buildOrderFlowBlock(cfg, profile, catalog, phone) {
  const checkout = await getCustomerCheckoutContext(phone);
  const zones = await getDeliveryZones();

  const draft = profile?.order_draft?.status && profile.order_draft.status !== "done"
    ? profile.order_draft
    : emptyOrderDraft(phone, checkout);

  const customInstructions = cfg?.behavior?.order_instructions?.trim() || "";

  return [
    "--- PRISE DE COMMANDE WHATSAPP",
    "Le client veut commander. Collecte les infos manquantes une par une, confirme avant validation.",
    "Champs: nom, téléphone, adresse complète (avec commune), produit, taille, couleur, date/heure livraison.",
    "Utilise les prix catalogue + frais livraison commune ci-dessous. Ne invente rien.",
    customInstructions ? `Instructions admin:\n${customInstructions}` : null,
    formatCheckoutCustomerBlock(checkout),
    formatDeliveryZonesCompact(zones, draft.delivery_address),
    draftSummary(draft),
    "",
    "SYSTÈME (invisible client) — termine ta réponse par UNE ligne exacte:",
    '<!--ORDER_BOT:{"action":"update_draft","fields":{...}}-->',
    "ou <!--ORDER_BOT:{\"action\":\"create_order\",\"fields\":{...}}--> après confirmation client.",
    "OBLIGATOIRE: fermer par --> . Champs fields: customer_name, customer_phone, delivery_address, delivery_date, urgent, items[], delivery_zone_name.",
    catalog?.primary ? `Produit catalogue probable: ${catalog.primary.name} — ${catalog.primary.price} FC` : null,
  ].filter(Boolean).join("\n");
}

function normName(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

async function pickProduct(catalog, fields, draft) {
  const supabase = getSupabase();
  const products = catalog?.products || [];
  if (fields.product_id && supabase) {
    const { data } = await supabase.from("products").select("*").eq("id", fields.product_id).maybeSingle();
    if (data) return data;
  }
  const name = fields.product_name || draft.items?.[0]?.product_name;
  if (name) {
    const n = normName(name);
    const p = products.find((x) => {
      const pn = normName(x.name);
      return pn.includes(n) || n.includes(pn);
    });
    if (p) return p;
  }
  if (draft.items?.[0]?.product_id && supabase) {
    const { data } = await supabase.from("products").select("*").eq("id", draft.items[0].product_id).maybeSingle();
    if (data) return data;
  }
  if (catalog?.primary && (catalog.matchScore || 0) >= 12) return catalog.primary;
  return null;
}

async function mergeDraft(existing, fields = {}, catalog, zones = []) {
  const f = normalizeOrderFields(fields);
  const draft = { ...(existing || emptyOrderDraft()), ...f, items: [...(existing?.items || [])] };
  const product = await pickProduct(catalog, f, draft);

  if (f.items?.length) {
    draft.items = await Promise.all(f.items.map(async (it) => {
      const item = { quantity: 1, ...it };
      let p = product;
      if (!p && item.product_id) {
        const supabase = getSupabase();
        if (supabase) {
          const { data } = await supabase.from("products").select("*").eq("id", item.product_id).maybeSingle();
          p = data;
        }
      }
      if (!item.unit_price && p) {
        item.unit_price = Number(p.price) || 0;
        item.product_id = p.id;
        if (!item.product_name) item.product_name = p.name;
      }
      return item;
    }));
  } else if (f.product_name || f.size || f.color) {
    const base = draft.items[0] || { quantity: 1 };
    const p = product || catalog?.primary;
    draft.items = [{
      ...base,
      product_name: f.product_name || base.product_name || p?.name,
      size: f.size || base.size,
      color: f.color || base.color,
      product_id: f.product_id || base.product_id || p?.id || null,
      unit_price: f.unit_price || base.unit_price || Number(p?.price) || 0,
      quantity: f.quantity || base.quantity || 1,
    }];
  }

  const zoneText = f.delivery_zone_name || f.commune || draft.delivery_address;
  const zone = matchDeliveryZone(zoneText, zones) || matchDeliveryZone(draft.delivery_address, zones);
  if (zone) {
    draft.delivery_zone_id = zone.id;
    draft.delivery_zone_name = zone.name;
    draft.delivery_fee = Number(zone.price) || 0;
  }

  draft.updated_at = new Date().toISOString();
  draft.status = missingFields(draft).length === 0 ? "confirming" : "collecting";
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
  const safeReply = cleanReply || stripOrderBotMarkers(reply);

  if (!payload?.action) {
    return { reply: safeReply, profilePatch: null, orderCreated: null };
  }

  const zones = await getDeliveryZones();
  let draft = profile?.order_draft?.status && profile.order_draft.status !== "done"
    ? { ...profile.order_draft }
    : emptyOrderDraft(phone, await getCustomerCheckoutContext(phone));

  if (payload.action === "cancel_order") {
    return {
      reply: safeReply,
      profilePatch: { order_draft: { status: "done", cancelled_at: new Date().toISOString() } },
      orderCreated: null,
    };
  }

  if (payload.action === "update_draft" && payload.fields) {
    draft = await mergeDraft(draft, payload.fields, catalog, zones);
    return { reply: safeReply, profilePatch: { order_draft: draft }, orderCreated: null };
  }

  if (payload.action === "create_order") {
    draft = await mergeDraft(draft, payload.fields || {}, catalog, zones);
    draft = await resolveUnitPrices(draft);
    const missing = missingFields(draft);
    if (missing.length) {
      await log("warn", `Commande incomplète (${phone}): ${missing.join(", ")}`);
      return {
        reply: safeReply,
        profilePatch: { order_draft: { ...draft, status: "collecting" } },
        orderCreated: null,
      };
    }

    try {
      const notes = [
        draft.delivery_zone_name ? `Commune: ${draft.delivery_zone_name}` : null,
        draft.delivery_fee ? `Frais livraison: ${draft.delivery_fee} FC` : null,
      ].filter(Boolean).join(" · ");

      const { order, items } = await createOrderRecord({
        customer_name: draft.customer_name.trim(),
        customer_phone: draft.customer_phone.trim(),
        delivery_address: draft.delivery_address.trim(),
        delivery_date: draft.delivery_date.trim(),
        delivery_fee: Number(draft.delivery_fee) || 0,
        urgent: !!draft.urgent,
        notes,
        items: draft.items,
        order_source: "whatsapp_bot",
        status: "pending",
      }, cfg);

      await log("success", `Commande #${order.id} créée via WA (${phone})`);

      return {
        reply: safeReply,
        profilePatch: { order_draft: { status: "done", order_id: order.id, completed_at: new Date().toISOString() } },
        orderCreated: { order, items },
      };
    } catch (e) {
      await log("error", `Création commande bot: ${e.message}`);
      return {
        reply: `${safeReply}\n\n(Désolé, problème technique pour enregistrer la commande. L'équipe te recontacte.)`,
        profilePatch: { order_draft: draft },
        orderCreated: null,
      };
    }
  }

  return { reply: safeReply, profilePatch: null, orderCreated: null };
}
