import { useState, useEffect } from "react";
import { Card, Toggle, Select, Field, RedButton } from "@/components/Primitives";

const TOGGLES = [
  { k: "voice_reply", label: "Notes vocales", desc: "Transcrire et répondre aux audios WhatsApp" },
  { k: "send_product_images", label: "Envoi d'images produits", desc: "Le bot envoie les visuels VSM Collection" },
  { k: "auto_human_transfer", label: "Transfert humain auto", desc: "Si le bot ne sait pas, escalade à l'équipe" },
  { k: "anti_spam", label: "Anti-spam", desc: "Limite les messages répétitifs / abusifs" },
  { k: "remember_history", label: "Mémoire client", desc: "Le bot se souvient des échanges précédents" },
  { k: "night_mode", label: "Mode nuit", desc: "Réponses plus brèves entre 22h et 7h" },
  { k: "ignore_groups", label: "Ignorer les groupes", desc: "Pas de réponses dans les groupes WhatsApp" },
  { k: "auto_reconnect", label: "Reconnexion auto", desc: "Reconnecte si la session tombe" },
];

export default function Comportement({ config, updateConfig }) {
  const [behavior, setBehavior] = useState(config.behavior || {});
  useEffect(() => { setBehavior(config.behavior || {}); }, [config]);

  const setKey = (k, v) => setBehavior({ ...behavior, [k]: v });
  const save = () => updateConfig({ behavior });

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card title="Capacités du bot" subtitle="Active / désactive chaque fonction"
        action={<RedButton onClick={save} testid="behavior-save-btn">Sauver</RedButton>} testid="card-toggles">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 sm:gap-x-8">
          {TOGGLES.map((t, i) => (
            <div key={t.k} className={`flex items-start justify-between gap-4 py-3.5 ${
              i < TOGGLES.length - (TOGGLES.length % 2 === 0 ? 2 : 1) ? "border-b border-[var(--vsm-border)]" : ""
            }`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--vsm-white)]">{t.label}</div>
                <div className="text-[11px] text-[var(--vsm-grey)] mt-0.5">{t.desc}</div>
              </div>
              <Toggle checked={!!behavior[t.k]} onChange={(v) => setKey(t.k, v)} testid={`toggle-${t.k}`} />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Langue & Style" subtitle="Identité conversationnelle" testid="card-tone"
        action={<RedButton onClick={save} testid="tone-save-btn">Sauver</RedButton>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
          <Field label="Langue">
            <Select value={behavior.language || "fr"} onChange={(e) => setKey("language", e.target.value)} testid="lang-select">
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ln">Lingala</option>
            </Select>
          </Field>
          <Field label="Ton">
            <Select value={behavior.tone || "premium"} onChange={(e) => setKey("tone", e.target.value)} testid="tone-select">
              <option value="premium">Premium</option>
              <option value="friendly">Chaleureux</option>
              <option value="formal">Formel</option>
              <option value="urban">Urbain</option>
            </Select>
          </Field>
          <Field label="Longueur">
            <Select value={behavior.length || "medium"} onChange={(e) => setKey("length", e.target.value)} testid="length-select">
              <option value="short">Brèves</option>
              <option value="medium">Moyennes</option>
              <option value="long">Détaillées</option>
            </Select>
          </Field>
          <Field label="Emojis">
            <Select value={behavior.emoji || "minimal"} onChange={(e) => setKey("emoji", e.target.value)} testid="emoji-select">
              <option value="none">Aucun</option>
              <option value="minimal">Minimal</option>
              <option value="rich">Expressif</option>
            </Select>
          </Field>
        </div>
      </Card>
    </div>
  );
}
