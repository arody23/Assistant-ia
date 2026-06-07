export function Card({ title, subtitle, action, children, className = "", testid }) {
  return (
    <section
      data-testid={testid}
      className={`bg-[var(--vsm-surface)] border border-[var(--vsm-border)] hover:border-[var(--vsm-gold)]/40 transition-colors ${className}`}
    >
      {(title || action) && (
        <header className="px-5 py-4 border-b border-[var(--vsm-border)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            {title && <div className="font-display text-lg tracking-wider uppercase text-[var(--vsm-cream)] truncate">{title}</div>}
            {subtitle && <div className="text-xs text-[var(--vsm-grey)] mt-0.5 truncate">{subtitle}</div>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function GoldButton({ children, className = "", testid, ...rest }) {
  return (
    <button
      data-testid={testid}
      className={`bg-[var(--vsm-gold)] text-[var(--vsm-black)] px-5 py-2.5 uppercase tracking-wider text-xs font-display
                  hover:bg-[var(--vsm-gold-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
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
      className={`border border-[var(--vsm-border-strong)] text-[var(--vsm-cream)] px-5 py-2.5 uppercase tracking-wider text-xs font-display
                  hover:border-[var(--vsm-gold)] hover:text-[var(--vsm-gold)] transition-colors ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
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
      className={`bg-[var(--vsm-void)] border border-[var(--vsm-border-strong)] px-3 py-2.5 text-sm font-mono text-[var(--vsm-cream)]
                  focus:border-[var(--vsm-gold)] focus:outline-none placeholder:text-[var(--vsm-grey-2)] transition-colors ${className}`}
      {...rest}
    />
  );
}

export function Textarea({ className = "", testid, ...rest }) {
  return (
    <textarea
      data-testid={testid}
      className={`bg-[var(--vsm-void)] border border-[var(--vsm-border-strong)] px-3 py-3 text-sm text-[var(--vsm-cream)] font-body
                  focus:border-[var(--vsm-gold)] focus:outline-none placeholder:text-[var(--vsm-grey-2)] transition-colors resize-y ${className}`}
      {...rest}
    />
  );
}

export function Select({ className = "", testid, children, ...rest }) {
  return (
    <select
      data-testid={testid}
      className={`bg-[var(--vsm-void)] border border-[var(--vsm-border-strong)] px-3 py-2.5 text-sm text-[var(--vsm-cream)]
                  focus:border-[var(--vsm-gold)] focus:outline-none transition-colors appearance-none cursor-pointer ${className}`}
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
      className={`relative w-11 h-6 transition-colors ${checked ? "bg-[var(--vsm-gold)]" : "bg-[var(--vsm-border-strong)]"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-[var(--vsm-black)] transition-transform
                    ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

export function Pill({ children, tone = "default", testid }) {
  const tones = {
    default: "border-[var(--vsm-border-strong)] text-[var(--vsm-grey)]",
    gold: "border-[var(--vsm-gold)] text-[var(--vsm-gold)] bg-[var(--vsm-gold-soft)]",
    green: "border-[var(--vsm-green)] text-[var(--vsm-green)]",
    red: "border-[var(--vsm-red)] text-[var(--vsm-red)]",
    orange: "border-[var(--vsm-orange)] text-[var(--vsm-orange)]",
  };
  return (
    <span data-testid={testid} className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-[10px] uppercase tracking-[0.18em] ${tones[tone]}`}>
      {children}
    </span>
  );
}
