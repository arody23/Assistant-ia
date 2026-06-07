export function Card({ title, subtitle, action, children, className = "", testid }) {
  return (
    <section
      data-testid={testid}
      className={`bg-[var(--vsm-surface)] border border-[var(--vsm-border)] hover:border-[var(--vsm-red)]/40 transition-colors ${className}`}
    >
      {(title || action) && (
        <header className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--vsm-border)] flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            {title && <div className="font-display text-base sm:text-lg tracking-wider uppercase text-[var(--vsm-white)] truncate">{title}</div>}
            {subtitle && <div className="text-[11px] sm:text-xs text-[var(--vsm-grey)] mt-0.5 truncate">{subtitle}</div>}
          </div>
          {action && <div className="flex gap-2 flex-wrap shrink-0">{action}</div>}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function RedButton({ children, className = "", testid, ...rest }) {
  return (
    <button
      data-testid={testid}
      className={`bg-[var(--vsm-red)] text-[var(--vsm-white)] px-4 sm:px-5 py-2 sm:py-2.5 uppercase tracking-wider text-[11px] sm:text-xs font-display
                  hover:bg-[var(--vsm-red-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, className = "", testid, ...rest }) {
  return (
    <button
      data-testid={testid}
      className={`border border-[var(--vsm-border-strong)] text-[var(--vsm-cream)] px-4 sm:px-5 py-2 sm:py-2.5 uppercase tracking-wider text-[11px] sm:text-xs font-display
                  hover:border-[var(--vsm-red)] hover:text-[var(--vsm-red)] transition-colors inline-flex items-center justify-center ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-2 min-w-0 ${className}`}>
      <label className="text-[10px] uppercase tracking-[0.2em] text-[var(--vsm-grey)]">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-[var(--vsm-grey-2)]">{hint}</div>}
    </div>
  );
}

export function Input({ className = "", testid, ...rest }) {
  return (
    <input
      data-testid={testid}
      className={`bg-[var(--vsm-void)] border border-[var(--vsm-border-strong)] px-3 py-2.5 text-sm font-mono text-[var(--vsm-cream)] w-full
                  focus:border-[var(--vsm-red)] focus:outline-none placeholder:text-[var(--vsm-grey-2)] transition-colors ${className}`}
      {...rest}
    />
  );
}

export function Textarea({ className = "", testid, ...rest }) {
  return (
    <textarea
      data-testid={testid}
      className={`bg-[var(--vsm-void)] border border-[var(--vsm-border-strong)] px-3 py-3 text-sm text-[var(--vsm-cream)] font-body w-full
                  focus:border-[var(--vsm-red)] focus:outline-none placeholder:text-[var(--vsm-grey-2)] transition-colors resize-y ${className}`}
      {...rest}
    />
  );
}

export function Select({ className = "", testid, children, ...rest }) {
  return (
    <select
      data-testid={testid}
      className={`bg-[var(--vsm-void)] border border-[var(--vsm-border-strong)] px-3 py-2.5 text-sm text-[var(--vsm-cream)] w-full
                  focus:border-[var(--vsm-red)] focus:outline-none transition-colors appearance-none cursor-pointer ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, testid }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      data-testid={testid}
      className={`relative w-11 h-6 transition-colors shrink-0 ${checked ? "bg-[var(--vsm-red)]" : "bg-[var(--vsm-border-strong)]"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-[var(--vsm-white)] transition-transform
                    ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

export function Pill({ children, tone = "default", testid }) {
  const tones = {
    default: "border-[var(--vsm-border-strong)] text-[var(--vsm-grey)]",
    red: "border-[var(--vsm-red)] text-[var(--vsm-red)] bg-[var(--vsm-red-soft)]",
    green: "border-[var(--vsm-green)] text-[var(--vsm-green)]",
    orange: "border-[var(--vsm-orange)] text-[var(--vsm-orange)]",
    white: "border-[var(--vsm-white)] text-[var(--vsm-white)]",
  };
  return (
    <span data-testid={testid} className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] uppercase tracking-[0.18em] whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center px-4">
      {Icon && <Icon size={36} className="text-[var(--vsm-grey-2)] opacity-50" strokeWidth={1.2} />}
      <div className="font-display text-xl tracking-wider uppercase text-[var(--vsm-cream)] mt-4">{title}</div>
      {description && <div className="text-xs text-[var(--vsm-grey)] mt-2 max-w-sm leading-relaxed">{description}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
