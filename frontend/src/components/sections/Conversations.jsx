import { useCallback, useEffect, useState } from "react";
import { Card, Input, OutlineButton, Pill, EmptyState } from "@/components/Primitives";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Search, Trash2, Inbox } from "lucide-react";
import { toast } from "sonner";

export default function Conversations() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);

  const load = useCallback(async () => {
    try {
      const items = await api.listConversations();
      setList(items);
      setSelected((prev) => (items.length && !prev ? items[0] : prev));
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const sub = api.onMessages(() => load());
    return () => supabase.removeChannel(sub);
  }, [load]);

  useEffect(() => {
    if (!selected?.id) { setMessages([]); return; }
    api.listMessages(selected.id).then(setMessages).catch(() => setMessages([]));
  }, [selected?.id]);

  const filtered = list.filter(c =>
    !search ||
    (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search) ||
    (c.last_message || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette conversation ?")) return;
    await api.deleteConversation(id);
    toast.success("Conversation supprimée");
    setSelected(null);
    setMessages([]);
    load();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 sm:gap-6">
      <Card title="Inbox" subtitle={`${list.length} conversation${list.length>1?"s":""}`} testid="card-conv-list">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vsm-grey)]" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" testid="conv-search-input" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={Inbox} title="Aucune conversation" description="Les messages clients apparaîtront ici dès que le bot recevra son premier message WhatsApp." />
        ) : (
          <div className="space-y-1 max-h-[60vh] overflow-y-auto -mx-2 px-2">
            {filtered.map((c) => (
              <button
                key={c.id} onClick={() => setSelected(c)} data-testid={`conv-item-${c.id}`}
                className={`w-full text-left flex items-start gap-3 p-3 border transition-colors
                  ${selected?.id === c.id ? "bg-[var(--vsm-surface-2)] border-[var(--vsm-red)]"
                    : "border-transparent hover:bg-[var(--vsm-surface-2)] hover:border-[var(--vsm-border-strong)]"}`}>
                <div className="w-9 h-9 shrink-0 bg-[var(--vsm-void)] border border-[var(--vsm-red)] text-[var(--vsm-red)] flex items-center justify-center font-display text-sm">
                  {(c.name || c.phone || "C").slice(-2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-[var(--vsm-white)] truncate">{c.name || c.phone || c.id.slice(0, 8)}</div>
                    <span className="text-[10px] text-[var(--vsm-grey-2)] font-mono shrink-0">{c.messages_count || 0}</span>
                  </div>
                  <div className="text-xs text-[var(--vsm-grey)] truncate mt-0.5">{c.last_message || "—"}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card
        title={selected ? (selected.name || selected.phone || selected.id.slice(0, 8)) : "Sélection"}
        subtitle={selected ? `WhatsApp · ${selected.phone || ""}` : "—"}
        testid="card-conv-detail"
        action={selected && (
          <OutlineButton onClick={() => handleDelete(selected.id)} testid="conv-delete-btn">
            <Trash2 size={14} className="mr-1" /> Suppr
          </OutlineButton>
        )}
      >
        {!selected ? (
          <EmptyState icon={Inbox} title="Aucune sélection" description="Choisis une conversation dans la liste pour l'afficher." />
        ) : (
          <div className="bg-[var(--vsm-void)] border border-[var(--vsm-border)] p-3 sm:p-4 max-h-[65vh] overflow-y-auto space-y-3">
            {messages.length === 0 && <div className="text-xs text-[var(--vsm-grey)] text-center py-6">Pas de messages.</div>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] px-3 py-2 text-sm border ${
                    m.role === "user"
                      ? "bg-[var(--vsm-surface)] border-[var(--vsm-border-strong)] text-[var(--vsm-cream)]"
                      : "bg-[var(--vsm-red-soft)] border-[var(--vsm-red)] text-[var(--vsm-white)]"
                  }`}>
                  <div className="leading-relaxed whitespace-pre-wrap break-words">{m.content}</div>
                  <div className="flex items-center justify-between gap-3 mt-1.5">
                    <span className="text-[10px] font-mono text-[var(--vsm-grey-2)]">
                      {new Date(m.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {m.role === "assistant" && m.model && <Pill tone="red">{m.model}</Pill>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
