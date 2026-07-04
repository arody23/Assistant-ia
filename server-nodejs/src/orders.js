/**
 * Commandes — lecture + création depuis le bot WhatsApp + automatisations
 */

import { getEnvStatus } from "./env.js";
import { getSupabase, getConfig } from "./supabase.js";
import { log } from "./logger.js";
import { runOrderAutomations } from "./automations.js";

function db() {
  const c = getSupabase();
  if (!c) throw new Error("Supabase non configuré");
  return c;
}

/**
 * Crée une commande en base (utilisé par API admin et bot WhatsApp).
 */
export async function createOrderRecord(body, cfg = null) {
  const {
    customer_name,
    customer_phone,
    delivery_address,
    delivery_date,
    notes,
    urgent,
    delivery_fee = 0,
    items = [],
    status = "pending",
    order_source = "whatsapp_bot",
    courier_id,
  } = body || {};

  if (!customer_name?.trim() || !customer_phone?.trim()) {
    throw new Error("customer_name et customer_phone requis");
  }
  if (!items.length) throw new Error("Au moins un article requis");

  const itemsTotal = items.reduce(
    (s, it) => s + Number(it.unit_price || 0) * Number(it.quantity || 1),
    0
  );
  const fee = Number(delivery_fee) || 0;
  const total = itemsTotal + fee;

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
      order_source,
      total_amount: total,
      delivery_fee: fee,
      courier_id: courier_id || null,
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

  const config = cfg || await getConfig();
  await runOrderAutomations("order_created", {
    order,
    items: rows,
    urgent: !!urgent,
    cfg: config,
  });

  return { order, items: rows };
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

  app.get("/api/admin/couriers", async (_req, res) => {
    try {
      const { data, error } = await db().from("couriers").select("*").order("name");
      if (error) throw error;
      res.json(data || []);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/orders", async (req, res) => {
    const env = getEnvStatus();
    if (!env.ok) return res.status(503).json({ error: "Bot non configuré", missing: env.missing });

    try {
      const { order, items } = await createOrderRecord(req.body);
      await log("success", `Commande #${order.id} créée`);
      res.json({ order, items });
    } catch (e) {
      await log("error", `Création commande: ${e.message}`);
      res.status(e.message.includes("requis") ? 400 : 500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/orders/:id", async (req, res) => {
    try {
      const { status, notes, courier_id, urgent } = req.body || {};

      const { data: prev } = await db().from("orders").select("*").eq("id", req.params.id).maybeSingle();

      const patch = {};
      if (status) patch.status = status;
      if (notes !== undefined) patch.notes = notes;
      if (courier_id !== undefined) patch.courier_id = courier_id;
      if (urgent === true && prev) {
        const base = prev.notes || "";
        patch.notes = base.includes("URGENT") ? base : [base, "⚡ LIVRAISON URGENTE"].filter(Boolean).join("\n");
      }

      const { data, error } = await db()
        .from("orders")
        .update(patch)
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) throw error;

      let items = [];
      const { data: rows } = await db().from("order_items").select("*").eq("order_id", data.id);
      items = rows || [];

      const cfg = await getConfig();
      const isUrgent = !!(urgent || (data.notes || "").includes("URGENT"));
      await runOrderAutomations("order_updated", {
        order: data,
        items,
        prev,
        urgent: isUrgent,
        cfg,
      });

      if (status === "delivered" || status === "livree" || status === "livré") {
        await log("info", `Commande #${data.id} marquée livrée (sync table partagée)`);
      }

      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
