import { Card, GoldButton, OutlineButton, Pill, Toggle, Field } from "@/components/Primitives";
import { QrCode, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function Connexion({ config, updateConfig, reloadConfig }) {
  const wa = config.whatsapp || {};
  const connected = !!wa.connected;

  const handleConnect = async () => {
    await api.connectWA();
    toast.success("WhatsApp connecté (mode démo)");
    reloadConfig();
  };
  const handleDisconnect = async () => {
    await api.disconnectWA();
    toast("WhatsApp déconnecté");
    reloadConfig();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
      <Card title="Statut connexion" subtitle="Lien WhatsApp Business" testid="card-wa-status">
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-44 h-44 border-2 border-dashed border-[var(--vsm-gold)] flex flex-col items-center justify-center text-[var(--vsm-grey)] gap-3 bg-[var(--vsm-void)]">
            <QrCode size={48} className="text-[var(--vsm-gold)]" strokeWidth={1.2} />
            <div className="text-[10px] uppercase tracking-[0.18em]">
              {connected ? "Session active" : "QR Code à scanner"}
            </div>
          </div>

          <div className="mt-5">
            <Pill tone={connected ? "green" : "red"} testid="wa-pill">
              {connected ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
              {connected ? "Connecté" : "Hors-ligne"}
            </Pill>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 w-full max-w-xs text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--vsm-grey)]">Numéro</div>
              <div className="font-mono text-[var(--vsm-cream)] mt-0.5">{wa.phone_number || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--vsm-grey)]">Depuis</div>
              <div className="font-mono text-[var(--vsm-cream)] mt-0.5">
                {wa.connected_at ? new Date(wa.connected_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "—"}
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            {!connected ? (
              <GoldButton onClick={handleConnect} testid="wa-connect-btn">Simuler connexion</GoldButton>
            ) : (
              <OutlineButton onClick={handleDisconnect} testid="wa-disconnect-btn">Déconnecter</OutlineButton>
            )}
          </div>
        </div>
      </Card>

      <Card title="Paramètres connexion" testid="card-wa-settings">
        <div className="space-y-5">
          <ToggleRow
            label="Reconnexion automatique"
            desc="Le bot tente de se reconnecter si la session tombe"
            checked={config.behavior?.auto_reconnect !== false}
            onChange={(v) => updateConfig({ behavior: { ...config.behavior, auto_reconnect: v } })}
            testid="toggle-auto-reconnect"
          />
          <ToggleRow
            label="Ignorer les groupes"
            desc="Ne répond pas aux messages de groupe WhatsApp"
            checked={config.behavior?.ignore_groups !== false}
            onChange={(v) => updateConfig({ behavior: { ...config.behavior, ignore_groups: v } })}
            testid="toggle-ignore-groups"
          />
          <ToggleRow
            label="Notifier les déconnexions"
            desc="Recevoir une alerte en cas de coupure"
            checked={config.behavior?.notify_disconnects ?? true}
            onChange={(v) => updateConfig({ behavior: { ...config.behavior, notify_disconnects: v } })}
            testid="toggle-notify-disconnects"
          />

          <div className="pt-4 border-t border-[var(--vsm-border)]">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--vsm-grey)] mb-3">Instructions</div>
            <ol className="text-sm text-[var(--vsm-cream)] space-y-2 list-decimal list-inside leading-relaxed">
              <li>Ouvre WhatsApp sur ton téléphone</li>
              <li>Paramètres → Appareils liés → Lier un appareil</li>
              <li>Scanne le QR code affiché ci-contre</li>
              <li>Le bot prend le relais sur les messages entrants</li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange, testid }) {
  return (
    <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--vsm-border)] last:border-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[var(--vsm-cream)]">{label}</div>
        <div className="text-xs text-[var(--vsm-grey)] mt-0.5">{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} testid={testid} />
    </div>
  );
}
