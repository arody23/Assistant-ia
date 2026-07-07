/**
 * Middleware — vérifie JWT Supabase + rôle admin (profiles.role)
 */

import { createClient } from "@supabase/supabase-js";

let _authClient = null;
let _adminDb = null;

function getAuthClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) return null;
  if (!_authClient) {
    _authClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _authClient;
}

function getAdminDb() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) return null;
  if (!_adminDb) {
    _adminDb = createClient(url, key, { auth: { persistSession: false } });
  }
  return _adminDb;
}

export async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentification requise" });
    }

    const token = header.slice(7);
    const authClient = getAuthClient();
    if (!authClient) {
      return res.status(503).json({ error: "Auth non configuré (SUPABASE_URL / SUPABASE_SERVICE_KEY)" });
    }

    const { data: { user }, error } = await authClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Session invalide ou expirée" });
    }

    const adminDb = getAdminDb();
    const { data: profile } = await adminDb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });
    }

    req.user = user;
    next();
  } catch (e) {
    res.status(500).json({ error: e.message || "Erreur auth" });
  }
}

export function adminGate(req, res, next) {
  const path = req.path;
  const protectedPath =
    path.startsWith("/api/admin") ||
    path.startsWith("/api/playground") ||
    path === "/api/reconnect" ||
    path === "/api/restart" ||
    path === "/api/logout";

  if (!protectedPath) return next();
  return requireAdmin(req, res, next);
}
