import { useState, useEffect } from "react";
import { Card, Toggle, Select, Field, GoldButton } from "@/components/Primitives";

const TOGGLES = [
  { k: "voice_reply", label: "Notes vocales", desc: "Transcrire et répondre aux audios WhatsApp" },
  { k: "send_product_images", label: "Envoi d'images produits", desc: "Le bot envoie les visuels de la boutique" },
  { k: "auto_human_transfer", label: "Transfert humain auto", desc: "Si le bot ne sait pas, transfère à l'équipe" },
  { k: "anti_spam", label: "Anti-spam", desc: "Limite les messages répétitifs / abusifs" },
  { k: "remember_history", label: "Mémoire client", desc: "Le bot se souvient des échanges précédents" },
  { k: "night_mode", label: "Mode nuit", desc: "Réponses plus brèves entre 22h et 7h" },
];

export default function Comportement({ config, updateConfig }) {
  const [behavior, setBehavior] = useState(config.behavior || {});

  useEffect(() => { setBehavior(config.behavior || {}); }, [config]);

  const setKey = (k, v) => setBehavior({ ...behavior, [k]: v });
  const save = () => updateConfig({ behavior });

  return (
    <div className="space-y-6">
      <Card title="Toggles comportement" subtitle="Active / désactive les capacités du bot"
        action={<GoldButton onClick={save} testid="behavior-save-btn">Sauver</GoldButton>}
        testid="card-toggles">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
          {TOGGLES.map((t) => (
            <div key={t.k} className="flex items-start justify-between gap-4 py-4 border-b border-[var(--vsm-border)] md:[&:nth-last-child(-n+2)]:border-0 [&:last-child]:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--vsm-cream)]">{t.label}</div>
                <div className="text-xs text-[var(--vsm-grey)] mt-0.5">{t.desc}</div>
              </div>
              <Toggle checked={!!behavior[t.k]} onChange={(v) => setKey(t.k, v)} testid={`toggle-${t.k}`} />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Langue & Style" subtitle="Identité conversationnelle" testid="card-tone"
        action={<GoldButton onClick={save} testid="tone-save-btn">Sauver</GoldButton>}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Field label="Langue principale">
            <Select value={behavior.language || "fr"} onChange={(e) => setKey("language", e.target.value)} testid="lang-select">
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ln">Lingala</option>
            </Select>
          </Field>
          <Field label="Ton">
            <Select value={behavior.tone || "premium"} onChange={(e) => setKey("tone", e.target.value)} testid="tone-select">
              <option value="premium">Premium / éditorial</option>
              <option value="friendly">Chaleureux</option>
              <option value="formal">Formel</option>
              <option value="urban">Urbain / streetwear</option>
            </Select>
          </Field>
          <Field label="Longueur des réponses">
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
