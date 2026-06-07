import { useEffect, useState } from "react";
import { Card, Pill, EmptyState } from "@/components/Primitives";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { ArrowUpRight, MessageCircle, Users, ShoppingBag, CheckCircle2, Activity, Inbox } from "lucide-react";

const KPI_DEFS = [
  { key: "messages_today", label: "Messages aujourd'hui", icon: MessageCircle },
  { key: "unique_clients", label: "Clients uniques", icon: Users },
  { key: "products_viewed", label: "Produits consultés", icon: ShoppingBag },
  { key: "resolution_rate", label: "Taux de résolution", icon: CheckCircle2, suffix: "%" },
];

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [convs, setConvs] = useState([]);

  const load = async () => {
    try {
      const [s, c] = await Promise.all([api.stats(), api.listConversations()]);
      setStats(s);
      setConvs(c.slice(0, 4));
    } catch {}
  };

  useEffect(() => {
    load();
    const sub = api.onMessages(() => load());
    return () => supabase.removeChannel(sub);
  }, []);

  const maxBar = stats ? Math.max(1, ...stats.weekly_series.map(d => d.value)) : 1;
  const hasData = stats && (stats.messages_today > 0 || stats.unique_clients > 0);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {KPI_DEFS.map((k) => {
          const Icon = k.icon;
          const v = stats?.[k.key] ?? 0;
          return (
            <div key={k.key} data-testid={`kpi-${k.key}`} className="bg-[var(--vsm-surface)] border border-[var(--vsm-border)] hover:border-[var(--vsm-red)]/50 transition-colors p-3 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-[var(--vsm-grey)] leading-tight">{k.label}</div>
                <Icon size={14} className="text-[var(--vsm-red)] shrink-0" strokeWidth={1.5} />
              </div>
              <div className="font-display text-3xl sm:text-5xl tracking-tight mt-2 sm:mt-3 text-[var(--vsm-white)] leading-none">
                {v}{k.suffix || ""}
              </div>
              <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-[var(--vsm-grey-2)]">
                {hasData ? <span className="flex items-center gap-1 text-[var(--vsm-green)]"><ArrowUpRight size={11} />live</span> : "—"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card title="Activité 7 jours" subtitle="Messages reçus (Supabase live)" className="lg:col-span-2" testid="card-activity">
          {(stats?.weekly_series || []).every(d => d.value === 0) ? (
            <EmptyState icon={Activity} title="Pas encore d'activité"
              description="Connecte WhatsApp et le bot commencera à recevoir des messages. L'activité s'affichera ici en temps réel." />
          ) : (
            <div className="flex items-end justify-between gap-2 sm:gap-3 h-40 sm:h-44">
              {(stats?.weekly_series || []).map((d, i) => {
                const h = (d.value / maxBar) * 100;
                return (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1 min-w-0" data-testid={`bar-${i}`}>
                    <div className="w-full bg-[var(--vsm-void)] border border-[var(--vsm-border)] flex items-end h-full">
                      <div className="w-full bg-[var(--vsm-red)] transition-all" style={{ height: `${h}%` }} />
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--vsm-grey)]">{d.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Conversations récentes" subtitle="Live feed" testid="card-recent">
          {convs.length === 0 ? (
            <EmptyState icon={Inbox} title="Inbox vide"
              description="Aucune conversation pour le moment." />
          ) : (
            <div className="space-y-1">
              {convs.map((c) => (
                <div key={c.id} className="flex items-start gap-3 px-1 py-3 border-b border-[var(--vsm-border)] last:border-0" data-testid={`recent-${c.id}`}>
                  <div className="w-9 h-9 bg-[var(--vsm-void)] border border-[var(--vsm-red)] text-[var(--vsm-red)] flex items-center justify-center font-display text-sm shrink-0">
                    {(c.name || c.phone || "C").slice(-2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2 items-center">
                      <div className="text-sm text-[var(--vsm-white)] truncate">{c.name || c.phone || c.id.slice(0,8)}</div>
                      <Pill tone="red">live</Pill>
                    </div>
                    <div className="text-xs text-[var(--vsm-grey)] truncate mt-0.5">{c.last_message || "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
