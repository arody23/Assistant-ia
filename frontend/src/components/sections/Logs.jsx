import { useEffect, useState, useRef } from "react";
import { Card, OutlineButton, GoldButton, Pill } from "@/components/Primitives";
import { api } from "@/lib/api";
import { Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

const LEVEL_TONE = {
  INFO: "default",
  SUCCESS: "green",
  WARN: "orange",
  ERROR: "red",
};

export default function LogsView() {
  const [logs, setLogs] = useState([]);
  const ref = useRef(null);

  const load = async () => {
    try { setLogs(await api.logs()); } catch {}
  };
  useEffect(() => {
    load();
    const i = setInterval(load, 3500);
    return () => clearInterval(i);
  }, []);

  const clear = async () => { await api.clearLogs(); load(); toast("Logs effacés"); };
  const simulate = async () => { await api.simulateLogs(); load(); toast.success("Activité simulée"); };

  return (
    <Card
      title="Logs système"
      subtitle={`${logs.length} entrées · auto-refresh`}
      testid="card-logs"
      action={
        <div className="flex gap-2">
          <OutlineButton onClick={simulate} testid="logs-simulate-btn"><Zap size={12} className="mr-1" /> Simuler</OutlineButton>
          <OutlineButton onClick={clear} testid="logs-clear-btn"><Trash2 size={12} className="mr-1" /> Vider</OutlineButton>
        </div>
      }
    >
      <div ref={ref} className="bg-[var(--vsm-void)] border border-[var(--vsm-border)] p-3 max-h-[60vh] overflow-y-auto font-mono text-xs space-y-1">
        {logs.length === 0 && (
          <div className="text-center text-[var(--vsm-grey-2)] py-10 text-xs">
            Aucun log. Lance une conversation dans le <span className="text-[var(--vsm-gold)]">Playground</span> ou clique sur <span className="text-[var(--vsm-gold)]">Simuler</span>.
          </div>
        )}
        {logs.map((l) => (
          <div key={l.id} className="flex items-start gap-3 py-1 hover:bg-[var(--vsm-surface)] px-2 -mx-2" data-testid={`log-line-${l.id}`}>
            <span className="text-[var(--vsm-grey-2)] shrink-0 w-20">{new Date(l.ts).toLocaleTimeString("fr-FR")}</span>
            <span className="shrink-0"><Pill tone={LEVEL_TONE[l.level] || "default"}>{l.level}</Pill></span>
            <span className="text-[var(--vsm-cream)] break-all">{l.message}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
