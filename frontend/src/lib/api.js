import axios from "axios";
import { supabase, TABLES } from "@/lib/supabase";
import { getNodeUrl } from "@/lib/utils";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const NODE_URL = getNodeUrl();
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : null;

/**
 * Hybrid API client:
 *  - All persistent data (config, conversations, messages, logs, whatsapp session)
 *    → Supabase directly (live, no demo).
 *  - Stateless Groq playground (test prompt before deployment)
 *    → Python FastAPI backend here.
 *
 * Production WhatsApp bot runs on the user's Node.js server (whatsapp-web.js)
 * — see /app/server-nodejs/. That Node.js process writes events into the same
 * Supabase tables, so this dashboard reflects real activity in real time.
 */

const dataApi = {
  // ---- config ----
  async getConfig() {
    const { data, error } = await supabase
      .from(TABLES.config).select("*").eq("id", "main").maybeSingle();
    if (error) throw error;
    return data || null;
  },
  async updateConfig(patch) {
    const payload = { ...patch, id: "main", updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from(TABLES.config).upsert(payload, { onConflict: "id" }).select().single();
    if (error) throw error;
    return data;
  },

  // ---- conversations ----
  async listConversations() {
    const { data, error } = await supabase
      .from(TABLES.conversations).select("*").order("last_ts", { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  },
  async listMessages(conversationId) {
    const { data, error } = await supabase
      .from(TABLES.messages).select("*").eq("conversation_id", conversationId).order("ts", { ascending: true });
    if (error) throw error;
    return data || [];
  },
  async deleteConversation(id) {
    await supabase.from(TABLES.messages).delete().eq("conversation_id", id);
    await supabase.from(TABLES.conversations).delete().eq("id", id);
  },
  async updateConversation(id, patch) {
    const { data, error } = await supabase
      .from(TABLES.conversations)
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ---- stats (computed live) ----
  async stats() {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); sevenDaysAgo.setHours(0,0,0,0);

    const [msgsTodayQ, convsQ, totalMsgsQ, msgsWeekQ] = await Promise.all([
      supabase.from(TABLES.messages).select("id", { count: "exact", head: true }).gte("ts", todayStart.toISOString()),
      supabase.from(TABLES.conversations).select("id", { count: "exact", head: true }),
      supabase.from(TABLES.messages).select("id", { count: "exact", head: true }),
      supabase.from(TABLES.messages).select("ts").gte("ts", sevenDaysAgo.toISOString()),
    ]);

    const labels = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
    const buckets = Array(7).fill(0);
    (msgsWeekQ.data || []).forEach(r => {
      const d = new Date(r.ts);
      const offset = Math.floor((Date.now() - d.getTime()) / 86400000);
      if (offset >= 0 && offset <= 6) buckets[6 - offset] += 1;
    });
    const today = new Date();
    const series = buckets.map((v, idx) => {
      const dayDate = new Date(); dayDate.setDate(today.getDate() - (6 - idx));
      return { label: labels[dayDate.getDay()], value: v };
    });

    return {
      messages_today: msgsTodayQ.count || 0,
      unique_clients: convsQ.count || 0,
      products_viewed: 0, // sera incrémenté par le backend Node.js quand un lien produit est envoyé
      resolution_rate: 0,
      weekly_series: series,
    };
  },

  // ---- logs ----
  async logs() {
    const { data, error } = await supabase
      .from(TABLES.logs).select("*").order("ts", { ascending: false }).limit(150);
    if (error) throw error;
    return data || [];
  },
  async clearLogs() {
    await supabase.from(TABLES.logs).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  },

  // ---- whatsapp session ----
  async getSession() {
    const { data, error } = await supabase
      .from(TABLES.session).select("*").eq("id", "main").maybeSingle();
    if (error) throw error;
    return data || null;
  },
  async resetSession() {
    await supabase.from(TABLES.session).upsert({
      id: "main", connected: false, qr_code: null, status: "disconnected",
      phone_number: null, connected_at: null, updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
  },

  // ---- realtime subscriptions ----
  onConfig(callback) {
    return supabase.channel("rt_config")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.config }, callback).subscribe();
  },
  onSession(callback) {
    return supabase.channel("rt_session")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.session }, callback).subscribe();
  },
  onMessages(callback) {
    return supabase.channel("rt_messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: TABLES.messages }, callback).subscribe();
  },
  onLogs(callback) {
    return supabase.channel("rt_logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: TABLES.logs }, callback).subscribe();
  },

  async listAmbassadorAssets() {
    if (NODE_URL) {
      const r = await fetch(`${NODE_URL}/api/admin/ambassador/assets`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Chargement échoué");
      return data;
    }
    const { data, error } = await supabase
      .from(TABLES.ambassador_assets)
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async uploadAmbassadorAsset(file, { title, caption, keywords, description }) {
    const b64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    if (NODE_URL) {
      const r = await fetch(`${NODE_URL}/api/admin/ambassador/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: b64,
          fileName: file.name,
          mimeType: file.type,
          title,
          caption,
          keywords,
          description,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Upload échoué");
      return data;
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("ambassador-media").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("ambassador-media").getPublicUrl(path);
    const { data, error } = await supabase
      .from(TABLES.ambassador_assets)
      .insert({ title: title || file.name, caption: caption || "", image_url: pub.publicUrl, sort_order: 0 })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAmbassadorAsset(id, patch) {
    if (NODE_URL) {
      const r = await fetch(`${NODE_URL}/api/admin/ambassador/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Mise à jour échouée");
      return data;
    }
    const { data, error } = await supabase
      .from(TABLES.ambassador_assets)
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async reorderAmbassadorAssets(orderedIds) {
    if (!NODE_URL) throw new Error("REACT_APP_NODE_URL requis");
    const r = await fetch(`${NODE_URL}/api/admin/ambassador/assets/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Réorganisation échouée");
    return data;
  },

  async deleteAmbassadorAsset(id) {
    if (NODE_URL) {
      const r = await fetch(`${NODE_URL}/api/admin/ambassador/assets/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Suppression échouée");
      }
      return;
    }
    const { error } = await supabase.from(TABLES.ambassador_assets).delete().eq("id", id);
    if (error) throw error;
  },

  async listAmbassadorConversations() {
    const { data, error } = await supabase
      .from(TABLES.conversations)
      .select("*")
      .eq("channel", "ambassador")
      .order("last_ts", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  async ambassadorStats() {
    const { data, error } = await supabase
      .from(TABLES.conversations)
      .select("id, messages_count, interest_score")
      .eq("channel", "ambassador");
    if (error) throw error;
    const rows = data || [];
    const total = rows.length;
    const engaged = rows.filter((r) => (r.messages_count || 0) >= 3).length;
    const interested = rows.filter((r) => (r.interest_score || 0) > 0).length;
    return {
      total,
      engaged,
      engagement_rate: total ? Math.round((engaged / total) * 100) : 0,
      interest_rate: total ? Math.round((interested / total) * 100) : 0,
    };
  },
};

// ---- Playground (Groq via Node Railway, fallback Python local) ----
function playgroundBase() {
  if (NODE_URL) return `${NODE_URL}/api/playground`;
  if (API) return `${API}/playground`;
  return null;
}

const playApi = {
  async chat(payload) {
    const base = playgroundBase();
    if (!base) throw new Error("Configure REACT_APP_NODE_URL ou REACT_APP_BACKEND_URL");
    const { data } = await axios.post(`${base}/chat`, payload);
    return data;
  },
  async transcribe(file, whisperModel) {
    const base = playgroundBase();
    if (!base) throw new Error("Configure REACT_APP_NODE_URL ou REACT_APP_BACKEND_URL");

    if (NODE_URL) {
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await axios.post(`${base}/transcribe`, {
        audioBase64: b64,
        fileName: file.name,
        whisper_model: whisperModel,
      });
      return data;
    }

    const fd = new FormData();
    fd.append("audio", file);
    if (whisperModel) fd.append("whisper_model", whisperModel);
    const { data } = await axios.post(`${base}/transcribe`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};

export const api = { ...dataApi, playground: playApi };
