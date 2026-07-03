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

export async function upsertConversation({ phone, name, last_message, channel = "whatsapp" }) {
  const { data: existing } = await db()
    .from("conversations").select("id, messages_count").eq("phone", phone).maybeSingle();

  if (existing) {
    await db().from("conversations").update({
      name: name || undefined,
      last_message,
      last_ts: new Date().toISOString(),
      messages_count: (existing.messages_count || 0) + 2,
    }).eq("id", existing.id);
    return existing.id;
  }
  const { data: created } = await db().from("conversations").insert({
    phone, name, last_message, last_ts: new Date().toISOString(), messages_count: 2, channel,
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
