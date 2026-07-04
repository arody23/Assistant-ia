import { useCallback, useEffect, useState } from "react";
import { Card, Textarea, RedButton, OutlineButton, Field, Input, Pill } from "@/components/Primitives";
import { Save, Upload, Trash2, Star, ExternalLink, Copy, BarChart3, Plus, ChevronUp, ChevronDown, X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const TABS = [
  { id: "config", label: "Prompt & lien" },
  { id: "media", label: "Médias IA" },
  { id: "stats", label: "Statistiques" },
  { id: "convos", label: "Conversations" },
];

const DEFAULT_PROMPT = `Tu es l'assistant du programme ambassadeur VSM Collection.
Tu réponds UNIQUEMENT aux questions sur le programme ambassadeur.
Candidature : {APPLY_URL}`;

function newPromptBlock() {
  return { id: `pb_${Date.now()}`, title: "Nouveau bloc", content: "" };
}

export default function ChatbotAdmin({ config, updateConfig }) {
  const [tab, setTab] = useState("config");
  const [chat, setChat] = useState({});
  const [assets, setAssets] = useState([]);
  const [assetEdits, setAssetEdits] = useState({});
  const [stats, setStats] = useState(null);
  const [convos, setConvos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMeta, setUploadMeta] = useState({ title: "", caption: "", keywords: "", description: "" });

  useEffect(() => {
    const ac = config.behavior?.ambassador_chat || {};
    setChat({
      prompt: ac.prompt || "",
      prompt_blocks: ac.prompt_blocks?.length ? ac.prompt_blocks : [],
      welcome: ac.welcome || "Salut ! Je suis l'assistant du programme ambassadeur VSM. Tu veux en savoir plus ou candidater ?",
      apply_url: ac.apply_url || config.behavior?.ambassador_url || "https://ambassadeur.vsmcollection.com/apply",
    });
  }, [config]);

  const loadAssets = useCallback(async () => {
    try {
      const list = await api.listAmbassadorAssets();
      setAssets(list);
      const edits = {};
      for (const a of list) {
        edits[a.id] = {
          title: a.title || "",
          caption: a.caption || "",
          keywords: (a.keywords || []).join(", "),
          description: a.description || "",
        };
      }
      setAssetEdits(edits);
    } catch (e) { toast.error(e.message); }
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
      await api.uploadAmbassadorAsset(file, {
        title: uploadMeta.title || file.name.replace(/\.[^.]+$/, ""),
        caption: uploadMeta.caption,
        keywords: uploadMeta.keywords,
        description: uploadMeta.description,
      });
      toast.success("Image ajoutée");
      setUploadMeta({ title: "", caption: "", keywords: "", description: "" });
      loadAssets();
    } catch (err) {
      toast.error(err.message || "Upload échoué");
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

  const moveAsset = async (idx, dir) => {
    const next = [...assets];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setAssets(next);
    try {
      await api.reorderAmbassadorAssets(next.map((a) => a.id));
    } catch (e) {
      toast.error(e.message);
      loadAssets();
    }
  };

  const saveAsset = async (id) => {
    const e = assetEdits[id];
    if (!e) return;
    try {
      await api.updateAmbassadorAsset(id, {
        title: e.title,
        caption: e.caption,
        keywords: e.keywords.split(",").map((s) => s.trim()).filter(Boolean),
        description: e.description,
      });
      toast.success("Média sauvegardé");
      loadAssets();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const updateAssetField = async (id, patch) => {
    try {
      await api.updateAmbassadorAsset(id, patch);
      loadAssets();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleStar = async (id, starred) => {
    await api.updateConversation(id, { starred: !starred });
    loadConvos();
  };

  const addPromptBlock = () => {
    setChat({ ...chat, prompt_blocks: [...(chat.prompt_blocks || []), newPromptBlock()] });
  };

  const updatePromptBlock = (idx, patch) => {
    const blocks = [...(chat.prompt_blocks || [])];
    blocks[idx] = { ...blocks[idx], ...patch };
    setChat({ ...chat, prompt_blocks: blocks });
  };

  const removePromptBlock = (idx) => {
    setChat({ ...chat, prompt_blocks: (chat.prompt_blocks || []).filter((_, i) => i !== idx) });
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
        <div className="space-y-4">
          <Card
            title="Blocs de prompt ambassadeur"
            subtitle="Découpe tes instructions en cases titrées — l'IA les lit mieux qu'un seul long texte"
            action={(
              <div className="flex gap-2">
                <OutlineButton onClick={addPromptBlock}><Plus size={12} className="mr-1" /> Bloc</OutlineButton>
                <RedButton onClick={saveConfig}><Save size={12} className="mr-1" /> Sauver</RedButton>
              </div>
            )}
          >
            <Field label="Introduction courte (optionnel)">
              <Textarea rows={3} value={chat.prompt || ""} onChange={(e) => setChat({ ...chat, prompt: e.target.value })} className="font-mono text-xs" placeholder={DEFAULT_PROMPT} />
            </Field>

            {(chat.prompt_blocks || []).map((block, idx) => (
              <div key={block.id || idx} className="mt-4 border border-[var(--vsm-border)] p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <Input
                    value={block.title || ""}
                    onChange={(e) => updatePromptBlock(idx, { title: e.target.value })}
                    placeholder="Titre du bloc (ex: Kit ambassadeur)"
                    className="flex-1"
                  />
                  <button type="button" onClick={() => removePromptBlock(idx)} className="text-[var(--vsm-grey)] hover:text-[var(--vsm-red)]">
                    <X size={14} />
                  </button>
                </div>
                <Textarea
                  rows={5}
                  value={block.content || ""}
                  onChange={(e) => updatePromptBlock(idx, { content: e.target.value })}
                  className="font-mono text-xs"
                  placeholder="Instructions précises pour ce sujet…"
                />
              </div>
            ))}

            {!chat.prompt_blocks?.length && (
              <p className="text-xs text-[var(--vsm-grey)] mt-3">Ajoute des blocs : Candidature, Kit, Commissions, Avantages…</p>
            )}
          </Card>

          <Card title="Accueil & lien candidature" action={<RedButton onClick={saveConfig}>Sauver</RedButton>}>
            <Field label="Message de bienvenue (chat)">
              <Textarea rows={3} value={chat.welcome || ""} onChange={(e) => setChat({ ...chat, welcome: e.target.value })} />
            </Field>
            <Field label="Lien candidature" className="mt-3">
              <Input value={chat.apply_url || ""} onChange={(e) => setChat({ ...chat, apply_url: e.target.value })} />
            </Field>
            <p className="text-[10px] text-[var(--vsm-grey)] mt-2">Variable globale : {"{APPLY_URL}"}</p>
          </Card>
        </div>
      )}

      {tab === "media" && (
        <Card
          title="Médias programme (base IA)"
          subtitle="Non affichés dans le chat public — envoyés seulement si le visiteur demande ou si l'IA juge pertinent"
          action={(
            <label className="inline-flex cursor-pointer items-center border border-[var(--vsm-border-strong)] px-3 py-1.5 text-xs uppercase tracking-wider text-[var(--vsm-cream)] hover:border-[var(--vsm-red)]">
              <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
              <Upload size={12} className="mr-1 inline" /> {uploading ? "…" : "Ajouter"}
            </label>
          )}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-3 border border-[var(--vsm-border)] bg-[var(--vsm-void)]">
            <Field label="Titre (pour l'IA)"><Input value={uploadMeta.title} onChange={(e) => setUploadMeta({ ...uploadMeta, title: e.target.value })} placeholder="ex: Dashboard commissions" /></Field>
            <Field label="Légende courte"><Input value={uploadMeta.caption} onChange={(e) => setUploadMeta({ ...uploadMeta, caption: e.target.value })} /></Field>
            <Field label="Mots-clés (virgules)"><Input value={uploadMeta.keywords} onChange={(e) => setUploadMeta({ ...uploadMeta, keywords: e.target.value })} placeholder="commission, suivi, dashboard" /></Field>
            <Field label="Quand envoyer ?"><Input value={uploadMeta.description} onChange={(e) => setUploadMeta({ ...uploadMeta, description: e.target.value })} placeholder="Si le client demande comment suivre ses commissions" /></Field>
          </div>

          {assets.length === 0 ? (
            <p className="text-sm text-[var(--vsm-grey)]">Aucune image — l'IA n'enverra rien tant qu'il n'y a pas de médias.</p>
          ) : (
            <div className="space-y-4">
              {assets.map((a, idx) => (
                <div key={a.id} className="flex flex-col sm:flex-row gap-3 border border-[var(--vsm-border)] p-3">
                  <img src={a.image_url} alt={a.title} className="w-full sm:w-28 h-28 object-cover shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <Input
                      value={assetEdits[a.id]?.title ?? ""}
                      onChange={(ev) => setAssetEdits({ ...assetEdits, [a.id]: { ...assetEdits[a.id], title: ev.target.value } })}
                      placeholder="Titre"
                    />
                    <Input
                      value={assetEdits[a.id]?.caption ?? ""}
                      onChange={(ev) => setAssetEdits({ ...assetEdits, [a.id]: { ...assetEdits[a.id], caption: ev.target.value } })}
                      placeholder="Légende"
                    />
                    <Input
                      value={assetEdits[a.id]?.keywords ?? ""}
                      onChange={(ev) => setAssetEdits({ ...assetEdits, [a.id]: { ...assetEdits[a.id], keywords: ev.target.value } })}
                      placeholder="Mots-clés (virgules)"
                    />
                    <Input
                      value={assetEdits[a.id]?.description ?? ""}
                      onChange={(ev) => setAssetEdits({ ...assetEdits, [a.id]: { ...assetEdits[a.id], description: ev.target.value } })}
                      placeholder="Quand l'IA doit envoyer cette image"
                    />
                    <RedButton onClick={() => saveAsset(a.id)}><Save size={12} className="mr-1" /> Sauver</RedButton>
                  </div>
                  <div className="flex sm:flex-col gap-1 shrink-0">
                    <OutlineButton onClick={() => moveAsset(idx, -1)} disabled={idx === 0}><ChevronUp size={12} /></OutlineButton>
                    <OutlineButton onClick={() => moveAsset(idx, 1)} disabled={idx === assets.length - 1}><ChevronDown size={12} /></OutlineButton>
                    <OutlineButton onClick={() => deleteAsset(a.id)}><Trash2 size={12} /></OutlineButton>
                  </div>
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
