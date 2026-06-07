import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Overview from "@/components/sections/Overview";
import Conversations from "@/components/sections/Conversations";
import Instructions from "@/components/sections/Instructions";
import Connexion from "@/components/sections/Connexion";
import ConfigApi from "@/components/sections/ConfigApi";
import Comportement from "@/components/sections/Comportement";
import LogsView from "@/components/sections/Logs";
import Playground from "@/components/sections/Playground";
import { api } from "@/lib/api";
import { supabase, TABLES } from "@/lib/supabase";
import { toast } from "sonner";

const SECTIONS = {
  overview: { label: "Overview", crumb: "Tableau de bord", Comp: Overview },
  conversations: { label: "Conversations", crumb: "Messages clients", Comp: Conversations },
  playground: { label: "Playground", crumb: "Test du bot", Comp: Playground },
  instructions: { label: "Instructions IA", crumb: "Prompt & réponses", Comp: Instructions },
  connexion: { label: "WhatsApp", crumb: "QR & session", Comp: Connexion },
  api: { label: "Config API", crumb: "Groq · Whisper", Comp: ConfigApi },
  comportement: { label: "Comportement", crumb: "Préférences", Comp: Comportement },
  logs: { label: "Logs", crumb: "Activité système", Comp: LogsView },
};

export default function Dashboard() {
  const [active, setActive] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schemaError, setSchemaError] = useState(null);

  const loadAll = async () => {
    try {
      const [c, s] = await Promise.all([api.getConfig(), api.getSession()]);
      setConfig(c);
      setSession(s);
      setSchemaError(null);
    } catch (e) {
      setSchemaError(e?.message || "Erreur Supabase");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const cfgSub = api.onConfig(() => api.getConfig().then(setConfig).catch(() => {}));
    const sesSub = api.onSession(() => api.getSession().then(setSession).catch(() => {}));
    return () => {
      supabase.removeChannel(cfgSub);
      supabase.removeChannel(sesSub);
    };
  }, []);

  const updateConfig = async (patch) => {
    try {
      const c = await api.updateConfig(patch);
      setConfig(c);
      toast.success("Configuration sauvegardée");
    } catch (e) {
      toast.error("Sauvegarde échouée : " + (e.message || e));
    }
  };

  const toggleBot = async () => {
    if (!config) return;
    await updateConfig({ bot_active: !config.bot_active });
  };

  const ActiveComp = SECTIONS[active]?.Comp || Overview;

  return (
    <div className="flex min-h-screen relative z-10">
      <Sidebar
        active={active}
        onSelect={(k) => { setActive(k); setSidebarOpen(false); }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        config={config}
        session={session}
      />
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}
      <main className="flex-1 min-w-0 md:ml-[260px]">
        <Topbar
          title={SECTIONS[active]?.label}
          crumb={SECTIONS[active]?.crumb}
          botActive={!!config?.bot_active}
          onToggleBot={toggleBot}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <div className="p-3 sm:p-6 lg:p-8 animate-fade-up" key={active}>
          {loading ? (
            <div className="text-[var(--vsm-grey)] text-sm">Chargement…</div>
          ) : schemaError || !config ? (
            <SchemaSetup error={schemaError} onRetry={loadAll} />
          ) : (
            <ActiveComp config={config} session={session} updateConfig={updateConfig} reloadAll={loadAll} />
          )}
        </div>
      </main>
    </div>
  );
}

function SchemaSetup({ error, onRetry }) {
  const [copied, setCopied] = useState(false);
  const isTablesMissing = (error || "").includes("body stream") || (error || "").includes("PGRST205") || (error || "").includes("Could not find");

  const copySql = async () => {
    try {
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/supabase-schema.sql`);
      const sql = await r.text();
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      toast.success("SQL copié — colle-le dans Supabase SQL Editor");
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      toast.error("Copie impossible · ouvre /app/server-nodejs/supabase-schema.sql");
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-[var(--vsm-surface)] border border-[var(--vsm-red)] p-6 sm:p-8">
      <div className="font-display text-2xl tracking-wider uppercase text-[var(--vsm-red)]">
        {isTablesMissing ? "Tables Supabase manquantes" : "Connexion Supabase impossible"}
      </div>
      <p className="text-sm text-[var(--vsm-cream)] mt-3 leading-relaxed">
        {isTablesMissing
          ? "Les tables ne sont pas encore créées dans ton projet Supabase. Une seule étape pour démarrer :"
          : "Vérifie REACT_APP_SUPABASE_URL et REACT_APP_SUPABASE_ANON_KEY dans frontend/.env."}
      </p>

      {isTablesMissing && (
        <ol className="text-sm text-[var(--vsm-cream)] mt-4 space-y-2 list-decimal list-inside leading-relaxed">
          <li>Copie le script SQL ci-dessous (clic sur le bouton)</li>
          <li>Va sur <span className="text-[var(--vsm-red)]">Supabase Dashboard → SQL Editor → New query</span></li>
          <li>Colle et clique <span className="text-[var(--vsm-red)]">Run</span></li>
          <li>Reviens ici, clique « Réessayer »</li>
        </ol>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={copySql} data-testid="copy-sql-btn"
          className="bg-[var(--vsm-red)] text-[var(--vsm-white)] px-5 py-2.5 uppercase tracking-wider text-xs font-display hover:bg-[var(--vsm-red-hover)]">
          {copied ? "✓ SQL copié" : "Copier le script SQL"}
        </button>
        <button onClick={onRetry} data-testid="schema-retry-btn"
          className="border border-[var(--vsm-border-strong)] text-[var(--vsm-cream)] px-5 py-2.5 uppercase tracking-wider text-xs font-display hover:border-[var(--vsm-red)] hover:text-[var(--vsm-red)]">
          Réessayer
        </button>
      </div>

      {error && !isTablesMissing && (
        <div className="mt-4 text-xs text-[var(--vsm-grey)] font-mono break-all">Détail : {error}</div>
      )}
    </div>
  );
}
