import { useCallback, useEffect, useState } from "react";
import { Card, Field, Input, OutlineButton } from "@/components/Primitives";
import { Upload, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function MediaWhatsApp() {
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [meta, setMeta] = useState({ title: "", caption: "", keywords: "", description: "" });

  const load = useCallback(async () => {
    try {
      setAssets(await api.listWhatsappMedia());
    } catch (e) {
      toast.error(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadWhatsappMedia(file, {
        title: meta.title || file.name.replace(/\.[^.]+$/, ""),
        caption: meta.caption,
        keywords: meta.keywords,
        description: meta.description,
      });
      toast.success("Image ajoutée");
      setMeta({ title: "", caption: "", keywords: "", description: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const move = async (idx, dir) => {
    const next = [...assets];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setAssets(next);
    try {
      await api.reorderWhatsappMedia(next.map((a) => a.id));
    } catch (e) {
      toast.error(e.message);
      load();
    }
  };

  return (
    <Card
      title="Médias WhatsApp"
      subtitle="L'IA envoie ces visuels seulement si le client demande ou si le sujet correspond (mots-clés)"
      action={(
        <label className="inline-flex cursor-pointer items-center border border-[var(--vsm-border-strong)] px-3 py-1.5 text-xs uppercase tracking-wider text-[var(--vsm-cream)] hover:border-[var(--vsm-red)]">
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
          <Upload size={12} className="mr-1 inline" /> {uploading ? "…" : "Ajouter"}
        </label>
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-3 border border-[var(--vsm-border)] bg-[var(--vsm-void)]">
        <Field label="Titre"><Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="ex: Lookbook Renescentia" /></Field>
        <Field label="Légende"><Input value={meta.caption} onChange={(e) => setMeta({ ...meta, caption: e.target.value })} /></Field>
        <Field label="Mots-clés"><Input value={meta.keywords} onChange={(e) => setMeta({ ...meta, keywords: e.target.value })} placeholder="renescentia, hoodie, collection" /></Field>
        <Field label="Quand envoyer ?"><Input value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="Si le client demande à voir la collection" /></Field>
      </div>

      {assets.length === 0 ? (
        <p className="text-sm text-[var(--vsm-grey)]">Aucun média — le bot n'enverra que les images catalogue produit.</p>
      ) : (
        <div className="space-y-4">
          {assets.map((a, idx) => (
            <div key={a.id} className="flex flex-col sm:flex-row gap-3 border border-[var(--vsm-border)] p-3">
              <img src={a.image_url} alt={a.title} className="w-full sm:w-28 h-28 object-cover shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <Input defaultValue={a.title || ""} onBlur={(e) => api.updateWhatsappMedia(a.id, { title: e.target.value }).then(load)} />
                <Input defaultValue={a.caption || ""} onBlur={(e) => api.updateWhatsappMedia(a.id, { caption: e.target.value }).then(load)} />
                <Input
                  defaultValue={(a.keywords || []).join(", ")}
                  onBlur={(e) => api.updateWhatsappMedia(a.id, {
                    keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  }).then(load)}
                />
                <Input defaultValue={a.description || ""} onBlur={(e) => api.updateWhatsappMedia(a.id, { description: e.target.value }).then(load)} />
              </div>
              <div className="flex sm:flex-col gap-1 shrink-0">
                <OutlineButton onClick={() => move(idx, -1)} disabled={idx === 0}><ChevronUp size={12} /></OutlineButton>
                <OutlineButton onClick={() => move(idx, 1)} disabled={idx === assets.length - 1}><ChevronDown size={12} /></OutlineButton>
                <OutlineButton onClick={() => api.deleteWhatsappMedia(a.id).then(load)}><Trash2 size={12} /></OutlineButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
