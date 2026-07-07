import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LOGIN } from "@/constants/testIds/auth";

export default function Login() {
  const { isAdmin, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!loading && isAdmin) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err?.message || "Connexion impossible";
      if (msg.includes("Invalid login credentials")) {
        setError("Email ou mot de passe incorrect.");
      } else if (msg.includes("administrateurs")) {
        setError("Ce compte n'a pas les droits administrateur.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--vsm-black)] relative z-10">
      <div className="w-full max-w-md border border-[var(--vsm-border-strong)] bg-[var(--vsm-surface)] p-6 sm:p-8 animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 flex items-center justify-center bg-[var(--vsm-red)] text-white">
            <Lock size={18} />
          </div>
          <div>
            <div className="font-display text-xl uppercase tracking-wider text-[var(--vsm-white)]">
              VSM Dashboard
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--vsm-grey)] mt-0.5">
              Connexion administrateur
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-[10px] uppercase tracking-[0.18em] text-[var(--vsm-grey)] mb-1.5">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid={LOGIN.emailInput}
              className="w-full bg-[var(--vsm-void)] border border-[var(--vsm-border-strong)] px-3 py-2.5 text-sm text-[var(--vsm-cream)] placeholder:text-[var(--vsm-grey-2)] focus:outline-none focus:border-[var(--vsm-red)]"
              placeholder="admin@gmail.com"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-[10px] uppercase tracking-[0.18em] text-[var(--vsm-grey)] mb-1.5">
              Mot de passe
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid={LOGIN.passwordInput}
              className="w-full bg-[var(--vsm-void)] border border-[var(--vsm-border-strong)] px-3 py-2.5 text-sm text-[var(--vsm-cream)] placeholder:text-[var(--vsm-grey-2)] focus:outline-none focus:border-[var(--vsm-red)]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-xs text-[var(--vsm-red)] border border-[var(--vsm-red)]/30 bg-[var(--vsm-red-soft)] px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || loading}
            data-testid={LOGIN.submitButton}
            className="w-full flex items-center justify-center gap-2 bg-[var(--vsm-red)] text-white py-2.5 uppercase tracking-wider text-xs font-display hover:bg-[var(--vsm-red-hover)] disabled:opacity-50"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Connexion…</> : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-[10px] text-center text-[var(--vsm-grey)] uppercase tracking-wider">
          Le chatbot public reste accessible sur{" "}
          <a href="/chatbot" className="text-[var(--vsm-red)] hover:underline">/chatbot</a>
        </p>
      </div>
    </div>
  );
}
