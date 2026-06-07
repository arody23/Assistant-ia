import axios from "axios";
import { supabase, TABLES } from "@/lib/supabase";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

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
};

// ---- Playground (Groq direct, stateless, no DB) ----
const playApi = {
  chat: (payload) => axios.post(`${API}/playground/chat`, payload).then(r => r.data),
  transcribe: (file) => {
    const fd = new FormData();
    fd.append("audio", file);
    return axios.post(`${API}/playground/transcribe`, fd, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);
  },
};

export const api = { ...dataApi, playground: playApi };
