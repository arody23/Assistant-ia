import { useState, useEffect } from "react";
import { Card, Toggle, Select, Field, RedButton, OutlineButton, Input } from "@/components/Primitives";
import { Plus, X } from "lucide-react";

const TOGGLES = [
  { k: "voice_reply", label: "Notes vocales", desc: "Transcrire et répondre aux audios WhatsApp" },
  { k: "order_via_whatsapp", label: "Commandes WhatsApp", desc: "L'IA peut prendre les commandes si le client ne peut pas commander sur le site" },
  { k: "image_reply", label: "Photos clients", desc: "Analyser les images (vision IA)" },
  { k: "send_product_images", label: "Envoi d'images produits", desc: "Le bot envoie les visuels VSM Collection" },
  { k: "auto_human_transfer", label: "Transfert humain auto", desc: "Si le bot ne sait pas, escalade à l'équipe" },
  { k: "anti_spam", label: "Anti-spam", desc: "Limite les messages répétitifs / abusifs" },
  { k: "remember_history", label: "Mémoire client", desc: "Le bot se souvient des échanges précédents" },
  { k: "night_mode", label: "Mode nuit", desc: "Réponses plus brèves entre 22h et 7h" },
  { k: "ignore_groups", label: "Ignorer les groupes", desc: "Pas de réponses dans les groupes WhatsApp" },
  { k: "auto_reconnect", label: "Reconnexion auto", desc: "Reconnecte si la session tombe" },
];

const DEFAULT_LANGS = [
  { code: "fr", label: "Français", enabled: true, reply_instruction: "Réponds en français." },
  { code: "en", label: "English", enabled: true, reply_instruction: "Reply in English." },
  { code: "ln", label: "Lingala", enabled: false, reply_instruction: "Yano na Lingala." },
];

