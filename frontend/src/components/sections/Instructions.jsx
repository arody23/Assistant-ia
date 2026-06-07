import { useState, useEffect } from "react";
import { Card, Textarea, GoldButton, OutlineButton, Field, Input } from "@/components/Primitives";
import { X, Plus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

const SNIPPETS = [
  { key: "[NOM_CLIENT]", label: "Nom client" },
  { key: "[PRODUIT]", label: "Produit" },
  { key: "[BOUTIQUE]", label: "Boutique" },
  { key: "[PRIX]", label: "Prix" },
];

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

  const insertSnippet = (s) => setPrompt((p) => p + " " + s);
  const addTag = () => {
    const v = tagInput.trim().toLowerCase();
    if (!v || keywords.includes(v)) { setTagInput(""); return; }
    setKeywords([...keywords, v]);
    setTagInput("");
  };

  const savePrompt = () => updateConfig({ system_prompt: prompt });
  const saveReplies = () => updateConfig({
    quick_replies: { welcome, out_of_stock: outOfStock, transfer_human: transfer },
  });
  const saveKeywords = () => updateConfig({ product_keywords: keywords });

  const resetPrompt = () => {
    if (window.confirm("Réinitialiser le prompt système ?")) {
      const def = "Tu es l'assistant client officiel de VSM Collection…";
      setPrompt(def);
      toast.info("Prompt réinitialisé (n'oublie pas de sauvegarder)");
    }
  };

  const tokens = Math.round((prompt.length || 0) / 4);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card
        title="Prompt système"
        subtitle={`≈ ${tokens} tokens`}
        className="xl:col-span-2"
        testid="card-prompt"
        action={(
          <div className="flex gap-2">
            <OutlineButton onClick={resetPrompt} testid="prompt-reset-btn"><RotateCcw size={12} className="mr-1" /> Reset</OutlineButton>
            <GoldButton onClick={savePrompt} testid="prompt-save-btn"><Save size={12} className="mr-1" /> Sauver</GoldButton>
          </div>
        )}
      >
        <div className="flex flex-wrap gap-2 mb-3">
          {SNIPPETS.map((s) => (
            <button
              key={s.key}
              onClick={() => insertSnippet(s.key)}
              className="px-2.5 py-1 border border-[var(--vsm-border-strong)] text-xs text-[var(--vsm-grey)] hover:text-[var(--vsm-gold)] hover:border-[var(--vsm-gold)] transition-colors font-mono"
              data-testid={`snippet-${s.key}`}
            >
              {s.key}
            </button>
          ))}
        </div>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={18}
          className="w-full font-mono text-xs"
          testid="prompt-editor"
        />
      </Card>

      <Card title="Mots-clés produits" subtitle="Le bot détecte ces tags" testid="card-keywords" action={(
        <GoldButton onClick={saveKeywords} testid="keywords-save-btn">Sauver</GoldButton>
      )}>
        <div className="flex flex-wrap gap-2 mb-3 min-h-[80px] border border-[var(--vsm-border)] p-3">
          {keywords.map((k) => (
            <span key={k} className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--vsm-gold-soft)] border border-[var(--vsm-gold)] text-[var(--vsm-gold)] text-xs font-mono uppercase tracking-wider">
              {k}
              <button onClick={() => setKeywords(keywords.filter(x => x !== k))} data-testid={`kw-del-${k}`} className="hover:text-[var(--vsm-red)]">
                <X size={11} />
              </button>
            </span>
          ))}
          {keywords.length === 0 && <span className="text-xs text-[var(--vsm-grey-2)]">Aucun mot-clé.</span>}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Nouveau mot-clé…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            className="flex-1"
            testid="kw-input"
          />
          <OutlineButton onClick={addTag} testid="kw-add-btn"><Plus size={12} /></OutlineButton>
        </div>
      </Card>

      <Card title="Réponses rapides" className="xl:col-span-3" testid="card-quick-replies" action={(
        <GoldButton onClick={saveReplies} testid="replies-save-btn"><Save size={12} className="mr-1" /> Sauver</GoldButton>
      )}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
