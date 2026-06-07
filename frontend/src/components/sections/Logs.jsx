import { useEffect, useState } from "react";
import { Card, OutlineButton, Pill, EmptyState } from "@/components/Primitives";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Trash2, Terminal } from "lucide-react";
import { toast } from "sonner";

const LEVEL_TONE = { INFO: "default", SUCCESS: "green", WARN: "orange", ERROR: "red" };

export default function LogsView() {
  const [logs, setLogs] = useState([]);

  const load = async () => {
    try { setLogs(await api.logs()); } catch {}
  };

  useEffect(() => {
    load();
    const sub = api.onLogs(() => load());
    return () => supabase.removeChannel(sub);
  }, []);

  const clear = async () => {
    if (!window.confirm("Effacer tous les logs ?")) return;
    await api.clearLogs(); load(); toast("Logs effacés");
  };

  return (
    <Card title="Logs système" subtitle={`${logs.length} entrée${logs.length>1?"s":""} · realtime`} testid="card-logs"
      action={<OutlineButton onClick={clear} testid="logs-clear-btn"><Trash2 size={12} className="mr-1" /> Vider</OutlineButton>}>
      {logs.length === 0 ? (
        <EmptyState icon={Terminal} title="Aucun log"
          description="Les événements du backend Node.js (démarrage, QR, messages reçus, erreurs Groq) s'afficheront ici en temps réel." />
      ) : (
        <div className="bg-[var(--vsm-void)] border border-[var(--vsm-border)] p-3 max-h-[60vh] overflow-y-auto font-mono text-xs space-y-1">
          {logs.map((l) => (
            <div key={l.id} className="flex items-start gap-2 sm:gap-3 py-1 hover:bg-[var(--vsm-surface)] px-2 -mx-2" data-testid={`log-line-${l.id}`}>
              <span className="text-[var(--vsm-grey-2)] shrink-0 w-16 sm:w-20 text-[10px]">{new Date(l.ts).toLocaleTimeString("fr-FR")}</span>
              <span className="shrink-0"><Pill tone={LEVEL_TONE[l.level] || "default"}>{l.level}</Pill></span>
              <span className="text-[var(--vsm-cream)] break-words min-w-0">{l.message}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
