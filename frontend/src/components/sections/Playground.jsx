import { useState, useRef } from "react";
import { Card, Input, RedButton, OutlineButton, Pill } from "@/components/Primitives";
import axios from "axios";
import { Send, Mic, Square, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Playground({ config }) {
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
    setHistory((h) => [...h, { role: "user", content: text }]);
    setInput(""); setLoading(true);
    try {
      const { data } = await axios.post(`${API}/playground/chat`, {
        message: text, history: history.slice(-8), config,
      });
      setHistory((h) => [...h, { role: "assistant", content: data.reply, model: data.model, elapsed_ms: data.elapsed_ms }]);
    } catch (e) {
      toast.error("Erreur Groq : " + (e?.response?.data?.detail || e.message));
    } finally { setLoading(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "voice.webm", { type: "audio/webm" });
        await transcribeAndSend(file);
      };
      mr.start(); setRecording(true);
    } catch (e) { toast.error("Micro inaccessible : " + e.message); }
  };
  const stopRecording = () => { recorderRef.current?.stop(); setRecording(false); };

  const transcribeAndSend = async (file) => {
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("audio", file);
      fd.append("whisper_model", config?.whisper_model || "whisper-large-v3");
      const { data } = await axios.post(`${API}/playground/transcribe`, fd);
      if (data.text) {
        toast.success("Transcription : " + data.text.slice(0, 60));
        await sendMessage(data.text);
      } else { toast("Audio non transcrit"); }
    } catch (e) {
      toast.error("Whisper a échoué : " + (e?.response?.data?.detail || e.message));
    } finally { setTranscribing(false); }
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) transcribeAndSend(f);
    e.target.value = "";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-6">
      <Card title="Test du prompt" subtitle="Tchat éphémère · Groq direct, rien n'est sauvegardé" testid="card-playground">
        <div className="bg-[var(--vsm-void)] border border-[var(--vsm-border)] p-3 sm:p-4 h-[50vh] sm:h-[55vh] overflow-y-auto flex flex-col gap-3">
          {history.length === 0 && (
            <div className="m-auto text-center text-[var(--vsm-grey)] text-[11px] uppercase tracking-[0.18em]">
              Tape un message ou enregistre une note vocale
            </div>
          )}
          {history.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`play-msg-${i}`}>
              <div className={`max-w-[85%] px-3 py-2 border ${
                m.role === "user"
                  ? "bg-[var(--vsm-red)] text-[var(--vsm-white)] border-[var(--vsm-red)]"
                  : "bg-[var(--vsm-surface)] text-[var(--vsm-cream)] border-[var(--vsm-border-strong)]"
              }`}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.content}</div>
                {m.role === "assistant" && (
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--vsm-grey)] font-mono uppercase">
                    <Pill tone="red">{m.model}</Pill> · {m.elapsed_ms}ms
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

        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <Input placeholder="Tape un message client…" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input); }}
            testid="test-chat-input" />
          <RedButton onClick={() => sendMessage(input)} disabled={loading || !input.trim()} testid="send-message-btn">
            <Send size={14} className="mr-2" /> Envoyer
          </RedButton>
        </div>
      </Card>

      <Card title="Note vocale" subtitle="Whisper Large v3" testid="card-voice">
        <div className="flex flex-col items-center text-center py-4 sm:py-6 gap-4">
          <button onClick={recording ? stopRecording : startRecording} disabled={transcribing}
            data-testid="voice-record-btn"
            className={`w-24 h-24 flex items-center justify-center border-2 transition-all ${
              recording ? "border-[var(--vsm-red)] bg-[var(--vsm-red)]/10 pulse-red"
                : "border-[var(--vsm-red)] bg-[var(--vsm-red-soft)] hover:bg-[var(--vsm-red)]/20"
            }`}>
            {recording ? <Square size={28} className="text-[var(--vsm-red)]" /> : <Mic size={28} className="text-[var(--vsm-red)]" />}
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
