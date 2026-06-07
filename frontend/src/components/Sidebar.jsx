import {
  LayoutDashboard, MessagesSquare, Sparkles, Smartphone,
  Settings2, Sliders, Terminal, FlaskConical, X,
} from "lucide-react";

const NAV = [
  { section: "Principal", items: [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "conversations", label: "Conversations", icon: MessagesSquare, badge: null },
    { key: "playground", label: "Playground", icon: FlaskConical },
  ]},
  { section: "Configuration", items: [
    { key: "instructions", label: "Instructions IA", icon: Sparkles },
    { key: "connexion", label: "WhatsApp", icon: Smartphone },
    { key: "api", label: "Config API", icon: Settings2 },
    { key: "comportement", label: "Comportement", icon: Sliders },
  ]},
  { section: "Système", items: [
    { key: "logs", label: "Logs", icon: Terminal },
  ]},
];

export default function Sidebar({ active, onSelect, open, onClose, config }) {
  const botActive = !!config?.bot_active;
  const waConnected = !!config?.whatsapp?.connected;

  return (
    <aside
      data-testid="sidebar"
      className={`fixed top-0 left-0 h-full w-64 bg-[var(--vsm-void)] border-r border-[var(--vsm-border)]
        z-40 transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        flex flex-col`}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-[var(--vsm-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--vsm-gold)] text-[var(--vsm-black)] font-display text-xl flex items-center justify-center">
            VSM
          </div>
          <div>
            <div className="font-display text-xl tracking-wider text-[var(--vsm-cream)]">VSM&nbsp;BOT</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--vsm-grey)]">Customer · Console</div>
          </div>
        </div>
        <button className="md:hidden text-[var(--vsm-grey)] hover:text-[var(--vsm-gold)]" onClick={onClose} data-testid="close-sidebar-btn">
          <X size={18} />
        </button>
      </div>

      {/* Status */}
      <div className="px-5 py-4 border-b border-[var(--vsm-border)] flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${botActive ? "bg-[var(--vsm-green)] pulse-gold" : "bg-[var(--vsm-red)]"}`}
          data-testid="sidebar-bot-status-dot"
        />
        <span className="text-xs uppercase tracking-wider text-[var(--vsm-grey)]">
          Bot {botActive ? "actif" : "désactivé"}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4">
        {NAV.map((group) => (
          <div key={group.section} className="mb-4">
            <div className="px-5 mb-1 text-[10px] uppercase tracking-[0.22em] text-[var(--vsm-grey-2)]">{group.section}</div>
            {group.items.map((it) => {
              const Icon = it.icon;
              const isActive = active === it.key;
              return (
                <button
                  key={it.key}
                  onClick={() => onSelect(it.key)}
                  data-testid={`nav-${it.key}-link`}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-all
                    ${isActive
                      ? "text-[var(--vsm-gold)] bg-[var(--vsm-surface)] border-l-2 border-[var(--vsm-gold)]"
                      : "text-[var(--vsm-grey)] border-l-2 border-transparent hover:text-[var(--vsm-cream)] hover:bg-[var(--vsm-surface)]"}`}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  <span className="flex-1 text-left">{it.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[var(--vsm-border)] text-[11px] font-mono text-[var(--vsm-grey-2)] leading-relaxed">
        <div>Engine · {config?.model || "llama-3.1-8b-instant"}</div>
        <div>WhatsApp · <span className={waConnected ? "text-[var(--vsm-green)]" : "text-[var(--vsm-red)]"}>
          {waConnected ? "online" : "offline"}
        </span></div>
        <div className="mt-2 text-[var(--vsm-gold)] tracking-widest">v1.0 · MADE IN DRC</div>
      </div>
    </aside>
  );
}
