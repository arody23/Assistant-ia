import { useState, useEffect } from "react";
import { Card, Input, Select, GoldButton, Field } from "@/components/Primitives";
import { Save, Cpu, Mic } from "lucide-react";

const MODELS = [
  { v: "llama-3.1-8b-instant", l: "Llama 3.1 8B Instant (rapide)" },
  { v: "llama-3.3-70b-versatile", l: "Llama 3.3 70B Versatile (qualité)" },
  { v: "openai/gpt-oss-20b", l: "GPT-OSS 20B (Groq)" },
];

const WHISPER_MODELS = [
  { v: "whisper-large-v3", l: "Whisper Large v3 (recommandé)" },
  { v: "whisper-large-v3-turbo", l: "Whisper v3 Turbo (rapide)" },
];

export default function ConfigApi({ config, updateConfig }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    setForm({
      model: config.model,
      fallback_model: config.fallback_model,
      whisper_model: config.whisper_model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      delay_ms: config.delay_ms,
      memory_msgs: config.memory_msgs,
    });
  }, [config]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => updateConfig({
    model: form.model,
    fallback_model: form.fallback_model,
    whisper_model: form.whisper_model,
    max_tokens: Number(form.max_tokens),
    temperature: Number(form.temperature),
    delay_ms: Number(form.delay_ms),
    memory_msgs: Number(form.memory_msgs),
  });

  return (
    <div className="space-y-6">
      <Card title="Modèles Groq" subtitle="Sélection du moteur IA" testid="card-groq-models"
        action={<GoldButton onClick={save} testid="config-save-btn"><Save size={12} className="mr-1" /> Sauver</GoldButton>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Modèle principal" hint="Réponses rapides aux messages clients">
            <Select value={form.model || ""} onChange={(e) => set("model", e.target.value)} testid="model-selector-dropdown">
              {MODELS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </Select>
          </Field>
          <Field label="Modèle de fallback" hint="Utilisé si le principal échoue / cas complexes">
            <Select value={form.fallback_model || ""} onChange={(e) => set("fallback_model", e.target.value)} testid="fallback-model-selector">
              {MODELS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </Select>
          </Field>
          <Field label="Transcription vocale (Whisper)" hint="Notes vocales WhatsApp → texte">
            <Select value={form.whisper_model || ""} onChange={(e) => set("whisper_model", e.target.value)} testid="whisper-model-selector">
              {WHISPER_MODELS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </Select>
          </Field>
          <Field label="Clé API Groq" hint="Stockée côté serveur · GROQ_API_KEY">
            <Input value="••••••••••••" disabled testid="groq-key-input" />
          </Field>
        </div>
      </Card>

      <Card title="Limites & Quotas" subtitle="Contrôle de la conversation" testid="card-limits"
        action={<GoldButton onClick={save} testid="limits-save-btn">Sauver</GoldButton>}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Field label="Max tokens / réponse">
            <Input type="number" min={64} max={4096} value={form.max_tokens ?? 512} onChange={(e) => set("max_tokens", e.target.value)} testid="max-tokens-input" />
          </Field>
          <Field label="Température">
            <Input type="number" step="0.1" min={0} max={2} value={form.temperature ?? 0.4} onChange={(e) => set("temperature", e.target.value)} testid="temperature-input" />
          </Field>
          <Field label="Délai entre messages (ms)">
            <Input type="number" min={0} value={form.delay_ms ?? 800} onChange={(e) => set("delay_ms", e.target.value)} testid="delay-input" />
          </Field>
          <Field label="Mémoire (nb messages)">
            <Input type="number" min={0} max={50} value={form.memory_msgs ?? 8} onChange={(e) => set("memory_msgs", e.target.value)} testid="memory-input" />
          </Field>
        </div>
      </Card>

      <Card title="Endpoints" subtitle="URLs externes (informatives)" testid="card-endpoints">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Boutique">
            <Input value="https://www.vsmcollection.com" readOnly testid="shop-url-input" />
          </Field>
          <Field label="API Groq">
            <Input value="https://api.groq.com/openai/v1" readOnly testid="groq-endpoint-input" />
          </Field>
        </div>
        <div className="mt-5 flex items-center gap-3 text-xs text-[var(--vsm-grey)]">
          <Cpu size={14} className="text-[var(--vsm-gold)]" />
          Backend Node.js de référence dispo dans <span className="font-mono text-[var(--vsm-gold)]">/app/server-nodejs/</span>
          <span className="hidden md:inline-flex items-center gap-1"><Mic size={14} className="text-[var(--vsm-gold)]" />Whisper actif</span>
        </div>
      </Card>
    </div>
  );
}
