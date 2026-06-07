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
import { toast } from "sonner";

const SECTIONS = {
  overview: { label: "Overview", crumb: "Tableau de bord", Comp: Overview },
  conversations: { label: "Conversations", crumb: "Messages clients", Comp: Conversations },
  playground: { label: "Playground", crumb: "Test du bot", Comp: Playground },
  instructions: { label: "Instructions IA", crumb: "Prompt & réponses", Comp: Instructions },
  connexion: { label: "WhatsApp", crumb: "Connexion bot", Comp: Connexion },
  api: { label: "Config API", crumb: "Groq · Whisper · Limites", Comp: ConfigApi },
  comportement: { label: "Comportement", crumb: "Préférences du bot", Comp: Comportement },
  logs: { label: "Logs", crumb: "Activité système", Comp: LogsView },
};

export default function Dashboard() {
  const [active, setActive] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [config, setConfig] = useState(null);

  const loadConfig = async () => {
    try {
      const c = await api.getConfig();
      setConfig(c);
    } catch (e) {
      toast.error("Impossible de charger la configuration");
    }
  };

  useEffect(() => { loadConfig(); }, []);

  const updateConfig = async (patch) => {
    try {
      const c = await api.updateConfig(patch);
      setConfig(c);
      toast.success("Configuration sauvegardée");
    } catch (e) {
      toast.error("Échec de la sauvegarde");
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
      />
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}
      <main className="flex-1 min-w-0 md:ml-64">
        <Topbar
          title={SECTIONS[active]?.label}
          crumb={SECTIONS[active]?.crumb}
          botActive={!!config?.bot_active}
          onToggleBot={toggleBot}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <div className="p-4 sm:p-6 lg:p-10 animate-fade-up" key={active}>
          {config ? (
            <ActiveComp config={config} updateConfig={updateConfig} reloadConfig={loadConfig} />
          ) : (
            <div className="text-[var(--vsm-grey)] text-sm">Chargement…</div>
          )}
        </div>
      </main>
    </div>
  );
}
