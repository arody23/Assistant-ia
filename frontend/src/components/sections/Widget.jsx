import { Card, OutlineButton, Field, Input } from "@/components/Primitives";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function Widget({ config }) {
  const nodeUrl = process.env.REACT_APP_NODE_URL || "https://ton-bot.up.railway.app";
  const dashboardUrl = typeof window !== "undefined" ? window.location.origin : "https://assistant-iaa.vercel.app";

  const embedCode = `<!-- VSM Chat Widget -->
<script>
  window.VSM_CHAT = {
    apiUrl: "${nodeUrl}",
    brand: "${(config?.behavior?.brand_name || "VSM Collection").replace(/"/g, "")}"
  };
</script>
<script src="${dashboardUrl}/vsm-chat-widget.js" defer></script>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      toast.success("Code copié — colle avant </body> sur ton site");
    } catch {
      toast.error("Copie impossible");
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Widget chat site web" subtitle="À intégrer sur vsmcollection.com et ambassadeur.vsmcollection.com"
        action={<OutlineButton onClick={copy}><Copy size={12} className="mr-1" /> Copier le code</OutlineButton>}>
        <p className="text-sm text-[var(--vsm-cream)] leading-relaxed mb-4">
          Le widget utilise la même IA que WhatsApp. Les conversations web apparaissent dans <strong>Conversations</strong>
          (préfixe <code className="font-mono text-[var(--vsm-red)]">web:</code>).
        </p>

        <Field label="URL API (Railway)" hint="REACT_APP_NODE_URL — doit être accessible en HTTPS">
          <Input value={nodeUrl} readOnly className="font-mono text-xs" />
        </Field>

        <Field label="CORS Railway" hint="Ajoute tes domaines dans CORS_ORIGINS sur Railway" className="mt-4">
          <Input
            value="https://www.vsmcollection.com,https://ambassadeur.vsmcollection.com,https://assistant-iaa.vercel.app"
            readOnly
            className="font-mono text-xs"
          />
        </Field>

        <pre className="mt-4 p-4 bg-[var(--vsm-void)] border border-[var(--vsm-border)] text-[11px] font-mono text-[var(--vsm-cream)] overflow-x-auto whitespace-pre-wrap">
          {embedCode}
        </pre>
      </Card>

      <Card title="Test rapide" subtitle="Ouvre la console sur ton site après intégration">
        <div className="flex items-center gap-2 text-sm text-[var(--vsm-grey)]">
          <MessageCircle size={16} className="text-[var(--vsm-red)]" />
          Un bouton rouge apparaît en bas à droite. Clique pour chatter avec le bot.
        </div>
      </Card>
    </div>
  );
}
