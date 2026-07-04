/**
 * Phase A — purge brouillons commande et état produit en cache (conversations.profile).
 * Usage: cd server-nodejs && node scripts/purge-bot-state.mjs
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_KEY?.trim();
if (!url || !key) {
  console.error("SUPABASE_URL et SUPABASE_SERVICE_KEY requis");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const { data: convos, error } = await db.from("conversations").select("id, phone, profile");
if (error) {
  console.error("Erreur lectures conversations:", error.message);
  process.exit(1);
}

let purged = 0;
for (const c of convos || []) {
  const p = c.profile || {};
  const draft = p.order_draft;
  const hasDraft = draft?.status && draft.status !== "done";
  const hasProductCache = p.pinned_product_key || p.sent_product_images?.length;
  if (!hasDraft && !hasProductCache) continue;

  const next = { ...p };
  if (hasDraft) {
    next.order_draft = { status: "done", cancelled_at: new Date().toISOString(), reason: "admin_purge" };
  }
  delete next.pinned_product_key;
  next.sent_product_images = [];

  const { error: upErr } = await db.from("conversations").update({ profile: next }).eq("id", c.id);
  if (upErr) {
    console.error(`Échec ${c.phone}:`, upErr.message);
  } else {
    purged++;
    console.log(`Purgé: ${c.phone} (draft=${hasDraft}, cache=${!!hasProductCache})`);
  }
}

console.log(`\nTerminé — ${purged} conversation(s) nettoyée(s) sur ${convos?.length || 0}.`);
