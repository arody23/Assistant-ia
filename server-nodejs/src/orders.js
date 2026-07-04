/**
 * Commandes — lecture + création depuis le bot WhatsApp
 */

import { getEnvStatus } from "./env.js";
import { getSupabase } from "./supabase.js";
import { log } from "./logger.js";
import { getClient, isClientReady } from "./whatsapp-client.js";

function db() {
  const c = getSupabase();
  if (!c) throw new Error("Supabase non configuré");
  return c;
}

function adminPhone() {
  return (process.env.ADMIN_WHATSAPP_PHONE || "+242067458011").replace(/\s/g, "");
}

async function notifyAdmin(text) {
  const wa = getClient();
  if (!isClientReady() || !wa) {
    await log("warn", `Alerte admin (WA indisponible): ${text}`);
    return;
  }
  const digits = adminPhone().replace(/\D/g, "");
  const jid = `${digits}@c.us`;
  try {
    await wa.sendMessage(jid, text);
  } catch (e) {
    await log("warn", `Alerte admin échouée: ${e.message}`);
  }
}

export function registerOrderRoutes(app) {
  app.get("/api/admin/orders", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
      const { data: orders, error } = await db()
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      const ids = (orders || []).map((o) => o.id);
      let items = [];
      if (ids.length) {
        const { data: rows } = await db().from("order_items").select("*").in("order_id", ids);
        items = rows || [];
      }

      const byOrder = {};
      for (const it of items) {
        (byOrder[it.order_id] ||= []).push(it);
      }

      res.json((orders || []).map((o) => ({ ...o, items: byOrder[o.id] || [] })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/orders", async (req, res) => {
    const env = getEnvStatus();
    if (!env.ok) return res.status(503).json({ error: "Bot non configuré", missing: env.missing });

    try {
      const {
        customer_name,
        customer_phone,
        delivery_address,
        delivery_date,
        notes,
        urgent,
        items = [],
        status = "pending",
      } = req.body || {};

      if (!customer_name?.trim() || !customer_phone?.trim()) {
        return res.status(400).json({ error: "customer_name et customer_phone requis" });
      }
      if (!items.length) {
        return res.status(400).json({ error: "Au moins un article requis" });
      }

      const total = items.reduce(
        (s, it) => s + Number(it.unit_price || 0) * Number(it.quantity || 1),
        0
      );

      const orderNotes = [notes, urgent ? "⚡ LIVRAISON URGENTE" : null].filter(Boolean).join("\n");

      const { data: order, error: orderErr } = await db()
        .from("orders")
        .insert({
          customer_name: customer_name.trim(),
          customer_phone: customer_phone.trim(),
          delivery_address: delivery_address?.trim() || "",
          delivery_date: delivery_date?.trim() || "",
          notes: orderNotes || null,
          status,
          order_source: "whatsapp_bot",
          total_amount: total,
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      const rows = items.map((it) => ({
        order_id: order.id,
        product_id: it.product_id || null,
        product_name: it.product_name || "Article",
        size: it.size || "",
        color: it.color || "",
        quantity: it.quantity || 1,
        unit_price: it.unit_price || 0,
      }));
      const { error: itemsErr } = await db().from("order_items").insert(rows);
      if (itemsErr) throw itemsErr;

      const summary = [
        "🛒 Nouvelle commande WhatsApp",
        `Client: ${order.customer_name} (${order.customer_phone})`,
        `Adresse: ${order.delivery_address || "—"}`,
        `Livraison: ${order.delivery_date || "—"}`,
        ...rows.map((r) => `• ${r.product_name} ${r.color} ${r.size} x${r.quantity}`),
        urgent ? "⚡ URGENT" : null,
        `Total: ${total} FC`,
        `ID commande: #${order.id}`,
      ].filter(Boolean).join("\n");

      await notifyAdmin(summary);
      await log("success", `Commande #${order.id} créée via bot`);

      res.json({ order, items: rows });
    } catch (e) {
      await log("error", `Création commande: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/orders/:id", async (req, res) => {
    try {
      const { status, notes, courier_id } = req.body || {};
      const patch = {};
      if (status) patch.status = status;
      if (notes !== undefined) patch.notes = notes;
      if (courier_id !== undefined) patch.courier_id = courier_id;

      const { data, error } = await db()
        .from("orders")
        .update(patch)
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) throw error;

      if (status === "delivered" || status === "livree" || status === "livré") {
        await log("info", `Commande #${data.id} marquée livrée`);
      }

      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
