import { useEffect, useState } from "react";
import { Card, Input, OutlineButton, Pill } from "@/components/Primitives";
import { api } from "@/lib/api";
import { Search, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function Conversations() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);

  const load = async () => {
    try {
      const items = await api.listConversations();
      setList(items);
      if (items.length && !selected) setSelected(items[0]);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected?.id) return;
    api.listMessages(selected.id).then(setMessages).catch(() => setMessages([]));
  }, [selected?.id]);

  const filtered = list.filter(c =>
    !search ||
    (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.last_message || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    await api.deleteConversation(id);
    toast.success("Conversation supprimée");
    setSelected(null);
    setMessages([]);
    load();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
      {/* List */}
      <Card title="Inbox" subtitle={`${list.length} conversations`} testid="card-conv-list">
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vsm-grey)]" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full"
            testid="conv-search-input"
          />
        </div>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {filtered.length === 0 && (
            <div className="text-xs text-[var(--vsm-grey)] py-6 text-center">Aucune conversation.</div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              data-testid={`conv-item-${c.id}`}
              className={`w-full text-left flex items-start gap-3 p-3 border transition-colors
                ${selected?.id === c.id
                  ? "bg-[var(--vsm-surface-2)] border-[var(--vsm-gold)]"
                  : "border-transparent hover:bg-[var(--vsm-surface-2)] hover:border-[var(--vsm-border-strong)]"}`}
            >
              <div className="w-9 h-9 shrink-0 bg-[var(--vsm-void)] border border-[var(--vsm-gold)] text-[var(--vsm-gold)] flex items-center justify-center font-display text-sm">
                {(c.name || "C").slice(-2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-[var(--vsm-cream)] truncate">{c.name || c.id.slice(0, 8)}</div>
                  <span className="text-[10px] text-[var(--vsm-grey-2)] font-mono">{c.messages_count || 0}</span>
                </div>
                <div className="text-xs text-[var(--vsm-grey)] truncate mt-0.5">{c.last_message}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Detail */}
      <Card
        title={selected ? (selected.name || selected.id.slice(0, 8)) : "Sélectionne une conversation"}
        subtitle={selected ? "WhatsApp · live" : "—"}
        testid="card-conv-detail"
        action={selected && (
          <OutlineButton onClick={() => handleDelete(selected.id)} testid="conv-delete-btn">
            <Trash2 size={14} className="mr-1" /> Supprimer
          </OutlineButton>
        )}
      >
        {!selected ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--vsm-grey)]">
            <MessageCircle size={32} className="opacity-30" />
            <div className="text-xs uppercase tracking-wider mt-3">Aucune conversation sélectionnée</div>
          </div>
        ) : (
          <div className="bg-[var(--vsm-void)] border border-[var(--vsm-border)] p-4 max-h-[65vh] overflow-y-auto space-y-3">
            {messages.length === 0 && <div className="text-xs text-[var(--vsm-grey)] text-center py-6">Pas de messages.</div>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[78%] px-3.5 py-2.5 text-sm border ${
                    m.role === "user"
                      ? "bg-[var(--vsm-surface)] border-[var(--vsm-border-strong)] text-[var(--vsm-cream)]"
                      : "bg-[var(--vsm-gold-soft)] border-[var(--vsm-gold)] text-[var(--vsm-cream)]"
                  }`}
                >
                  <div className="leading-relaxed">{m.content}</div>
                  <div className="flex items-center justify-between gap-3 mt-1.5">
                    <span className="text-[10px] font-mono text-[var(--vsm-grey-2)]">
                      {new Date(m.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {m.role === "assistant" && m.model && <Pill tone="gold">{m.model}</Pill>}
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
