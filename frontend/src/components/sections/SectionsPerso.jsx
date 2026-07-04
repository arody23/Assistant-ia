import { useState, useEffect } from "react";
import { Card, Textarea, RedButton, OutlineButton, Field, Input, Select, Toggle } from "@/components/Primitives";
import { Plus, X, Save, GripVertical } from "lucide-react";
import { toast } from "sonner";

const FIELD_TYPES = [
  { v: "prompt", l: "Prompt (texte long)" },
  { v: "text", l: "Texte court" },
  { v: "toggle", l: "Oui / Non" },
  { v: "list", l: "Liste de mots" },
];

function newField(type = "prompt") {
  const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    type,
    key: id,
    label: type === "prompt" ? "Instructions" : "Champ",
    value: type === "toggle" ? true : type === "list" ? [] : "",
  };
}

function newSection() {
  return {
    id: `s_${Date.now()}`,
    title: "Nouvelle section",
    fields: [newField("prompt")],
  };
}

export default function SectionsPerso({ config, updateConfig }) {
  const [sections, setSections] = useState(config.behavior?.custom_sections || []);

  useEffect(() => {
    setSections(config.behavior?.custom_sections || []);
  }, [config]);

  const save = () => updateConfig({
    behavior: { ...(config.behavior || {}), custom_sections: sections },
  });

  const addSection = () => {
    setSections([...sections, newSection()]);
    toast.message("Section ajoutée — pense à sauvegarder");
  };

  const removeSection = (idx) => {
    if (!window.confirm("Supprimer cette section ?")) return;
    setSections(sections.filter((_, i) => i !== idx));
  };

  const updateSection = (idx, patch) => {
    const next = [...sections];
    next[idx] = { ...next[idx], ...patch };
    setSections(next);
  };

  const addField = (sIdx, type) => {
    const next = [...sections];
    next[sIdx] = { ...next[sIdx], fields: [...(next[sIdx].fields || []), newField(type)] };
    setSections(next);
  };

  const updateField = (sIdx, fIdx, patch) => {
    const next = [...sections];
    const fields = [...next[sIdx].fields];
    fields[fIdx] = { ...fields[fIdx], ...patch };
    next[sIdx] = { ...next[sIdx], fields };
    setSections(next);
  };

  const removeField = (sIdx, fIdx) => {
    const next = [...sections];
    next[sIdx] = { ...next[sIdx], fields: next[sIdx].fields.filter((_, i) => i !== fIdx) };
    setSections(next);
  };

  const updateListItem = (sIdx, fIdx, listIdx, val) => {
    const field = sections[sIdx].fields[fIdx];
    const list = [...(field.value || [])];
    list[listIdx] = val;
    updateField(sIdx, fIdx, { value: list });
  };

  const addListItem = (sIdx, fIdx, input) => {
    const v = input.trim();
    if (!v) return;
    const field = sections[sIdx].fields[fIdx];
    const list = [...(field.value || [])];
    if (!list.includes(v)) list.push(v);
    updateField(sIdx, fIdx, { value: list });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg tracking-wider text-[var(--vsm-white)]">Sections personnalisées</h2>
          <p className="text-xs text-[var(--vsm-grey)] mt-1">
            Base de connaissance WhatsApp + chatbot — le bot lit ces blocs à chaque message (sans supposer au-delà).
          </p>
        </div>
        <div className="flex gap-2">
          <OutlineButton onClick={addSection}><Plus size={12} className="mr-1" /> Nouvelle section</OutlineButton>
          <RedButton onClick={save}><Save size={12} className="mr-1" /> Sauver</RedButton>
        </div>
      </div>

      {sections.length === 0 && (
        <Card title="Aucune section" subtitle="Exemple : « Programme ambassadeur », « Kit boutique », « Candidature validée »">
          <p className="text-sm text-[var(--vsm-grey)] mb-4">
            Chaque section peut mélanger prompts libres, URLs, toggles et listes de mots-clés.
          </p>
          <OutlineButton onClick={addSection}><Plus size={12} className="mr-1" /> Créer ma première section</OutlineButton>
        </Card>
      )}

      {sections.map((section, sIdx) => (
        <Card
          key={section.id}
          title={section.title || "Sans titre"}
          subtitle={`${section.fields?.length || 0} champ(s)`}
          action={(
            <OutlineButton onClick={() => removeSection(sIdx)}><X size={12} /></OutlineButton>
          )}
        >
          <Field label="Titre de la section" className="mb-4">
            <Input
              value={section.title || ""}
              onChange={(e) => updateSection(sIdx, { title: e.target.value })}
              placeholder="ex: Programme ambassadeur"
            />
          </Field>

          <div className="space-y-4">
            {(section.fields || []).map((field, fIdx) => (
              <div key={field.id} className="border border-[var(--vsm-border)] p-3 space-y-3">
                <div className="flex items-center gap-2 text-[var(--vsm-grey)]">
                  <GripVertical size={14} />
                  <Select
                    value={field.type}
                    onChange={(e) => updateField(sIdx, fIdx, { type: e.target.value, value: e.target.value === "toggle" ? true : e.target.value === "list" ? [] : "" })}
                    className="flex-1"
                  >
                    {FIELD_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </Select>
                  <Input
                    value={field.label || ""}
                    onChange={(e) => updateField(sIdx, fIdx, { label: e.target.value })}
                    placeholder="Libellé"
                    className="flex-1"
                  />
                  <button onClick={() => removeField(sIdx, fIdx)} className="text-[var(--vsm-grey)] hover:text-[var(--vsm-red)]">
                    <X size={14} />
                  </button>
                </div>

                {field.type === "prompt" && (
                  <Textarea
                    rows={5}
                    value={field.value || ""}
                    onChange={(e) => updateField(sIdx, fIdx, { value: e.target.value })}
                    className="font-mono text-xs"
                    placeholder="Instructions pour l'IA quand ce sujet est abordé…"
                  />
                )}
                {field.type === "text" && (
                  <Input
                    value={field.value || ""}
                    onChange={(e) => updateField(sIdx, fIdx, { value: e.target.value })}
                    placeholder="ex: https://ambassadeur.vsmcollection.com/apply"
                  />
                )}
                {field.type === "toggle" && (
                  <div className="flex items-center gap-3">
                    <Toggle checked={!!field.value} onChange={(v) => updateField(sIdx, fIdx, { value: v })} />
                    <span className="text-sm text-[var(--vsm-cream)]">{field.value ? "Actif" : "Inactif"}</span>
                  </div>
                )}
                {field.type === "list" && (
                  <ListField
                    items={field.value || []}
                    onAdd={(v) => addListItem(sIdx, fIdx, v)}
                    onRemove={(i) => updateField(sIdx, fIdx, { value: (field.value || []).filter((_, j) => j !== i) })}
                    onChangeItem={(i, v) => updateListItem(sIdx, fIdx, i, v)}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {FIELD_TYPES.map((t) => (
              <OutlineButton key={t.v} onClick={() => addField(sIdx, t.v)}>
                <Plus size={11} className="mr-1" /> {t.l}
              </OutlineButton>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ListField({ items, onAdd, onRemove, onChangeItem }) {
  const [input, setInput] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2 min-h-[40px]">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-1 border border-[var(--vsm-border-strong)] text-xs font-mono">
            <input
              value={item}
              onChange={(e) => onChangeItem(i, e.target.value)}
              className="bg-transparent outline-none w-24"
            />
            <button onClick={() => onRemove(i)}><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Ajouter un mot…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(input); setInput(""); } }}
        />
        <OutlineButton onClick={() => { onAdd(input); setInput(""); }}><Plus size={12} /></OutlineButton>
      </div>
    </div>
  );
}
