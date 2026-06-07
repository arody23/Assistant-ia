import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("[FATAL] SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis dans .env");
  process.exit(1);
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { persistSession: false },
    realtime: { transport: WebSocket },
  }
);

export async function getConfig() {
  const { data } = await supabase.from("bot_config").select("*").eq("id", "main").maybeSingle();
  return data || {};
}

export async function upsertSession(patch) {
  return supabase.from("whatsapp_sessions").upsert(
    { id: "main", ...patch, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
}

export async function upsertConversation({ phone, name, last_message }) {
  // Try fetch, then insert/update
  const { data: existing } = await supabase
    .from("conversations").select("id, messages_count").eq("phone", phone).maybeSingle();

  if (existing) {
    await supabase.from("conversations").update({
      name: name || undefined,
      last_message,
      last_ts: new Date().toISOString(),
      messages_count: (existing.messages_count || 0) + 2,
    }).eq("id", existing.id);
    return existing.id;
  }
  const { data: created } = await supabase.from("conversations").insert({
    phone, name, last_message, last_ts: new Date().toISOString(), messages_count: 2,
  }).select("id").single();
  return created?.id;
}

export async function insertMessages(conversationId, msgs) {
  return supabase.from("messages").insert(msgs.map(m => ({ ...m, conversation_id: conversationId })));
}

export async function insertLog(level, message) {
  return supabase.from("logs").insert({ level: String(level).toUpperCase(), message });
}

export async function recentHistory(conversationId, limit = 8) {
  const { data } = await supabase
    .from("messages").select("role,content").eq("conversation_id", conversationId)
    .order("ts", { ascending: false }).limit(limit);
  return (data || []).reverse();
}
