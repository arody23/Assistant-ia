import { useState, useEffect } from "react";
import { Card, Textarea, RedButton, OutlineButton, Field, Input } from "@/components/Primitives";
import { X, Plus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

const SNIPPETS = ["{MARQUE}", "{BOUTIQUE}", "{COLLECTIONS}", "{COLLECTION}", "[NOM_CLIENT]", "[PRODUIT]", "[BOUTIQUE]", "[PRIX]"];

const DEFAULT_PROMPT = `Tu es l'assistant client officiel de VSM Collection, marque streetwear premium fabriquée en RDC.
Tu réponds aux clients sur WhatsApp.

TON : chaleureux, urbain, premium. Tutoiement. Réponses brèves (2-4 phrases).
RÈGLES :
- Note vocale → traite comme un message texte.
- Détail produit inconnu → lien boutique ou transfert humain.
- Reste sur la marque VSM Collection.
- Mentionne "Made in DRC, Worn Worldwide" si pertinent.`;

const DEFAULT_SPECIAL_PROMPTS = {
  vision: `Tu analyses les photos envoyées par les clients VSM Collection.
Identifie si c'est un produit VSM, le nom de collection, le texte sur le vêtement, les couleurs.
Collections actuellement en vente: {COLLECTIONS}.`,
  discontinued: `Cette collection ({COLLECTION}) n'est plus commercialisée / pas en stock. Propose nos collections disponibles: {COLLECTIONS}.`,
  not_in_catalog: `Ce visuel ne correspond pas à notre catalogue. Oriente vers: {COLLECTIONS}.`,
  night_mode: "Mode nuit: réponses plus courtes et directes.",
};

const TABS = [
  { id: "main", label: "Prompt principal" },
  { id: "special", label: "Prompts séparés" },
  { id: "replies", label: "Réponses rapides" },
  { id: "catalog", label: "Catalogue & marque" },
];

export default function Instructions({ config, updateConfig }) {
  const [tab, setTab] = useState("main");
  const [prompt, setPrompt] = useState(config.system_prompt || "");
  const [special, setSpecial] = useState({ ...DEFAULT_SPECIAL_PROMPTS, ...(config.behavior?.prompts || {}) });
  const [welcome, setWelcome] = useState(config.quick_replies?.welcome || "");
  const [outOfStock, setOutOfStock] = useState(config.quick_replies?.out_of_stock || "");
  const [transfer, setTransfer] = useState(config.quick_replies?.transfer_human || "");
  const [keywords, setKeywords] = useState(config.product_keywords || []);
  const [archived, setArchived] = useState(config.behavior?.archived_collections || ["vie sur moi", "écrit vie"]);
  const [brandName, setBrandName] = useState(config.behavior?.brand_name || "VSM Collection");
  const [shopUrl, setShopUrl] = useState(config.behavior?.shop_url || "https://www.vsmcollection.com");
  const [tagInput, setTagInput] = useState("");
  const [archInput, setArchInput] = useState("");

  useEffect(() => {
    setPrompt(config.system_prompt || "");
    setSpecial({ ...DEFAULT_SPECIAL_PROMPTS, ...(config.behavior?.prompts || {}) });
    setWelcome(config.quick_replies?.welcome || "");
    setOutOfStock(config.quick_replies?.out_of_stock || "");
    setTransfer(config.quick_replies?.transfer_human || "");
    setKeywords(config.product_keywords || []);
    setArchived(config.behavior?.archived_collections || ["vie sur moi", "écrit vie"]);
    setBrandName(config.behavior?.brand_name || "VSM Collection");
    setShopUrl(config.behavior?.shop_url || "https://www.vsmcollection.com");
  }, [config]);

  const addTag = (list, setList, input, setInput) => {
    const v = input.trim().toLowerCase();
    if (!v || list.includes(v)) { setInput(""); return; }
    setList([...list, v]); setInput("");
  };

  const savePrompt = () => updateConfig({ system_prompt: prompt });

  const saveSpecial = () => updateConfig({
    behavior: { ...(config.behavior || {}), prompts: special },
  });

  const saveReplies = () => updateConfig({
    quick_replies: { welcome, out_of_stock: outOfStock, transfer_human: transfer },
  });

  const saveCatalog = () => updateConfig({
    product_keywords: keywords,
    behavior: {
      ...(config.behavior || {}),
      archived_collections: archived,
      brand_name: brandName,
      shop_url: shopUrl,
    },
  });

  const resetPrompt = () => {
    if (window.confirm("Réinitialiser le prompt principal ?")) {
      setPrompt(DEFAULT_PROMPT);
      toast.info("Prompt réinitialisé — sauvegarde pour appliquer");
    }
  };

  const tokens = Math.round((prompt.length || 0) / 4);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-[11px] uppercase tracking-wider border transition-colors ${
              tab === t.id
                ? "border-[var(--vsm-red)] text-[var(--vsm-red)] bg-[var(--vsm-red-soft)]"
                : "border-[var(--vsm-border)] text-[var(--vsm-grey)] hover:border-[var(--vsm-border-strong)]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "main" && (
        <Card title="Prompt système" subtitle={`≈ ${tokens} tokens`} testid="card-prompt"
          action={(
            <>
              <OutlineButton onClick={resetPrompt} testid="prompt-reset-btn"><RotateCcw size={12} className="mr-1" /> Reset</OutlineButton>
              <RedButton onClick={savePrompt} testid="prompt-save-btn"><Save size={12} className="mr-1" /> Sauver</RedButton>
            </>
          )}>
          <div className="flex flex-wrap gap-2 mb-3">
            {SNIPPETS.map((s) => (
              <button key={s} onClick={() => setPrompt((p) => p + " " + s)}
                className="px-2.5 py-1 border border-[var(--vsm-border-strong)] text-[11px] text-[var(--vsm-grey)] hover:text-[var(--vsm-red)] font-mono">
                {s}
              </button>
            ))}
          </div>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={16} className="font-mono text-xs" testid="prompt-editor" />
          <p className="text-[11px] text-[var(--vsm-grey)] mt-2">Langue, ton et longueur sont ajoutés automatiquement depuis Comportement.</p>
        </Card>
      )}

      {tab === "special" && (
        <Card title="Prompts séparés" subtitle="Vision, anciennes collections, mode nuit…"
          action={<RedButton onClick={saveSpecial}><Save size={12} className="mr-1" /> Sauver</RedButton>}>
          <div className="space-y-4">
            <Field label="Analyse d'images (vision IA)">
              <Textarea rows={5} value={special.vision || ""} onChange={(e) => setSpecial({ ...special, vision: e.target.value })} className="font-mono text-xs" />
            </Field>
            <Field label="Collection archivée / plus en stock">
              <Textarea rows={3} value={special.discontinued || ""} onChange={(e) => setSpecial({ ...special, discontinued: e.target.value })} className="font-mono text-xs" />
            </Field>
            <Field label="Hors catalogue VSM">
              <Textarea rows={3} value={special.not_in_catalog || ""} onChange={(e) => setSpecial({ ...special, not_in_catalog: e.target.value })} className="font-mono text-xs" />
            </Field>
            <Field label="Mode nuit (22h–7h)">
              <Textarea rows={2} value={special.night_mode || ""} onChange={(e) => setSpecial({ ...special, night_mode: e.target.value })} className="font-mono text-xs" />
            </Field>
          </div>
          <p className="text-[11px] text-[var(--vsm-grey)] mt-3">Variables: {"{COLLECTIONS}"}, {"{COLLECTION}"}, {"{MARQUE}"}, {"{BOUTIQUE}"}</p>
        </Card>
      )}

      {tab === "replies" && (
        <Card title="Réponses rapides" testid="card-quick-replies"
          action={<RedButton onClick={saveReplies} testid="replies-save-btn"><Save size={12} className="mr-1" /> Sauver</RedButton>}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Message de bienvenue"><Textarea rows={4} value={welcome} onChange={(e) => setWelcome(e.target.value)} testid="reply-welcome" /></Field>
            <Field label="Rupture de stock"><Textarea rows={4} value={outOfStock} onChange={(e) => setOutOfStock(e.target.value)} testid="reply-stock" /></Field>
            <Field label="Transfert humain"><Textarea rows={4} value={transfer} onChange={(e) => setTransfer(e.target.value)} testid="reply-transfer" /></Field>
          </div>
        </Card>
      )}

      {tab === "catalog" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card title="Mots-clés produits" action={<RedButton onClick={saveCatalog}>Sauver</RedButton>}>
            <div className="flex flex-wrap gap-2 mb-3 min-h-[60px] border border-[var(--vsm-border)] p-3">
              {keywords.map((k) => (
                <span key={k} className="flex items-center gap-1 px-2 py-1 bg-[var(--vsm-red-soft)] border border-[var(--vsm-red)] text-[var(--vsm-red)] text-xs font-mono">
                  {k}
                  <button onClick={() => setKeywords(keywords.filter((x) => x !== k))}><X size={11} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Nouveau mot-clé…" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(keywords, setKeywords, tagInput, setTagInput); } }} />
              <OutlineButton onClick={() => addTag(keywords, setKeywords, tagInput, setTagInput)}><Plus size={12} /></OutlineButton>
            </div>
          </Card>

          <Card title="Collections archivées" subtitle="Plus commercialisées — détection par texte">
            <div className="flex flex-wrap gap-2 mb-3 min-h-[60px] border border-[var(--vsm-border)] p-3">
              {archived.map((k) => (
                <span key={k} className="flex items-center gap-1 px-2 py-1 border border-[var(--vsm-border-strong)] text-xs font-mono">
                  {k}
                  <button onClick={() => setArchived(archived.filter((x) => x !== k))}><X size={11} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <Input placeholder="ex: vie sur moi" value={archInput} onChange={(e) => setArchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(archived, setArchived, archInput, setArchInput); } }} />
              <OutlineButton onClick={() => addTag(archived, setArchived, archInput, setArchInput)}><Plus size={12} /></OutlineButton>
            </div>
            <Field label="Nom de la marque"><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} /></Field>
            <Field label="URL boutique" className="mt-3"><Input value={shopUrl} onChange={(e) => setShopUrl(e.target.value)} /></Field>
          </Card>
        </div>
      )}
    </div>
  );
}
