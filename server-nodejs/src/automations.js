/**
 * Phase D — Moteur d'automatisations (SI… ALORS…)
 * Règles stockées dans bot_config.behavior.automations
 */

import { getSupabase } from "./supabase.js";
import { log } from "./logger.js";

export const DEFAULT_AUTOMATIONS = [
  {
    id: "new_order_admin",
    name: "Nouvelle commande → alerte admin WhatsApp",
    trigger: "order_created",
    enabled: true,
    conditions: [],
    actions: [{ type: "whatsapp_notify_admin" }],
  },
  {
    id: "urgent_order_admin",
    name: "Livraison urgente → alerte prioritaire admin",
    trigger: "order_created",
    enabled: true,
    conditions: [{ field: "urgent", op: "eq", value: true }],
    actions: [{ type: "whatsapp_notify_admin", priority: true }],
  },
  {
    id: "delivered_notify",
    name: "Statut livré → notification admin (sync site)",
    trigger: "order_updated",
    enabled: true,
    conditions: [{ field: "status", op: "in", value: ["delivered", "livree", "livré"] }],
    actions: [{ type: "whatsapp_notify_admin", template: "delivered" }],
  },
  {
    id: "courier_assigned",
    name: "Livreur assigné → notification livreur",
    trigger: "order_updated",
    enabled: true,
    conditions: [{ field: "courier_id", op: "changed" }],
    actions: [{ type: "whatsapp_notify_courier" }],
  },
];

const TRIGGER_LABELS = {
  order_created: "Nouvelle commande créée",
  order_updated: "Commande mise à jour",
};

const ACTION_LABELS = {
  whatsapp_notify_admin: "Notifier l'admin WhatsApp",
  whatsapp_notify_courier: "Notifier le livreur assigné",
};

export function getAutomations(cfg = {}) {
  const list = cfg?.behavior?.automations;
  return Array.isArray(list) && list.length ? list : DEFAULT_AUTOMATIONS;
}

function adminPhone() {
  return (process.env.ADMIN_WHATSAPP_PHONE || "+242067458011").replace(/\s/g, "");
}

async function sendWhatsApp(phone, text) {
  const { getClient, isClientReady } = await import("./whatsapp-client.js");
  const wa = getClient();
  if (!isClientReady() || !wa || !phone) {
    await log("warn", `WA indisponible pour ${phone}: ${text.slice(0, 80)}…`);
    return false;
  }
  const digits = phone.replace(/\D/g, "");
  try {
    await wa.sendMessage(`${digits}@c.us`, text);
    return true;
  } catch (e) {
    await log("warn", `Envoi WA ${phone}: ${e.message}`);
    return false;
  }
}

function evalCondition(cond, ctx, prev) {
  const { field, op, value } = cond;
  const cur = ctx[field];
  const old = prev?.[field];

  switch (op) {
    case "eq": return cur === value;
    case "neq": return cur !== value;
    case "in": return Array.isArray(value) && value.includes(cur);
    case "changed": return cur != null && cur !== old;
    case "contains":
      return String(cur || "").toLowerCase().includes(String(value || "").toLowerCase());
    default: return false;
  }
}

function matchRule(rule, trigger, ctx, prev) {
  if (!rule.enabled) return false;
  if (rule.trigger !== trigger) return false;
  const conditions = rule.conditions || [];
  return conditions.every((c) => evalCondition(c, ctx, prev));
}

function formatOrderSummary(order, items = [], opts = {}) {
  const urgent = opts.urgent || (order.notes || "").includes("URGENT");
  const prefix = opts.priority || urgent ? "⚡ URGENT — " : "";
  const lines = [
    `${prefix}🛒 ${opts.template === "delivered" ? "Commande livrée" : "Commande"}`,
    `Client: ${order.customer_name} (${order.customer_phone})`,
    `Adresse: ${order.delivery_address || "—"}`,
    `Livraison: ${order.delivery_date || "—"}`,
    ...items.map((r) => `• ${r.product_name} ${r.color || ""} ${r.size || ""} ×${r.quantity || 1}`),
    urgent ? "⚡ LIVRAISON URGENTE" : null,
    `Total: ${Number(order.total_amount || 0).toLocaleString("fr-FR")} FC`,
    `ID: #${order.id}`,
    opts.template === "delivered" ? "✅ Statut synchronisé (table partagée site + bot)" : null,
  ];
  return lines.filter(Boolean).join("\n");
}

async function getCourier(courierId) {
  if (!courierId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from("couriers").select("*").eq("id", courierId).maybeSingle();
  return data;
}

async function runAction(action, ctx) {
  const { order, items, prev, urgent } = ctx;

  switch (action.type) {
    case "whatsapp_notify_admin": {
      const text = action.message?.trim()
        || formatOrderSummary(order, items, { priority: action.priority, template: action.template, urgent });
      await sendWhatsApp(adminPhone(), text);
      break;
    }
    case "whatsapp_notify_courier": {
      const courier = await getCourier(order.courier_id);
      if (!courier?.phone) {
        await log("warn", `Pas de téléphone livreur pour commande #${order.id}`);
        break;
      }
      const text = action.message?.trim()
        || [
          "📦 Nouvelle livraison assignée",
          `Client: ${order.customer_name} (${order.customer_phone})`,
          `Adresse: ${order.delivery_address || "—"}`,
          `Livraison: ${order.delivery_date || "—"}`,
          urgent ? "⚡ URGENT" : null,
          `Commande #${order.id}`,
        ].filter(Boolean).join("\n");
      await sendWhatsApp(courier.phone, text);
      break;
    }
    default:
      await log("warn", `Action automation inconnue: ${action.type}`);
  }
}

/**
 * @param {'order_created'|'order_updated'} trigger
 */
export async function runOrderAutomations(trigger, { order, items = [], prev = null, urgent = false, cfg }) {
  const rules = getAutomations(cfg);
  const ctx = { ...order, urgent };

  for (const rule of rules) {
    if (!matchRule(rule, trigger, ctx, prev)) continue;
    await log("info", `Automation « ${rule.name} » déclenchée (#${order.id})`);
    for (const action of rule.actions || []) {
      await runAction(action, { order, items, prev, urgent });
    }
  }
}

export { TRIGGER_LABELS, ACTION_LABELS };
