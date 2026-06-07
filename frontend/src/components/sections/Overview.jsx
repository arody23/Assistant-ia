import { useEffect, useState } from "react";
import { Card, Pill } from "@/components/Primitives";
import { api } from "@/lib/api";
import { ArrowUpRight, MessageCircle, Users, ShoppingBag, CheckCircle2, Clock, Activity } from "lucide-react";

const KPI_DEFS = [
  { key: "messages_today", label: "Messages aujourd'hui", icon: MessageCircle, delta: "delta_messages" },
  { key: "unique_clients", label: "Clients uniques", icon: Users, delta: "delta_clients" },
  { key: "products_viewed", label: "Produits consultés", icon: ShoppingBag, delta: "delta_products" },
  { key: "resolution_rate", label: "Taux de résolution", icon: CheckCircle2, delta: "delta_resolution", suffix: "%" },
];

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [convs, setConvs] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([api.stats(), api.listConversations()]);
        setStats(s);
        setConvs(c.slice(0, 4));
      } catch {}
    })();
  }, []);

  const maxBar = stats ? Math.max(1, ...stats.weekly_series.map(d => d.value)) : 1;

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_DEFS.map((k) => {
          const Icon = k.icon;
          const v = stats?.[k.key] ?? 0;
          const d = stats?.[k.delta] ?? "—";
          return (
            <div key={k.key} data-testid={`kpi-${k.key}`} className="bg-[var(--vsm-surface)] border border-[var(--vsm-border)] hover:border-[var(--vsm-gold)]/50 transition-colors p-5">
              <div className="flex items-start justify-between">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--vsm-grey)] leading-tight">{k.label}</div>
                <Icon size={16} className="text-[var(--vsm-gold)]" strokeWidth={1.5} />
              </div>
              <div className="font-display text-5xl tracking-tight mt-3 text-[var(--vsm-cream)] leading-none">
                {v}{k.suffix || ""}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--vsm-green)]">
                <ArrowUpRight size={12} /> {d} <span className="text-[var(--vsm-grey-2)]">vs hier</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity chart + Quick info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Activité 7 jours" subtitle="Messages reçus" className="lg:col-span-2" testid="card-activity">
          <div className="flex items-end justify-between gap-3 h-44">
            {(stats?.weekly_series || []).map((d, i) => {
              const h = (d.value / maxBar) * 100;
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1 min-w-0" data-testid={`bar-${i}`}>
                  <div className="w-full bg-[var(--vsm-void)] border border-[var(--vsm-border)] flex items-end h-full">
                    <div
                      className="w-full bg-gradient-to-t from-[var(--vsm-gold)] to-[var(--vsm-gold-hover)] transition-all"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--vsm-grey)]">{d.label}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t border-[var(--vsm-border)]">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[var(--vsm-gold)]" />
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--vsm-grey)]">Pic d'activité</div>
                <div className="text-sm font-mono text-[var(--vsm-cream)]">{stats?.peak_hour || "—"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[var(--vsm-gold)]" />
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--vsm-grey)]">Temps de réponse</div>
                <div className="text-sm font-mono text-[var(--vsm-cream)]">{stats?.avg_response_ms || 0}ms</div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Conversations récentes" subtitle="Live feed" testid="card-recent">
          <div className="space-y-1">
            {convs.length === 0 && (
              <div className="text-xs text-[var(--vsm-grey)] py-6 text-center">Aucune conversation pour l'instant.<br/>Utilise le <span className="text-[var(--vsm-gold)]">Playground</span> pour tester le bot.</div>
            )}
            {convs.map((c) => (
              <div key={c.id} className="flex items-start gap-3 px-1 py-3 border-b border-[var(--vsm-border)] last:border-0">
                <div className="w-9 h-9 bg-[var(--vsm-void)] border border-[var(--vsm-gold)] text-[var(--vsm-gold)] flex items-center justify-center font-display text-sm">
                  {(c.name || "C").slice(-2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <div className="text-sm text-[var(--vsm-cream)] truncate">{c.name || c.id?.slice(0,8)}</div>
                    <Pill tone="gold">live</Pill>
                  </div>
                  <div className="text-xs text-[var(--vsm-grey)] truncate mt-0.5">{c.last_message}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
