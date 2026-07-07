import { Menu, Power, RefreshCw, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LOGOUT } from "@/constants/testIds/auth";

export default function Topbar({ title, crumb, botActive, onToggleBot, onOpenSidebar }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };
  return (
    <header
      className="sticky top-0 z-20 h-14 sm:h-16 border-b border-[var(--vsm-border)] bg-[var(--vsm-black)]/85 backdrop-blur-xl
                 flex items-center justify-between gap-2 px-3 sm:px-6 lg:px-10"
      data-testid="topbar"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          className="md:hidden text-[var(--vsm-grey)] hover:text-[var(--vsm-red)] shrink-0 p-1"
          onClick={onOpenSidebar}
          data-testid="open-sidebar-btn"
        >
          <Menu size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-display text-base sm:text-2xl tracking-wider leading-none uppercase text-[var(--vsm-white)] truncate">
            {title}
          </div>
          <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.18em] sm:tracking-[0.22em] text-[var(--vsm-grey)] mt-0.5 sm:mt-1 truncate">
            VSM · {crumb}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {profile?.email && (
          <span className="hidden lg:block text-[10px] text-[var(--vsm-grey)] truncate max-w-[140px]">
            {profile.full_name || profile.email}
          </span>
        )}
        <button
          onClick={handleLogout}
          data-testid={LOGOUT.button}
          className="hidden sm:flex items-center gap-2 px-3 py-2 border border-[var(--vsm-border-strong)] text-[var(--vsm-grey)] hover:text-[var(--vsm-red)] hover:border-[var(--vsm-red)] transition-colors text-xs uppercase tracking-wider"
          title="Déconnexion"
        >
          <LogOut size={14} /> Sortir
        </button>
        <button
          onClick={() => window.location.reload()}
          className="hidden sm:flex items-center gap-2 px-3 py-2 border border-[var(--vsm-border-strong)] text-[var(--vsm-grey)] hover:text-[var(--vsm-red)] hover:border-[var(--vsm-red)] transition-colors text-xs uppercase tracking-wider"
          data-testid="topbar-refresh-btn"
        >
          <RefreshCw size={14} /> Refresh
        </button>
        <button
          onClick={onToggleBot}
          data-testid="bot-status-toggle"
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border text-[10px] sm:text-xs uppercase tracking-wider transition-colors
            ${botActive
              ? "bg-[var(--vsm-red)] border-[var(--vsm-red)] text-[var(--vsm-white)] hover:bg-[var(--vsm-red-hover)]"
              : "border-[var(--vsm-grey-2)] text-[var(--vsm-grey)] hover:border-[var(--vsm-red)] hover:text-[var(--vsm-red)]"}`}
        >
          <Power size={13} /> {botActive ? "ON" : "OFF"}
        </button>
      </div>
    </header>
  );
}
