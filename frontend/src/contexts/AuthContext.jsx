import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

async function fetchAdminProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, email, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.role !== "admin") {
    throw new Error("Accès réservé aux administrateurs");
  }
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    setProfile(null);
  }, []);

  const loadProfile = useCallback(async (authUser) => {
    const prof = await fetchAdminProfile(authUser.id);
    setUser(authUser);
    setProfile(prof);
    return prof;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadProfile(session.user);
        } else {
          clearSession();
        }
      } catch {
        await supabase.auth.signOut();
        clearSession();
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT" || !session?.user) {
        clearSession();
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        try {
          await loadProfile(session.user);
        } catch {
          await supabase.auth.signOut();
          clearSession();
        }
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearSession, loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await loadProfile(data.user);
    return data.user;
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearSession();
  }, [clearSession]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    isAdmin: !!profile,
    signIn,
    signOut,
  }), [user, profile, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
