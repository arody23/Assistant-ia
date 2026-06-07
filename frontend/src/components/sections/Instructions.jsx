import { useState, useEffect } from "react";
import { Card, Textarea, RedButton, OutlineButton, Field, Input } from "@/components/Primitives";
import { X, Plus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

const SNIPPETS = ["[NOM_CLIENT]", "[PRODUIT]", "[BOUTIQUE]", "[PRIX]"];

const DEFAULT_PROMPT = `Tu es l'assistant client officiel de VSM Collection, marque streetwear premium fabriquée en RDC.
Tu réponds aux clients sur WhatsApp.

TON : chaleureux, urbain, premium. Tutoiement. Réponses brèves (2-4 phrases).
RÈGLES :
- Note vocale → traite comme un message texte.
- Détail produit inconnu → lien boutique ou transfert humain.
- Reste sur la marque VSM Collection.
- Mentionne "Made in DRC, Worn Worldwide" si pertinent.`;

export default function Instructions({ config, updateConfig }) {
  const [prompt, setPrompt] = useState(config.system_prompt || "");
  const [welcome, setWelcome] = useState(config.quick_replies?.welcome || "");
  const [outOfStock, setOutOfStock] = useState(config.quick_replies?.out_of_stock || "");
  const [transfer, setTransfer] = useState(config.quick_replies?.transfer_human || "");
  const [keywords, setKeywords] = useState(config.product_keywords || []);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setPrompt(config.system_prompt || "");
    setWelcome(config.quick_replies?.welcome || "");
    setOutOfStock(config.quick_replies?.out_of_stock || "");
    setTransfer(config.quick_replies?.transfer_human || "");
    setKeywords(config.product_keywords || []);
  }, [config]);

  const addTag = () => {
    const v = tagInput.trim().toLowerCase();
    if (!v || keywords.includes(v)) { setTagInput(""); return; }
    setKeywords([...keywords, v]); setTagInput("");
  };

  const savePrompt = () => updateConfig({ system_prompt: prompt });
  const saveReplies = () => updateConfig({
    quick_replies: { welcome, out_of_stock: outOfStock, transfer_human: transfer },
  });
  const saveKeywords = () => updateConfig({ product_keywords: keywords });

  const resetPrompt = () => {
    if (window.confirm("Réinitialiser le prompt système ?")) {
      setPrompt(DEFAULT_PROMPT);
      toast.info("Prompt réinitialisé · n'oublie pas de sauvegarder");
    }
  };

  const tokens = Math.round((prompt.length || 0) / 4);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
      <Card title="Prompt système" subtitle={`≈ ${tokens} tokens`} className="xl:col-span-2" testid="card-prompt"
        action={(
          <>
            <OutlineButton onClick={resetPrompt} testid="prompt-reset-btn"><RotateCcw size={12} className="mr-1" /> Reset</OutlineButton>
            <RedButton onClick={savePrompt} testid="prompt-save-btn"><Save size={12} className="mr-1" /> Sauver</RedButton>
          </>
        )}>
        <div className="flex flex-wrap gap-2 mb-3">
          {SNIPPETS.map((s) => (
            <button key={s} onClick={() => setPrompt((p) => p + " " + s)} data-testid={`snippet-${s}`}
              className="px-2.5 py-1 border border-[var(--vsm-border-strong)] text-[11px] text-[var(--vsm-grey)] hover:text-[var(--vsm-red)] hover:border-[var(--vsm-red)] transition-colors font-mono">
              {s}
            </button>
          ))}
        </div>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={16} className="font-mono text-xs" testid="prompt-editor" />
      </Card>

      <Card title="Mots-clés produits" subtitle="Tags détectés par le bot" testid="card-keywords"
        action={<RedButton onClick={saveKeywords} testid="keywords-save-btn">Sauver</RedButton>}>
        <div className="flex flex-wrap gap-2 mb-3 min-h-[80px] border border-[var(--vsm-border)] p-3">
          {keywords.map((k) => (
            <span key={k} className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--vsm-red-soft)] border border-[var(--vsm-red)] text-[var(--vsm-red)] text-xs font-mono uppercase tracking-wider">
              {k}
              <button onClick={() => setKeywords(keywords.filter(x => x !== k))} data-testid={`kw-del-${k}`} className="hover:text-[var(--vsm-white)]">
                <X size={11} />
              </button>
            </span>
          ))}
          {keywords.length === 0 && <span className="text-xs text-[var(--vsm-grey-2)]">Aucun mot-clé.</span>}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Nouveau mot-clé…" value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            testid="kw-input" />
          <OutlineButton onClick={addTag} testid="kw-add-btn"><Plus size={12} /></OutlineButton>
        </div>
      </Card>

      <Card title="Réponses rapides" className="xl:col-span-3" testid="card-quick-replies"
        action={<RedButton onClick={saveReplies} testid="replies-save-btn"><Save size={12} className="mr-1" /> Sauver</RedButton>}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          <Field label="Message de bienvenue">
            <Textarea rows={4} value={welcome} onChange={(e) => setWelcome(e.target.value)} testid="reply-welcome" />
          </Field>
          <Field label="Rupture de stock">
            <Textarea rows={4} value={outOfStock} onChange={(e) => setOutOfStock(e.target.value)} testid="reply-stock" />
          </Field>
          <Field label="Transfert humain">
            <Textarea rows={4} value={transfer} onChange={(e) => setTransfer(e.target.value)} testid="reply-transfer" />
          </Field>
        </div>
      </Card>
    </div>
  );
}
