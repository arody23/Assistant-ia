/**
 * Données checkout e-commerce (Supabase partagé avec le site)
 */

import { getSupabase } from "./supabase.js";
import { log } from "./logger.js";
import { phoneTail, toE164 } from "./phone-utils.js";

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

export async function getDeliveryZones() {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("delivery_zones")
    .select("id, name, city, price, zone_type")
    .eq("is_active", true)
    .order("name");
  if (error) {
    await log("error", `delivery_zones: ${error.message}`);
    return [];
  }
  return data || [];
}

export function matchDeliveryZone(text, zones = []) {
  const q = norm(text);
  if (!q) return null;
  let best = null;
  let bestLen = 0;
  for (const z of zones) {
    const n = norm(z.name);
    if (n && q.includes(n) && n.length > bestLen) {
      best = z;
      bestLen = n.length;
    }
  }
  return best;
}

const DELIVERY_QUERY =
  /\b(livraison|frais de livraison|co[uû]t.*livraison|prix.*livraison|commune|zone de livraison|livrer|d[eé]lai.*livraison|combien.*livraison)\b/i;

export function detectDeliveryQuery(text) {
  return DELIVERY_QUERY.test(text || "");
}

export async function buildDeliveryContextBlock(userText = "") {
  const zones = await getDeliveryZones();
  if (!zones.length) {
    await log("warn", "delivery zones: aucune zone active (DB vide ou erreur)");
    return [
      "--- FRAIS LIVRAISON",
      "Données communes indisponibles. Ne pas inventer de tarif — indique que tu n'as pas l'info et propose le transfert humain.",
    ].join("\n");
  }
  return formatDeliveryZonesCompact(zones, userText);
}

export function formatDeliveryZonesBlock(zones = []) {
  if (!zones.length) return "";
  const lines = zones.map((z) => {
    const price = Number(z.price || 0).toLocaleString("fr-FR");
    return `• ${z.name} (${z.city || "Kinshasa"}): ${price} FC livraison`;
  });
  return [
    "--- FRAIS LIVRAISON PAR COMMUNE (source checkout site)",
    "Utilise UNIQUEMENT ces tarifs selon la commune indiquée par le client.",
    ...lines,
  ].join("\n");
}

export function formatDeliveryZonesCompact(zones = [], addressHint = "") {
  if (!zones.length) return "";
  const matched = matchDeliveryZone(addressHint, zones);
  const subset = matched ? [matched] : zones.slice(0, 10);
  const lines = subset.map((z) => `• ${z.name}: ${Number(z.price || 0).toLocaleString("fr-FR")} FC`);
  const extra = !matched && zones.length > 10
    ? [`… +${zones.length - 10} autres communes — demande la commune au client`]
    : [];
  return [
    "--- FRAIS LIVRAISON (communes)",
    "Utilise UNIQUEMENT ces tarifs.",
    ...lines,
    ...extra,
  ].join("\n");
}

export async function getCustomerCheckoutContext(phone) {
  const db = getSupabase();
  if (!db) return { name: "", phone: "", address: "", lastDeliveryDate: "" };

  const e164 = toE164(phone);
  const tail = phoneTail(e164 || phone);
  const customerPhone = e164 || (tail ? `+242${tail}` : "");

  let name = "";
  let outPhone = customerPhone;
  let address = "";
  let lastDeliveryDate = "";

  if (tail) {
    const { data: orders, error: orderErr } = await db
      .from("orders")
      .select("customer_name, customer_phone, delivery_address, delivery_date")
      .ilike("customer_phone", `%${tail}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (orderErr) await log("error", `checkout orders: ${orderErr.message}`);
    else if (orders?.[0]) {
      name = orders[0].customer_name || "";
      outPhone = orders[0].customer_phone || outPhone;
      address = orders[0].delivery_address || "";
      lastDeliveryDate = orders[0].delivery_date || "";
    }

    const { data: profiles, error: profErr } = await db
      .from("profiles")
      .select("full_name, name, phone")
      .ilike("phone", `%${tail}%`)
      .limit(1);

    if (profErr) await log("error", `checkout profiles: ${profErr.message}`);
    else if (profiles?.[0]) {
      const prof = profiles[0];
      if (!name) name = prof.full_name || prof.name || "";
      if (!outPhone) outPhone = prof.phone || outPhone;
    }
  }

  return { name, phone: outPhone, address, lastDeliveryDate };
}

export function formatCheckoutCustomerBlock(ctx = {}) {
  if (!ctx.name && !ctx.address && !ctx.phone) return "";
  return [
    "--- DONNÉES CLIENT (checkout / commandes précédentes — à proposer pour confirmation)",
    ctx.name ? `Nom connu: ${ctx.name}` : null,
    ctx.phone ? `Téléphone connu: ${ctx.phone}` : null,
    ctx.address ? `Adresse connue: ${ctx.address}` : null,
    ctx.lastDeliveryDate ? `Dernière livraison: ${ctx.lastDeliveryDate}` : null,
    "Demande confirmation avant d'utiliser ces données.",
  ].filter(Boolean).join("\n");
}
