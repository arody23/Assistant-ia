import { Menu, Power, RefreshCw } from "lucide-react";

export default function Topbar({ title, crumb, botActive, onToggleBot, onOpenSidebar }) {
  return (
    <header
      className="sticky top-0 z-20 h-16 border-b border-[var(--vsm-border)] bg-[var(--vsm-black)]/85 backdrop-blur-xl
                 flex items-center justify-between px-4 sm:px-6 lg:px-10"
      data-testid="topbar"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="md:hidden text-[var(--vsm-grey)] hover:text-[var(--vsm-gold)]"
          onClick={onOpenSidebar}
          data-testid="open-sidebar-btn"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <div className="font-display text-2xl tracking-wider leading-none uppercase text-[var(--vsm-cream)] truncate">
            {title}
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--vsm-grey)] mt-1 truncate">
            VSM Collection · {crumb}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => window.location.reload()}
          className="hidden sm:flex items-center gap-2 px-3 py-2 border border-[var(--vsm-border-strong)] text-[var(--vsm-grey)] hover:text-[var(--vsm-gold)] hover:border-[var(--vsm-gold)] transition-colors text-xs uppercase tracking-wider"
          data-testid="topbar-refresh-btn"
        >
          <RefreshCw size={14} /> Refresh
        </button>
        <button
          onClick={onToggleBot}
          data-testid="bot-status-toggle"
          className={`flex items-center gap-2 px-4 py-2 border text-xs uppercase tracking-wider transition-colors
            ${botActive
              ? "bg-[var(--vsm-gold)] border-[var(--vsm-gold)] text-[var(--vsm-black)] hover:bg-[var(--vsm-gold-hover)]"
              : "border-[var(--vsm-red)] text-[var(--vsm-red)] hover:bg-[var(--vsm-red)] hover:text-white"}`}
        >
          <Power size={14} /> {botActive ? "Bot ON" : "Bot OFF"}
        </button>
      </div>
    </header>
  );
}
