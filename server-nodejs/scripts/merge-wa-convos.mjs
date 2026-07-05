/**
 * Fusionne conversations dupliquées (@lid vs faux E.164) et purge brouillons.
 * Usage: cd server-nodejs && node scripts/merge-wa-convos.mjs
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { data: convos } = await db.from("conversations").select("*").order("last_ts", { ascending: false });
const byLid = new Map();

for (const c of convos || []) {
  const m = (c.phone || "").match(/^(\d{14,})@lid$/);
  if (m) byLid.set(m[1], c);
}

for (const c of convos || []) {
  const digits = (c.phone || "").replace(/\D/g, "");
  const lidConv = byLid.get(digits);
  if (!lidConv || c.id === lidConv.id) continue;
  if (!c.phone?.startsWith("+") || c.phone.length < 14) continue;

  console.log(`Fusion: ${c.phone} → ${lidConv.phone}`);
  const mergedProfile = {
    ...(lidConv.profile || {}),
    ...(c.profile || {}),
    wa_e164: c.profile?.wa_e164 || lidConv.profile?.wa_e164 || null,
    order_draft: { status: "done", cancelled_at: new Date().toISOString(), reason: "merge_purge" },
    sent_product_images: [],
  };
  await db.from("conversations").update({ profile: mergedProfile }).eq("id", lidConv.id);
  await db.from("messages").update({ conversation_id: lidConv.id }).eq("conversation_id", c.id);
  await db.from("conversations").delete().eq("id", c.id);
}

console.log("Terminé.");
