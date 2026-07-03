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
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    try {
      const tableNames = Object.keys(tableLabels);
      const found = [];
      for (const t of tableNames) {
        const { error } = await supabase.from(t).select("*", { head: true, count: "exact" }).limit(1);
        if (!error) found.push(t);
      }
      const j = {
        ok: found.length === tableNames.length,
        complete: `${found.length}/${tableNames.length}`,
        found,
      };
      setCheck(j);
      if (j.ok) onRetry();
    } catch {} finally { setChecking(false); }
  };

  useEffect(() => { runCheck(); }, []);

  const copySql = async () => {
    try {
      const r = await fetch(
        "https://raw.githubusercontent.com/arody23/Assistant-ia/main/server-nodejs/supabase-schema.sql"
      );
      if (!r.ok) throw new Error("fetch failed");
      const sql = await r.text();
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      toast.success("Script SQL copié dans le presse-papier");
      setTimeout(() => setCopied(false), 3500);
    } catch {
      toast.error("Copie impossible · fichier : /app/server-nodejs/supabase-schema.sql");
    }
  };

  const tableLabels = {
    bot_config: "bot_config", conversations: "conversations",
    messages: "messages", logs: "logs", whatsapp_sessions: "whatsapp_sessions",
  };

  return (
    <div className="max-w-2xl mx-auto bg-[var(--vsm-surface)] border border-[var(--vsm-red)] p-5 sm:p-8">
      <div className="font-display text-xl sm:text-2xl tracking-wider uppercase text-[var(--vsm-red)]">
        Initialisation Supabase
      </div>
      <p className="text-sm text-[var(--vsm-cream)] mt-3 leading-relaxed">
        Tables détectées dans ton projet Supabase :
        <span className="font-mono text-[var(--vsm-red)] ml-2" data-testid="schema-progress">
          {check ? check.complete : "…"}
        </span>
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Object.keys(tableLabels).map((t) => {
          const present = check?.found?.includes(t);
          return (
            <div key={t} data-testid={`tbl-${t}`}
              className={`flex items-center gap-1.5 border px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider
                ${present ? "border-[var(--vsm-green)] text-[var(--vsm-green)]" : "border-[var(--vsm-border-strong)] text-[var(--vsm-grey)]"}`}>
              <span>{present ? "✓" : "○"}</span>
              <span className="truncate">{tableLabels[t]}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-[var(--vsm-void)] border border-[var(--vsm-border)] p-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--vsm-red)] mb-2">3 étapes</div>
        <ol className="text-sm text-[var(--vsm-cream)] space-y-1.5 list-decimal list-inside leading-relaxed">
          <li>Clique <span className="text-[var(--vsm-red)] font-display">Copier le script SQL</span></li>
          <li>Ouvre <a href="https://supabase.com/dashboard/project/ehmgjgrekjoaohnnlfmw/sql/new" target="_blank" rel="noreferrer" className="text-[var(--vsm-red)] underline decoration-dotted">Supabase → SQL Editor → New query</a></li>
          <li>Colle, clique <span className="text-[var(--vsm-red)]">Run</span>, puis reviens ici → <span className="text-[var(--vsm-red)]">Vérifier</span></li>
        </ol>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={copySql} data-testid="copy-sql-btn"
          className="bg-[var(--vsm-red)] text-[var(--vsm-white)] px-5 py-2.5 uppercase tracking-wider text-xs font-display hover:bg-[var(--vsm-red-hover)]">
          {copied ? "✓ SQL copié" : "Copier le script SQL"}
        </button>
        <button onClick={runCheck} disabled={checking} data-testid="schema-retry-btn"
          className="border border-[var(--vsm-border-strong)] text-[var(--vsm-cream)] px-5 py-2.5 uppercase tracking-wider text-xs font-display hover:border-[var(--vsm-red)] hover:text-[var(--vsm-red)] disabled:opacity-50">
          {checking ? "Vérification…" : "Vérifier"}
        </button>
      </div>

      {check?.ok && (
        <div className="mt-4 text-xs text-[var(--vsm-green)] font-mono">
          ✓ Toutes les tables sont prêtes. Chargement du dashboard…
        </div>
      )}
    </div>
  );
}
