import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const anon = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anon, {
  realtime: { params: { eventsPerSecond: 5 } },
});

export const TABLES = {
  config: "bot_config",
  conversations: "conversations",
  messages: "messages",
  logs: "logs",
  session: "whatsapp_sessions",
};
