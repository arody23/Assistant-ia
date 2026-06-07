import { useState, useRef } from "react";
import { Card, Input, GoldButton, OutlineButton, Pill } from "@/components/Primitives";
import { api } from "@/lib/api";
import { Send, Mic, Square, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Playground() {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", content: text };
    setHistory((h) => [...h, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const data = await api.chat({ message: text, history: history.slice(-8) });
      setHistory((h) => [...h, { role: "assistant", content: data.reply, model: data.model, elapsed_ms: data.elapsed_ms }]);
    } catch (e) {
      toast.error("Erreur Groq : " + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "voice.webm", { type: "audio/webm" });
        await transcribeAndMaybeSend(file);
      };
      mr.start();
      setRecording(true);
    } catch (e) {
      toast.error("Micro inaccessible : " + e.message);
    }
  };
  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const transcribeAndMaybeSend = async (file) => {
    setTranscribing(true);
    try {
      const { text } = await api.transcribe(file);
      if (text) {
        toast.success("Transcription : " + text.slice(0, 60));
        await sendMessage(text);
      } else {
        toast("Audio non transcrit");
      }
    } catch (e) {
      toast.error("Whisper a échoué : " + (e?.response?.data?.detail || e.message));
    } finally {
      setTranscribing(false);
    }
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) transcribeAndMaybeSend(f);
    e.target.value = "";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <Card title="Test du bot" subtitle="Discussion en direct avec Groq" testid="card-playground">
        <div className="bg-[var(--vsm-void)] border border-[var(--vsm-border)] p-4 h-[55vh] overflow-y-auto flex flex-col gap-3">
          {history.length === 0 && (
            <div className="m-auto text-center text-[var(--vsm-grey)] text-xs uppercase tracking-[0.18em]">
              Envoie un message ou une note vocale pour démarrer
            </div>
          )}
          {history.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`play-msg-${i}`}>
              <div className={`max-w-[80%] px-3.5 py-2.5 border ${
                m.role === "user"
                  ? "bg-[var(--vsm-gold)] text-[var(--vsm-black)] border-[var(--vsm-gold)]"
                  : "bg-[var(--vsm-surface)] text-[var(--vsm-cream)] border-[var(--vsm-border-strong)]"
              }`}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
                {m.role === "assistant" && (
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--vsm-grey)] font-mono uppercase">
                    <Pill tone="gold">{m.model}</Pill> · {m.elapsed_ms}ms
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-[var(--vsm-grey)] text-xs">
              <Loader2 size={14} className="animate-spin" /> Le bot rédige…
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Tape un message client…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input); }}
            className="flex-1"
            testid="test-chat-input"
          />
          <GoldButton onClick={() => sendMessage(input)} disabled={loading || !input.trim()} testid="send-message-btn">
            <Send size={14} className="mr-2" /> Envoyer
          </GoldButton>
        </div>
      </Card>

      <Card title="Note vocale" subtitle="Whisper Large v3" testid="card-voice">
        <div className="flex flex-col items-center text-center py-6 gap-4">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
            className={`w-24 h-24 flex items-center justify-center border-2 transition-all ${
              recording
                ? "border-[var(--vsm-red)] bg-[var(--vsm-red)]/10 pulse-gold"
                : "border-[var(--vsm-gold)] bg-[var(--vsm-gold-soft)] hover:bg-[var(--vsm-gold)]/20"
            }`}
            data-testid="voice-record-btn"
          >
            {recording ? <Square size={28} className="text-[var(--vsm-red)]" /> : <Mic size={28} className="text-[var(--vsm-gold)]" />}
          </button>
          <div className="text-xs text-[var(--vsm-grey)] uppercase tracking-widest">
            {transcribing ? "Transcription…" : recording ? "Enregistrement" : "Cliquer pour enregistrer"}
          </div>
          <div className="text-[var(--vsm-grey-2)] text-xs">— ou —</div>
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={onPickFile} className="hidden" data-testid="voice-upload-input" />
          <OutlineButton onClick={() => fileInputRef.current?.click()} testid="voice-upload-btn">
            <Upload size={12} className="mr-1" /> Importer un audio
          </OutlineButton>
        </div>
      </Card>
    </div>
  );
}
