import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

let _client = null;

export function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) return null;
  if (!_client) {
    _client = createClient(url, key, {
      auth: { persistSession: false },
      realtime: { transport: WebSocket },
    });
  }
  return _client;
}

/** @deprecated Préférer getSupabase() — conservé pour compatibilité */
export const supabase = new Proxy({}, {
  get(_t, prop) {
    const c = getSupabase();
    if (!c) throw new Error("Supabase non configuré (SUPABASE_URL, SUPABASE_SERVICE_KEY)");
    const v = c[prop];
    return typeof v === "function" ? v.bind(c) : v;
  },
});

function db() {
  const c = getSupabase();
  if (!c) throw new Error("Supabase non configuré");
  return c;
}

export async function getConfig() {
  const { data } = await db().from("bot_config").select("*").eq("id", "main").maybeSingle();
  return data || {};
}

export async function upsertSession(patch) {
  return db().from("whatsapp_sessions").upsert(
    { id: "main", ...patch, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
}

export async function upsertConversation({ phone, name, last_message, channel = "whatsapp", interest_delta = 0 }) {
  const { data: existing } = await db()
    .from("conversations").select("id, messages_count, interest_score").eq("phone", phone).maybeSingle();

  if (existing) {
    const patch = {
      name: name || undefined,
      last_message,
      last_ts: new Date().toISOString(),
      messages_count: (existing.messages_count || 0) + 2,
    };
    if (interest_delta) {
      patch.interest_score = (existing.interest_score || 0) + interest_delta;
    }
    await db().from("conversations").update(patch).eq("id", existing.id);
    return existing.id;
  }
  const { data: created } = await db().from("conversations").insert({
    phone,
    name,
    last_message,
    last_ts: new Date().toISOString(),
    messages_count: 2,
    channel,
    interest_score: interest_delta || 0,
  }).select("id").single();
  return created?.id;
}

export async function getConversationByPhone(phone) {
  const { data } = await db()
    .from("conversations").select("*").eq("phone", phone).maybeSingle();
  return data;
}

export async function updateConversationProfile(id, patch) {
  return db().from("conversations").update(patch).eq("id", id);
}

export async function insertMessages(conversationId, msgs) {
  return db().from("messages").insert(msgs.map(m => ({ ...m, conversation_id: conversationId })));
}

export async function insertLog(level, message) {
  return db().from("logs").insert({ level: String(level).toUpperCase(), message });
}

export async function recentHistory(conversationId, limit = 8) {
  const { data } = await db()
    .from("messages").select("role,content").eq("conversation_id", conversationId)
    .order("ts", { ascending: false }).limit(limit);
  return (data || []).reverse();
}

export async function getAmbassadorAssets() {
  const { data } = await db()
    .from("ambassador_assets")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return data || [];
}

export async function getWhatsappMedia() {
  const { data } = await db()
    .from("whatsapp_media")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return data || [];
}
