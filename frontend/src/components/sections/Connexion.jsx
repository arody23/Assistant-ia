import { Card, OutlineButton, Pill, EmptyState } from "@/components/Primitives";
import { Smartphone, CheckCircle2, AlertCircle, Loader2, QrCode, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const STATUS_LABEL = {
  disconnected: { label: "Hors-ligne", tone: "default", icon: AlertCircle },
  qr_pending: { label: "QR à scanner", tone: "orange", icon: QrCode },
  authenticated: { label: "Authentification…", tone: "orange", icon: Loader2 },
  ready: { label: "En ligne", tone: "green", icon: CheckCircle2 },
};

export default function Connexion({ session }) {
  const status = session?.status || "disconnected";
  const meta = STATUS_LABEL[status] || STATUS_LABEL.disconnected;
  const StatusIcon = meta.icon;
  const qr = session?.qr_code;

  const handleReset = async () => {
    if (!window.confirm("Réinitialiser la session ? Tu devras re-scanner le QR.")) return;
    await api.resetSession();
    toast.success("Session réinitialisée. Redémarre le backend Node.js pour générer un nouveau QR.");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 sm:gap-6">
      <Card title="Session WhatsApp" subtitle="whatsapp-web.js · QR live" testid="card-wa-session"
        action={<OutlineButton onClick={handleReset} testid="wa-reset-btn"><RefreshCw size={12} className="mr-1" /> Reset</OutlineButton>}>
        <div className="flex flex-col items-center text-center py-4 sm:py-6">
          <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-[var(--vsm-red)] flex items-center justify-center bg-white p-3" data-testid="wa-qr-frame">
            {qr ? (
              <img src={qr} alt="WhatsApp QR" className="w-full h-full object-contain" data-testid="wa-qr-image" />
            ) : status === "ready" ? (
              <div className="flex flex-col items-center gap-3 text-[var(--vsm-black)]">
                <CheckCircle2 size={56} className="text-[var(--vsm-red)]" />
                <div className="font-display text-lg tracking-wider">SESSION ACTIVE</div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-[var(--vsm-grey-2)]">
                <QrCode size={56} strokeWidth={1.2} />
                <div className="text-[10px] uppercase tracking-[0.2em] text-center">En attente du backend Node.js</div>
              </div>
            )}
          </div>

          <div className="mt-5">
            <Pill tone={meta.tone} testid="wa-status-pill">
              <StatusIcon size={11} className={status === "authenticated" ? "animate-spin" : ""} />
              {meta.label}
            </Pill>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:gap-6 w-full max-w-sm text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--vsm-grey)]">Numéro</div>
              <div className="font-mono text-[var(--vsm-white)] mt-0.5 truncate" data-testid="wa-phone">
                {session?.phone_number || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--vsm-grey)]">Connecté depuis</div>
              <div className="font-mono text-[var(--vsm-white)] mt-0.5">
                {session?.connected_at
                  ? new Date(session.connected_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
                  : "—"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Mode d'emploi" subtitle="Activation du bot" testid="card-wa-howto">
        <div className="space-y-5">
          <div className="bg-[var(--vsm-void)] border border-[var(--vsm-border)] p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--vsm-red)] mb-3 flex items-center gap-2">
              <Smartphone size={12} /> 1 · Démarre le backend Node.js
            </div>
            <pre className="text-[11px] font-mono text-[var(--vsm-cream)] leading-relaxed whitespace-pre-wrap break-all">
{`cd server-nodejs
cp .env.example .env
# remplis SUPABASE_URL, SUPABASE_SERVICE_KEY,
# GROQ_API_KEY dans .env
npm install
npm start`}
            </pre>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--vsm-red)] mb-2">2 · Scanne le QR</div>
            <ol className="text-sm text-[var(--vsm-cream)] space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>Ouvre WhatsApp sur ton téléphone</li>
              <li>Paramètres → Appareils liés → Lier un appareil</li>
              <li>Scanne le QR ci-contre</li>
              <li>Le bot prend le relais sur tous les messages entrants</li>
            </ol>
          </div>

          <div className="bg-[var(--vsm-red-soft)] border border-[var(--vsm-red)] p-3 text-[11px] text-[var(--vsm-cream)] leading-relaxed">
            <strong className="text-[var(--vsm-red)] uppercase tracking-wider text-[10px]">Anti-bannissement</strong><br/>
            whatsapp-web.js applique : délai aléatoire 1.2-3 s, indicateur "en train d'écrire", présence online,
            limite 30 réponses/min, ignore les groupes. Utilise <span className="font-mono">un numéro dédié au bot</span>.
          </div>
        </div>
      </Card>
    </div>
  );
}
