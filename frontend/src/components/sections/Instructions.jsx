import { useState, useEffect } from "react";
import { Card, Textarea, RedButton, OutlineButton, Field, Input } from "@/components/Primitives";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_PROMPT = `Tu es l'assistant client officiel de VSM Collection, marque streetwear premium fabriquée en RDC.
Tu réponds aux clients sur WhatsApp et sur le site web.

TON : chaleureux, urbain, premium. Tutoiement. Réponses brèves (2-4 phrases).
Programme ambassadeur : candidatures sur https://ambassadeur.vsmcollection.com/apply
Kit ambassadeur : paiement en boutique physique uniquement.
RÈGLES :
- Note vocale → traite comme un message texte.
- Reste sur la marque VSM Collection.
- Mentionne "Made in DRC, Worn Worldwide" si pertinent.`;

const SNIPPETS = ["{MARQUE}", "{BOUTIQUE}", "{COLLECTIONS}", "[NOM_CLIENT]", "[PRODUIT]"];

export default function Instructions({ config, updateConfig }) {
  const [prompt, setPrompt] = useState(config.system_prompt || "");
  const [welcome, setWelcome] = useState(config.quick_replies?.welcome || "");
  const [brandName, setBrandName] = useState(config.behavior?.brand_name || "VSM Collection");
  const [shopUrl, setShopUrl] = useState(config.behavior?.shop_url || "https://www.vsmcollection.com");
  const [ambassadorUrl, setAmbassadorUrl] = useState(config.behavior?.ambassador_url || "https://ambassadeur.vsmcollection.com/apply");

  useEffect(() => {
    setPrompt(config.system_prompt || "");
    setWelcome(config.quick_replies?.welcome || "");
    setBrandName(config.behavior?.brand_name || "VSM Collection");
    setShopUrl(config.behavior?.shop_url || "https://www.vsmcollection.com");
    setAmbassadorUrl(config.behavior?.ambassador_url || "https://ambassadeur.vsmcollection.com/apply");
  }, [config]);

  const saveAll = () => updateConfig({
    system_prompt: prompt,
    quick_replies: { ...(config.quick_replies || {}), welcome },
    behavior: {
      ...(config.behavior || {}),
      brand_name: brandName,
      shop_url: shopUrl,
      ambassador_url: ambassadorUrl,
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
      <Card title="Prompt système principal" subtitle={`≈ ${tokens} tokens · Les sections métier sont dans « Mes sections »`}
        action={(
          <>
            <OutlineButton onClick={resetPrompt}><RotateCcw size={12} className="mr-1" /> Reset</OutlineButton>
            <RedButton onClick={saveAll}><Save size={12} className="mr-1" /> Sauver</RedButton>
          </>
        )}>
        <div className="flex flex-wrap gap-2 mb-3">
          {SNIPPETS.map((s) => (
            <button key={s} type="button" onClick={() => setPrompt((p) => p + " " + s)}
              className="px-2.5 py-1 border border-[var(--vsm-border-strong)] text-[11px] text-[var(--vsm-grey)] hover:text-[var(--vsm-red)] font-mono">
              {s}
            </button>
          ))}
        </div>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={14} className="font-mono text-xs" />
        <p className="text-[11px] text-[var(--vsm-grey)] mt-2">
          Langue, ton, capacités métier et blocs ambassadeur/kit → onglets Comportement et Mes sections.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Marque & URLs" action={<RedButton onClick={saveAll}>Sauver</RedButton>}>
          <Field label="Nom marque"><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} /></Field>
          <Field label="Boutique" className="mt-3"><Input value={shopUrl} onChange={(e) => setShopUrl(e.target.value)} /></Field>
          <Field label="Candidature ambassadeur" className="mt-3"><Input value={ambassadorUrl} onChange={(e) => setAmbassadorUrl(e.target.value)} /></Field>
        </Card>
        <Card title="Message de bienvenue" action={<RedButton onClick={saveAll}>Sauver</RedButton>}>
          <Textarea rows={5} value={welcome} onChange={(e) => setWelcome(e.target.value)} placeholder="Premier message du widget / accueil…" />
        </Card>
      </div>
    </div>
  );
}
