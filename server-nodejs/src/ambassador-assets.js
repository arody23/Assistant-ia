/**
 * Admin API — médias programme ambassadeur (service_role, bypass RLS)
 */

import { getEnvStatus } from "./env.js";
import { getSupabase } from "./supabase.js";
import { log } from "./logger.js";

function db() {
  const c = getSupabase();
  if (!c) throw new Error("Supabase non configuré");
  return c;
}

export function registerAmbassadorAssetRoutes(app) {
  app.get("/api/admin/ambassador/assets", async (_req, res) => {
    try {
      const { data, error } = await db()
        .from("ambassador_assets")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      res.json(data || []);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/ambassador/assets", async (req, res) => {
    const env = getEnvStatus();
    if (!env.ok) return res.status(503).json({ error: "Bot non configuré", missing: env.missing });

    try {
      const { fileBase64, fileName, mimeType, title, caption, keywords, description } = req.body || {};
      if (!fileBase64 || !fileName) {
        return res.status(400).json({ error: "fileBase64 et fileName requis" });
      }

      const ext = (fileName.split(".").pop() || "jpg").toLowerCase();
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const buffer = Buffer.from(fileBase64, "base64");

      const { error: upErr } = await db().storage.from("ambassador-media").upload(path, buffer, {
        contentType: mimeType || "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: pub } = db().storage.from("ambassador-media").getPublicUrl(path);

      const { data: rows } = await db()
        .from("ambassador_assets")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (rows?.[0]?.sort_order ?? -1) + 1;

      const kw = Array.isArray(keywords)
        ? keywords.filter(Boolean)
        : String(keywords || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      const { data, error } = await db()
        .from("ambassador_assets")
        .insert({
          title: title || fileName.replace(/\.[^.]+$/, ""),
          caption: caption || "",
          description: description || "",
          keywords: kw,
          image_url: pub.publicUrl,
          sort_order: nextOrder,
          active: true,
        })
        .select()
        .single();
      if (error) throw error;

      await log("info", `Asset ambassadeur ajouté: ${data.title}`);
      res.json(data);
    } catch (e) {
      await log("error", `Upload asset: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/ambassador/assets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const allowed = ["title", "caption", "description", "keywords", "sort_order", "active"];
      const patch = {};
      for (const k of allowed) {
        if (req.body?.[k] !== undefined) patch[k] = req.body[k];
      }
      const { data, error } = await db()
        .from("ambassador_assets")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/ambassador/assets/reorder", async (req, res) => {
    try {
      const { orderedIds } = req.body || {};
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds requis" });
      }
      await Promise.all(
        orderedIds.map((id, idx) =>
          db().from("ambassador_assets").update({ sort_order: idx }).eq("id", id)
        )
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/admin/ambassador/assets/:id", async (req, res) => {
    try {
      const { error } = await db().from("ambassador_assets").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
