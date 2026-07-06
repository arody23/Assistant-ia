import { useState, useEffect } from "react";
import { Card, Toggle, Select, Field, RedButton, OutlineButton, Input, Textarea } from "@/components/Primitives";
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

const DEFAULT_PROMPTS = {
  vision: "Analyse les photos clients VSM. Collections en vente: {COLLECTIONS}.",
  discontinued: "Cette collection ({COLLECTION}) n'est plus commercialisée. Propose: {COLLECTIONS}.",
  not_in_catalog: "Ce visuel n'est pas dans notre catalogue. Oriente vers: {COLLECTIONS}.",
  night_mode: "Mode nuit: réponses courtes et directes.",
};

export default function Comportement({ config, updateConfig }) {
  const [behavior, setBehavior] = useState(config.behavior || {});
  const [productKeywords, setProductKeywords] = useState((config.product_keywords || []).join(", "));
  const [transferHuman, setTransferHuman] = useState(config.quick_replies?.transfer_human || "");
  const [outOfStock, setOutOfStock] = useState(config.quick_replies?.out_of_stock || "");

  useEffect(() => {
    setBehavior(config.behavior || {});
    setProductKeywords((config.product_keywords || []).join(", "));
    setTransferHuman(config.quick_replies?.transfer_human || "");
    setOutOfStock(config.quick_replies?.out_of_stock || "");
  }, [config]);

  const langs = behavior.languages?.length ? behavior.languages : DEFAULT_LANGS;
  const prompts = { ...DEFAULT_PROMPTS, ...(behavior.prompts || {}) };

  const setKey = (k, v) => setBehavior({ ...behavior, [k]: v });
  const setPrompt = (k, v) => setKey("prompts", { ...prompts, [k]: v });

  const save = () => updateConfig({
    behavior,
    product_keywords: productKeywords.split(",").map((s) => s.trim()).filter(Boolean),
    quick_replies: {
      ...(config.quick_replies || {}),
      transfer_human: transferHuman,
      out_of_stock: outOfStock,
    },
  });

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

      <Card title="Règles conversationnelles IA" subtitle="Source de vérité métier — le code n'injecte que la logique technique"
        action={<RedButton onClick={save}>Sauver</RedButton>}>
        <p className="text-xs text-[var(--vsm-grey)] mb-4">
          Ces blocs remplacent les règles codées en dur. Utilisez {"{TRANSFER_HUMAN}"} dans les règles strictes.
        </p>
        <div className="space-y-4">
          <Field label="Politique réponse (ton, longueur, interdictions)">
            <Textarea rows={5} value={behavior.conversation_rules || ""} onChange={(e) => setKey("conversation_rules", e.target.value)}
              placeholder="Ex: 1 à 3 phrases, ton conseiller VSM, jamais mentionner la base de données…" />
          </Field>
          <Field label="Règles anti-supposition">
            <Textarea rows={6} value={behavior.strict_rules || ""} onChange={(e) => setKey("strict_rules", e.target.value)}
              placeholder="Règles absolues : sources autorisées, interdictions d'invention…" />
          </Field>
          <Field label="Règles catalogue (stock, prix, collections)">
            <Textarea rows={4} value={behavior.catalog_rules || ""} onChange={(e) => setKey("catalog_rules", e.target.value)}
              placeholder="Ex: ne pas annoncer le stock avant taille + couleur…" />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Phrase transfert humain">
              <Input value={transferHuman} onChange={(e) => setTransferHuman(e.target.value)}
                placeholder="Je transfère ta demande à notre équipe…" />
            </Field>
            <Field label="Phrase rupture stock">
              <Input value={outOfStock} onChange={(e) => setOutOfStock(e.target.value)}
                placeholder="Cette pièce est en rupture…" />
            </Field>
          </div>
          <Field label="Mots-clés recherche catalogue" hint="Séparés par des virgules">
            <Input value={productKeywords} onChange={(e) => setProductKeywords(e.target.value)}
              placeholder="renescentia, classic of life, hoodie…" />
          </Field>
          <Field label="Collections archivées (non commercialisées)" hint="Séparées par des virgules">
            <Input
              value={(behavior.archived_collections || []).join(", ")}
              onChange={(e) => setKey("archived_collections", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="vie sur moi, écrit vie…"
            />
          </Field>
        </div>
      </Card>

      <Card title="Prompts vision & scénarios" subtitle="Vision image, collection discontinuée, hors catalogue"
        action={<RedButton onClick={save}>Sauver</RedButton>}>
        <div className="space-y-4">
          <Field label="Prompt vision ({COLLECTIONS})">
            <Textarea rows={3} value={prompts.vision || ""} onChange={(e) => setPrompt("vision", e.target.value)} />
          </Field>
          <Field label="Collection discontinuée ({COLLECTION}, {COLLECTIONS})">
            <Textarea rows={2} value={prompts.discontinued || ""} onChange={(e) => setPrompt("discontinued", e.target.value)} />
          </Field>
          <Field label="Hors catalogue ({COLLECTIONS})">
            <Textarea rows={2} value={prompts.not_in_catalog || ""} onChange={(e) => setPrompt("not_in_catalog", e.target.value)} />
          </Field>
          <Field label="Mode nuit">
            <Textarea rows={2} value={prompts.night_mode || ""} onChange={(e) => setPrompt("night_mode", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="Commandes WhatsApp" subtitle="Instructions pour la prise de commande via l'IA"
        action={<RedButton onClick={save}>Sauver</RedButton>}>
        <p className="text-xs text-[var(--vsm-grey)] mb-3">
          L'IA reçoit automatiquement le catalogue, les communes/frais de livraison et l'historique client (checkout).
        </p>
        <Textarea
          value={behavior.order_instructions || ""}
          onChange={(e) => setKey("order_instructions", e.target.value)}
          placeholder="Ex: Toujours demander la commune. Paiement à la livraison en FC."
          rows={5}
        />
      </Card>

      <Card title="Capacités métier (personnalisées)" subtitle="Règles additionnelles injectées au prompt"
        action={<RedButton onClick={save}>Sauver</RedButton>}>
        <div className="space-y-3">
          {customCaps.map((cap, i) => (
            <div key={cap.id || i} className="border border-[var(--vsm-border)] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Toggle checked={cap.enabled !== false} onChange={(v) => updateCap(i, { enabled: v })} />
                <Input value={cap.label || ""} onChange={(e) => updateCap(i, { label: e.target.value })} placeholder="Nom" className="flex-1" />
                <OutlineButton onClick={() => removeCap(i)}><X size={12} /></OutlineButton>
              </div>
              <Input value={cap.description || ""} onChange={(e) => updateCap(i, { description: e.target.value })} placeholder="Description courte" />
              <Input value={cap.instruction || ""} onChange={(e) => updateCap(i, { instruction: e.target.value })} placeholder="Instruction pour l'IA" />
            </div>
          ))}
        </div>
        <OutlineButton onClick={addCapability} className="mt-3"><Plus size={12} className="mr-1" /> Ajouter une capacité</OutlineButton>
      </Card>

      <Card title="Langues" action={<RedButton onClick={save}>Sauver</RedButton>}>
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
            <span className="text-sm text-[var(--vsm-cream)]">Détection auto de la langue</span>
          </div>
        </div>
        <div className="space-y-3">
          {langs.map((l, i) => (
            <div key={`${l.code}-${i}`} className="grid grid-cols-1 md:grid-cols-[100px_1fr_1fr_auto_auto] gap-2 items-center border border-[var(--vsm-border)] p-3">
              <Input value={l.code} placeholder="code" onChange={(e) => updateLang(i, { code: e.target.value })} className="font-mono text-xs" />
              <Input value={l.label} placeholder="Nom" onChange={(e) => updateLang(i, { label: e.target.value })} />
              <Input value={l.reply_instruction || ""} placeholder="Instruction langue"
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
            <Select value={behavior.length || "short"} onChange={(e) => setKey("length", e.target.value)}>
              <option value="short">Brèves (1-2 phrases)</option>
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
