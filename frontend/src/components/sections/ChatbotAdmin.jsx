import { useCallback, useEffect, useState } from "react";
import { Card, Textarea, RedButton, OutlineButton, Field, Input, Pill } from "@/components/Primitives";
import { Save, Upload, Trash2, Star, ExternalLink, Copy, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const TABS = [
  { id: "config", label: "Prompt & lien" },
  { id: "media", label: "Aperçus / captures" },
  { id: "stats", label: "Statistiques" },
  { id: "convos", label: "Conversations" },
];

const DEFAULT_PROMPT = `Tu es l'assistant du programme ambassadeur VSM Collection.
Tu réponds UNIQUEMENT aux questions sur le programme ambassadeur (candidature, kit, rôle, avantages).
Ne parle pas des produits boutique sauf si le client demande le kit.

Candidature : {APPLY_URL}
Le kit ambassadeur se paie en boutique physique.

Sois enthousiaste, clair et encourage à candidater quand le visiteur est intéressé.`;

export default function ChatbotAdmin({ config, updateConfig }) {
  const [tab, setTab] = useState("config");
  const [chat, setChat] = useState({});
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState(null);
  const [convos, setConvos] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const ac = config.behavior?.ambassador_chat || {};
    setChat({
      prompt: ac.prompt || DEFAULT_PROMPT,
      welcome: ac.welcome || "Salut ! Je suis l'assistant du programme ambassadeur VSM. Tu veux en savoir plus ou candidater ?",
      sidebar_intro: ac.sidebar_intro || "",
      apply_url: ac.apply_url || config.behavior?.ambassador_url || "https://ambassadeur.vsmcollection.com/apply",
    });
  }, [config]);

  const loadAssets = useCallback(async () => {
    try { setAssets(await api.listAmbassadorAssets()); } catch {}
  }, []);

  const loadStats = useCallback(async () => {
    try { setStats(await api.ambassadorStats()); } catch {}
  }, []);

  const loadConvos = useCallback(async () => {
    try { setConvos(await api.listAmbassadorConversations()); } catch {}
  }, []);

  useEffect(() => {
    if (tab === "media") loadAssets();
    if (tab === "stats") loadStats();
    if (tab === "convos") loadConvos();
  }, [tab, loadAssets, loadStats, loadConvos]);

  const saveConfig = () => updateConfig({
    behavior: {
      ...(config.behavior || {}),
      ambassador_url: chat.apply_url,
      ambassador_chat: chat,
    },
  });

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/chatbot` : "/chatbot";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Lien copié");
    } catch {
      toast.error("Copie impossible");
    }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const title = file.name.replace(/\.[^.]+$/, "");
      await api.uploadAmbassadorAsset(file, { title, caption: "" });
      toast.success("Image ajoutée");
      loadAssets();
    } catch (err) {
      toast.error(err.message || "Upload échoué — vérifie le bucket Supabase ambassador-media");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const deleteAsset = async (id) => {
    if (!window.confirm("Supprimer cette image ?")) return;
    await api.deleteAmbassadorAsset(id);
    loadAssets();
  };

  const toggleStar = async (id, starred) => {
    await api.updateConversation(id, { starred: !starred });
    loadConvos();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-wider border transition-colors ${
                tab === t.id
                  ? "border-[var(--vsm-red)] text-[var(--vsm-red)] bg-[var(--vsm-red-soft)]"
                  : "border-[var(--vsm-border)] text-[var(--vsm-grey)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <OutlineButton onClick={copyLink}><Copy size={12} className="mr-1" /> Lien /chatbot</OutlineButton>
          <a href={shareUrl} target="_blank" rel="noreferrer">
            <OutlineButton><ExternalLink size={12} className="mr-1" /> Ouvrir</OutlineButton>
          </a>
        </div>
      </div>

      {tab === "config" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card title="Prompt ambassadeur" action={<RedButton onClick={saveConfig}><Save size={12} className="mr-1" /> Sauver</RedButton>}>
            <Textarea rows={12} value={chat.prompt || ""} onChange={(e) => setChat({ ...chat, prompt: e.target.value })} className="font-mono text-xs" />
            <p className="text-[10px] text-[var(--vsm-grey)] mt-2">Variable : {"{APPLY_URL}"}</p>
          </Card>
          <div className="space-y-4">
            <Card title="Accueil & sidebar" action={<RedButton onClick={saveConfig}>Sauver</RedButton>}>
              <Field label="Message de bienvenue (chat)">
                <Textarea rows={3} value={chat.welcome || ""} onChange={(e) => setChat({ ...chat, welcome: e.target.value })} />
              </Field>
              <Field label="Texte sidebar (aperçu programme)" className="mt-3">
                <Textarea rows={3} value={chat.sidebar_intro || ""} onChange={(e) => setChat({ ...chat, sidebar_intro: e.target.value })} />
              </Field>
              <Field label="Lien candidature" className="mt-3">
                <Input value={chat.apply_url || ""} onChange={(e) => setChat({ ...chat, apply_url: e.target.value })} />
              </Field>
            </Card>
          </div>
        </div>
      )}

      {tab === "media" && (
        <Card title="Captures & aperçus programme" subtitle="Affichés dans la sidebar du chatbot public"
          action={(
            <label className="inline-flex cursor-pointer items-center border border-[var(--vsm-border-strong)] px-3 py-1.5 text-xs uppercase tracking-wider text-[var(--vsm-cream)] hover:border-[var(--vsm-red)]">
              <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
              <Upload size={12} className="mr-1 inline" /> {uploading ? "…" : "Ajouter"}
            </label>
          )}>
          <p className="text-xs text-[var(--vsm-grey)] mb-4">
            Bucket Supabase : <code className="text-[var(--vsm-red)]">ambassador-media</code> (public). Le bot peut aussi les envoyer dans le chat.
          </p>
          {assets.length === 0 ? (
            <p className="text-sm text-[var(--vsm-grey)]">Aucune image — ajoute des captures du programme.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {assets.map((a) => (
                <div key={a.id} className="border border-[var(--vsm-border)] group relative">
                  <img src={a.image_url} alt={a.title} className="w-full aspect-square object-cover" />
                  <div className="p-2 text-xs truncate">{a.title}</div>
                  <button type="button" onClick={() => deleteAsset(a.id)} className="absolute top-2 right-2 p-1 bg-black/70 text-white opacity-0 group-hover:opacity-100">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "stats" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Conversations" value={stats?.total ?? "—"} />
          <StatCard label="Engagées (≥3 msgs)" value={stats?.engaged ?? "—"} />
          <StatCard label="Taux d'engagement" value={stats?.engagement_rate != null ? `${stats.engagement_rate}%` : "—"} />
          <StatCard label="Taux d'intérêt" value={stats?.interest_rate != null ? `${stats.interest_rate}%` : "—"} icon={BarChart3} />
        </div>
      )}

      {tab === "convos" && (
        <Card title="Conversations ambassadeur" subtitle="Canal web · /chatbot">
          {convos.length === 0 ? (
            <p className="text-sm text-[var(--vsm-grey)]">Aucune conversation pour le moment.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {convos.map((c) => (
                <div key={c.id} className="flex items-start gap-3 p-3 border border-[var(--vsm-border)] hover:border-[var(--vsm-border-strong)]">
                  <button type="button" onClick={() => toggleStar(c.id, c.starred)} className={c.starred ? "text-[var(--vsm-red)]" : "text-[var(--vsm-grey)]"}>
                    <Star size={16} fill={c.starred ? "currentColor" : "none"} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--vsm-white)] truncate">{c.name || c.phone}</span>
                      {c.interest_score > 0 && <Pill tone="red">intérêt {c.interest_score}</Pill>}
                      {c.messages_count >= 3 && <Pill tone="green">engagé</Pill>}
                    </div>
                    <div className="text-xs text-[var(--vsm-grey)] truncate mt-0.5">{c.last_message}</div>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--vsm-grey-2)]">{c.messages_count || 0} msgs</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="bg-[var(--vsm-surface)] border border-[var(--vsm-border)] p-4">
      <div className="flex justify-between items-start">
        <div className="text-[10px] uppercase tracking-wider text-[var(--vsm-grey)]">{label}</div>
        {Icon && <Icon size={14} className="text-[var(--vsm-red)]" />}
      </div>
      <div className="font-display text-4xl text-[var(--vsm-white)] mt-2">{value}</div>
    </div>
  );
}