export default function Comportement({ config, updateConfig }) {
  const [behavior, setBehavior] = useState(config.behavior || {});
  useEffect(() => { setBehavior(config.behavior || {}); }, [config]);

  const langs = behavior.languages?.length ? behavior.languages : DEFAULT_LANGS;

  const setKey = (k, v) => setBehavior({ ...behavior, [k]: v });
  const save = () => updateConfig({ behavior });

  const updateLang = (idx, patch) => {
    const next = [...langs];
    next[idx] = { ...next[idx], ...patch };
    setKey("languages", next);
  };

  const addLang = () => {
    setKey("languages", [...langs, { code: "sw", label: "Nouvelle langue", enabled: true, reply_instruction: "" }]);
  };

  const removeLang = (idx) => {
    setKey("languages", langs.filter((_, i) => i !== idx));
  };

  const customCaps = behavior.custom_capabilities || [];

  const addCapability = () => {
    setKey("custom_capabilities", [
      ...customCaps,
      { id: `cap_${Date.now()}`, label: "Nouvelle capacité", description: "", instruction: "", enabled: true },
    ]);
  };

  const updateCap = (idx, patch) => {
    const next = [...customCaps];
    next[idx] = { ...next[idx], ...patch };
    setKey("custom_capabilities", next);
  };

  const removeCap = (idx) => {
    setKey("custom_capabilities", customCaps.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card title="Capacités du bot" subtitle="Active / désactive chaque fonction"
        action={<RedButton onClick={save} testid="behavior-save-btn">Sauver</RedButton>} testid="card-toggles">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          {TOGGLES.map((t) => (
            <div key={t.k} className="flex items-start justify-between gap-4 py-3.5 border-b border-[var(--vsm-border)]">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--vsm-white)]">{t.label}</div>
                <div className="text-[11px] text-[var(--vsm-grey)] mt-0.5">{t.desc}</div>
              </div>
              <Toggle checked={behavior[t.k] !== false} onChange={(v) => setKey(t.k, v)} testid={`toggle-${t.k}`} />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Capacités métier (personnalisées)" subtitle="Ajoute tes propres règles — ex: programme ambassadeur, kit boutique"
        action={<RedButton onClick={save}>Sauver</RedButton>}>
        <p className="text-xs text-[var(--vsm-grey)] mb-4">
          Chaque capacité active ajoute une instruction au prompt du bot. Les capacités techniques ci-dessus restent gérées par les toggles.
        </p>
        <div className="space-y-3">
          {customCaps.map((cap, i) => (
            <div key={cap.id || i} className="border border-[var(--vsm-border)] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Toggle checked={cap.enabled !== false} onChange={(v) => updateCap(i, { enabled: v })} />
                <Input value={cap.label || ""} onChange={(e) => updateCap(i, { label: e.target.value })} placeholder="Nom" className="flex-1" />
                <OutlineButton onClick={() => removeCap(i)}><X size={12} /></OutlineButton>
              </div>
              <Input value={cap.description || ""} onChange={(e) => updateCap(i, { description: e.target.value })} placeholder="Description courte (dashboard)" />
              <Input value={cap.instruction || ""} onChange={(e) => updateCap(i, { instruction: e.target.value })} placeholder="Instruction pour l'IA (ex: orienter vers la boutique pour le kit)" />
            </div>
          ))}
        </div>
        <OutlineButton onClick={addCapability} className="mt-3"><Plus size={12} className="mr-1" /> Ajouter une capacité</OutlineButton>
      </Card>

      <Card title="Langues" subtitle="Plusieurs langues — le bot s'adapte au client"
        action={<RedButton onClick={save}>Sauver</RedButton>}>
        <div className="flex flex-wrap gap-4 mb-4">
          <Field label="Langue par défaut">
            <Select value={behavior.primary_language || behavior.language || "fr"}
              onChange={(e) => setKey("primary_language", e.target.value)}>
              {langs.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </Select>
          </Field>
          <div className="flex items-end gap-3 pb-1">
            <Toggle checked={behavior.auto_detect_language !== false}
              onChange={(v) => setKey("auto_detect_language", v)} />
            <span className="text-sm text-[var(--vsm-cream)]">Détection auto de la langue du client</span>
          </div>
        </div>

        <div className="space-y-3">
          {langs.map((l, i) => (
            <div key={`${l.code}-${i}`} className="grid grid-cols-1 md:grid-cols-[100px_1fr_1fr_auto_auto] gap-2 items-center border border-[var(--vsm-border)] p-3">
              <Input value={l.code} placeholder="code" onChange={(e) => updateLang(i, { code: e.target.value })} className="font-mono text-xs" />
              <Input value={l.label} placeholder="Nom affiché" onChange={(e) => updateLang(i, { label: e.target.value })} />
              <Input value={l.reply_instruction || ""} placeholder="Instruction (ex: Réponds en français)"
                onChange={(e) => updateLang(i, { reply_instruction: e.target.value })} />
              <Toggle checked={!!l.enabled} onChange={(v) => updateLang(i, { enabled: v })} />
              <OutlineButton onClick={() => removeLang(i)} disabled={langs.length <= 1}><X size={12} /></OutlineButton>
            </div>
          ))}
        </div>
        <OutlineButton onClick={addLang} className="mt-3"><Plus size={12} className="mr-1" /> Ajouter une langue</OutlineButton>
      </Card>

      <Card title="Style conversationnel" testid="card-tone" action={<RedButton onClick={save}>Sauver</RedButton>}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Ton">
            <Select value={behavior.tone || "premium"} onChange={(e) => setKey("tone", e.target.value)}>
              <option value="premium">Premium</option>
              <option value="friendly">Chaleureux</option>
              <option value="formal">Formel</option>
              <option value="urban">Urbain</option>
            </Select>
          </Field>
          <Field label="Longueur">
            <Select value={behavior.length || "medium"} onChange={(e) => setKey("length", e.target.value)}>
              <option value="short">Brèves</option>
              <option value="medium">Moyennes</option>
              <option value="long">Détaillées</option>
            </Select>
          </Field>
          <Field label="Emojis">
            <Select value={behavior.emoji || "minimal"} onChange={(e) => setKey("emoji", e.target.value)}>
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
