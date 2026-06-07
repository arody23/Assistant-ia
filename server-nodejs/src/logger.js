import { insertLog } from "./supabase.js";

export async function log(level, message) {
  // eslint-disable-next-line no-console
  console.log(`[${level.toUpperCase()}] ${message}`);
  try { await insertLog(level, message); } catch {}
}
