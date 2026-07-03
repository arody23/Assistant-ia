import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Send } from "lucide-react";
import { getNodeUrl } from "@/lib/utils";

const NODE_URL = getNodeUrl();
const SESSION_KEY = "vsm_ambassador_session";

const STARTER_QUESTIONS = [
  "Comment devenir ambassadeur VSM ?",
  "Quels sont les avantages du programme ?",
  "Comment suivre mes commissions ?",
  "Comment partager mon lien ambassadeur ?",
];

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `a_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function ChatbotAmbassador() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showStarters, setShowStarters] = useState(true);
  const sessionId = useRef(getSessionId());
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, showStarters]);

  const send = useCallback(async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;
    if (!NODE_URL) {
      setMessages((m) => [
        ...m,
        { role: "bot", content: "Configuration manquante (REACT_APP_NODE_URL). Contacte l'administrateur.", ts: Date.now() },
      ]);
      return;
    }

    setShowStarters(false);
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
      if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          content: data.reply,
          images: data.images || [],
          ts: Date.now(),
        },
      ]);
    } catch (err) {
      console.error("[chatbot]", err);
      setMessages((m) => [
        ...m,
        { role: "bot", content: "Désolé, je ne suis pas disponible pour le moment. Réessaie dans un instant.", ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <div className="h-dvh flex flex-col bg-[var(--vsm-black)] text-[var(--vsm-cream)] overflow-hidden">
      <header className="shrink-0 px-4 py-4 sm:py-5 border-b border-[var(--vsm-border)] bg-[var(--vsm-void)] text-center">
        <h1 className="font-display text-lg sm:text-xl tracking-[0.15em] text-[var(--vsm-white)] uppercase">
          Programme Ambassadeur
        </h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 space-y-3">
        {showStarters && messages.length === 0 && (
          <div className="flex flex-col gap-2.5 max-w-lg mx-auto w-full pt-2">
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                disabled={loading}
                className="flex items-center gap-3 w-full text-left px-4 py-3.5 sm:py-4 rounded-xl bg-[var(--vsm-surface)] border border-[var(--vsm-border-strong)] text-sm sm:text-base text-[var(--vsm-white)] hover:border-[var(--vsm-red)] active:scale-[0.99] transition-all disabled:opacity-50"
              >
                <ChevronRight size={16} className="shrink-0 text-[var(--vsm-red)]" />
                <span className="leading-snug">{q}</span>
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[88%] sm:max-w-[75%] px-3.5 py-2.5 text-sm sm:text-[15px] border ${
                m.role === "user"
                  ? "bg-[var(--vsm-red-soft)] border-[var(--vsm-red)] text-[var(--vsm-white)] rounded-2xl rounded-br-sm"
                  : "bg-[var(--vsm-surface)] border-[var(--vsm-border-strong)] text-[var(--vsm-cream)] rounded-2xl rounded-bl-sm"
              }`}
            >
              <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
              {m.images?.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {m.images.map((img, j) => (
                    <figure key={j}>
                      <img src={img.url} alt={img.caption || ""} className="max-w-full rounded-lg border border-[var(--vsm-border)]" />
                      {img.caption && <figcaption className="text-[10px] text-[var(--vsm-grey)] mt-1">{img.caption}</figcaption>}
                    </figure>
                  ))}
                </div>
              )}
              <div className="text-[9px] text-[var(--vsm-grey-2)] mt-1.5 text-right font-mono">
                {new Date(m.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 bg-[var(--vsm-surface)] border border-[var(--vsm-border)] rounded-2xl rounded-bl-sm text-xs text-[var(--vsm-grey)] animate-pulse">
              en train d'écrire…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="shrink-0 p-3 sm:p-4 border-t border-[var(--vsm-red)] bg-[var(--vsm-void)] flex gap-2"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message…"
          className="flex-1 min-w-0 bg-[var(--vsm-black)] border border-[var(--vsm-border)] rounded-lg px-4 py-3 text-sm sm:text-base text-[var(--vsm-cream)] outline-none focus:border-[var(--vsm-red)]"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="shrink-0 px-4 py-3 rounded-lg bg-[var(--vsm-red)] text-white disabled:opacity-40 hover:bg-[var(--vsm-red-hover)] active:scale-95 transition-transform"
          aria-label="Envoyer"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
