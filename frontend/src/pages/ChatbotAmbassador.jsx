import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Send, Image as ImageIcon, MessageCircle } from "lucide-react";

const NODE_URL = (process.env.REACT_APP_NODE_URL || "").replace(/\/$/, "");
const SESSION_KEY = "vsm_ambassador_session";

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `a_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}


export default function ChatbotAmbassador() {
  const [config, setConfig] = useState(null);
  const [assets, setAssets] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const sessionId = useRef(getSessionId());
  const bottomRef = useRef(null);
  const welcomed = useRef(false);

  useEffect(() => {
    if (!NODE_URL) return;
    fetch(`${NODE_URL}/api/webchat/ambassador/config`)
      .then((r) => r.json())
      .then((d) => {
        setConfig(d);
        setAssets(d.assets || []);
        if (!welcomed.current && d.welcome) {
          welcomed.current = true;
          setMessages([{ role: "bot", content: d.welcome, ts: Date.now() }]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text) => {
    const msg = text.trim();
    if (!msg || loading || !NODE_URL) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg, ts: Date.now() }]);
    setLoading(true);
    try {
      const r = await fetch(`${NODE_URL}/api/webchat/ambassador/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, message: msg }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erreur");
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          content: data.reply,
          images: data.images || [],
          ts: Date.now(),
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "bot", content: "Désolé, je ne suis pas disponible pour le moment. Réessaie dans un instant.", ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const applyUrl = config?.applyUrl || "https://ambassadeur.vsmcollection.com/apply";
  const brand = config?.brand || "VSM Collection";
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/chatbot` : "";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative z-10">
      {/* Sidebar programme */}
      <aside className="w-full lg:w-[320px] xl:w-[360px] shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--vsm-border)] bg-[var(--vsm-void)] flex flex-col max-h-[40vh] lg:max-h-none lg:h-screen">
        <div className="p-5 border-b border-[var(--vsm-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--vsm-red)] text-white font-display text-xl flex items-center justify-center">V</div>
            <div>
              <div className="font-display text-xl tracking-wider text-[var(--vsm-white)]">PROGRAMME AMBASSADEUR</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--vsm-grey)]">{brand}</div>
            </div>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <p className="text-sm text-[var(--vsm-cream)] leading-relaxed">
            {config?.sidebar_intro || "Découvre le programme ambassadeur VSM : représente la marque, gagne des avantages et rejoins la communauté Made in DRC."}
          </p>

          {assets.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--vsm-red)] mb-2 flex items-center gap-1">
                <ImageIcon size={12} /> Aperçus
              </div>
              <div className="grid grid-cols-2 gap-2">
                {assets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setPreview(a)}
                    className="border border-[var(--vsm-border)] hover:border-[var(--vsm-red)] overflow-hidden text-left transition-colors"
                  >
                    <img src={a.image_url} alt={a.title} className="w-full aspect-square object-cover" />
                    <div className="p-2 text-[10px] text-[var(--vsm-grey)] truncate">{a.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <a
            href={applyUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[var(--vsm-red)] text-white text-xs font-display uppercase tracking-wider hover:bg-[var(--vsm-red-hover)]"
          >
            Candidater maintenant <ExternalLink size={14} />
          </a>

          <div className="text-[10px] text-[var(--vsm-grey-2)] font-mono break-all">
            Lien à partager : {shareUrl}
          </div>
        </div>
      </aside>

      {/* Chat WhatsApp-like */}
      <main className="flex-1 flex flex-col min-h-0 h-[60vh] lg:h-screen bg-[var(--vsm-black)]">
        <header className="px-4 py-3 border-b border-[var(--vsm-border)] bg-[var(--vsm-surface)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--vsm-red)] flex items-center justify-center text-[var(--vsm-red)]">
            <MessageCircle size={20} />
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--vsm-white)]">Assistant Ambassadeur</div>
            <div className="text-[10px] text-[var(--vsm-green)]">● En ligne</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23222222\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] sm:max-w-[75%] px-3 py-2 text-sm border ${
                  m.role === "user"
                    ? "bg-[var(--vsm-red-soft)] border-[var(--vsm-red)] text-[var(--vsm-white)] rounded-tl-lg rounded-tr-lg rounded-bl-lg"
                    : "bg-[var(--vsm-surface)] border-[var(--vsm-border-strong)] text-[var(--vsm-cream)] rounded-tl-lg rounded-tr-lg rounded-br-lg"
                }`}
              >
                <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
                {m.images?.length > 0 && (
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {m.images.map((img, j) => (
                      <figure key={j}>
                        <img src={img.url} alt={img.caption || ""} className="max-w-full border border-[var(--vsm-border)]" />
                        {img.caption && <figcaption className="text-[10px] text-[var(--vsm-grey)] mt-1">{img.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                )}
                <div className="text-[9px] text-[var(--vsm-grey-2)] mt-1 text-right font-mono">
                  {new Date(m.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-2 bg-[var(--vsm-surface)] border border-[var(--vsm-border)] text-xs text-[var(--vsm-grey)] animate-pulse">
                en train d'écrire…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="p-3 border-t border-[var(--vsm-border)] bg-[var(--vsm-surface)] flex gap-2"
          onSubmit={(e) => { e.preventDefault(); send(input); }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pose ta question sur le programme ambassadeur…"
            className="flex-1 bg-[var(--vsm-void)] border border-[var(--vsm-border)] px-4 py-2.5 text-sm text-[var(--vsm-cream)] outline-none focus:border-[var(--vsm-red)]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 bg-[var(--vsm-red)] text-white disabled:opacity-40 hover:bg-[var(--vsm-red-hover)]"
          >
            <Send size={18} />
          </button>
        </form>

        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {["C'est quoi le programme ?", "Comment candidater ?", "Montre-moi un aperçu", "Le kit ambassadeur"].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="text-[10px] px-2 py-1 border border-[var(--vsm-border-strong)] text-[var(--vsm-grey)] hover:border-[var(--vsm-red)] hover:text-[var(--vsm-red)]"
            >
              {q}
            </button>
          ))}
        </div>
      </main>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="max-w-lg w-full bg-[var(--vsm-surface)] border border-[var(--vsm-red)] p-2" onClick={(e) => e.stopPropagation()}>
            <img src={preview.image_url} alt={preview.title} className="w-full" />
            <div className="p-3">
              <div className="font-display text-lg text-[var(--vsm-white)]">{preview.title}</div>
              {preview.caption && <p className="text-sm text-[var(--vsm-grey)] mt-1">{preview.caption}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
