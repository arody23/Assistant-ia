/**
 * Données checkout e-commerce (Supabase partagé avec le site)
 * — historique client, communes / frais de livraison
 */

import { getSupabase } from "./supabase.js";

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

function phoneTail(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : d;
}

export async function getDeliveryZones() {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("delivery_zones")
    .select("id, name, city, price, zone_type")
    .eq("is_active", true)
    .order("name");
  if (error) return [];
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

export function formatDeliveryZonesBlock(zones = []) {
  if (!zones.length) return "";
  const lines = zones.map((z) => {
    const price = Number(z.price || 0).toLocaleString("fr-FR");
    return `• ${z.name} (${z.city || "Kinshasa"}): ${price} FC livraison [${z.zone_type || "—"}]`;
  });
  return [
    "--- FRAIS LIVRAISON PAR COMMUNE (source checkout site)",
    "Utilise UNIQUEMENT ces tarifs. Identifie la commune dans l'adresse du client.",
    ...lines,
  ].join("\n");
}

/**
 * Récupère nom / téléphone / adresse depuis commandes passées ou profil site.
 */
export async function getCustomerCheckoutContext(phone) {
  const db = getSupabase();
  if (!db) return { name: "", phone: "", address: "", lastDeliveryDate: "" };

  const tail = phoneTail(phone);
  const waPhone = tail ? `+${String(phone).replace(/\D/g, "")}` : "";

  let name = "";
  let customerPhone = waPhone;
  let address = "";
  let lastDeliveryDate = "";

  if (tail) {
    const { data: orders } = await db
      .from("orders")
      .select("customer_name, customer_phone, delivery_address, delivery_date")
      .ilike("customer_phone", `%${tail}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (orders?.[0]) {
      name = orders[0].customer_name || "";
      customerPhone = orders[0].customer_phone || customerPhone;
      address = orders[0].delivery_address || "";
      lastDeliveryDate = orders[0].delivery_date || "";
    }

    const { data: profiles } = await db
      .from("profiles")
      .select("full_name, name, phone")
      .ilike("phone", `%${tail}%`)
      .limit(1);

    const prof = profiles?.[0];
    if (prof) {
      if (!name) name = prof.full_name || prof.name || "";
      if (!customerPhone) customerPhone = prof.phone || customerPhone;
    }
  }

  return { name, phone: customerPhone, address, lastDeliveryDate };
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
