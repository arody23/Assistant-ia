import { useState, useEffect } from "react";
import { Card, Toggle, RedButton, OutlineButton, Input, Select } from "@/components/Primitives";
import { Plus, X, Zap } from "lucide-react";
import { DEFAULT_AUTOMATIONS } from "@/lib/automations-defaults";

const TRIGGERS = [
  { value: "order_created", label: "Nouvelle commande créée" },
  { value: "order_updated", label: "Commande mise à jour" },
];

const ACTIONS = [
  { value: "whatsapp_notify_admin", label: "Notifier l'admin WhatsApp" },
  { value: "whatsapp_notify_courier", label: "Notifier le livreur assigné" },
];

const CONDITION_FIELDS = [
  { value: "urgent", label: "Livraison urgente" },
  { value: "status", label: "Statut commande" },
  { value: "courier_id", label: "Livreur assigné" },
];

const CONDITION_OPS = [
  { value: "eq", label: "est égal à" },
  { value: "neq", label: "n'est pas égal à" },
  { value: "in", label: "est parmi" },
  { value: "changed", label: "a changé" },
  { value: "contains", label: "contient" },
];

function newRule() {
  return {
    id: `auto_${Date.now()}`,
    name: "Nouvelle règle",
    trigger: "order_created",
    enabled: true,
    conditions: [],
    actions: [{ type: "whatsapp_notify_admin" }],
  };
}

export default function Automations({ config, updateConfig }) {
  const [behavior, setBehavior] = useState(config.behavior || {});
  const [rules, setRules] = useState([]);

  useEffect(() => {
    setBehavior(config.behavior || {});
    const stored = config.behavior?.automations;
    setRules(Array.isArray(stored) && stored.length ? stored : DEFAULT_AUTOMATIONS);
  }, [config]);

  const save = () => updateConfig({ behavior: { ...behavior, automations: rules } });

  const resetDefaults = () => {
    setRules(DEFAULT_AUTOMATIONS.map((r) => ({ ...r })));
  };

  const updateRule = (idx, patch) => {
    const next = [...rules];
    next[idx] = { ...next[idx], ...patch };
    setRules(next);
  };

  const removeRule = (idx) => setRules(rules.filter((_, i) => i !== idx));

  const addCondition = (ruleIdx) => {
    const next = [...rules];
    const conds = [...(next[ruleIdx].conditions || []), { field: "urgent", op: "eq", value: true }];
    next[ruleIdx] = { ...next[ruleIdx], conditions: conds };
    setRules(next);
  };

  const updateCondition = (ruleIdx, condIdx, patch) => {
    const next = [...rules];
    const conds = [...(next[ruleIdx].conditions || [])];
    conds[condIdx] = { ...conds[condIdx], ...patch };
    next[ruleIdx] = { ...next[ruleIdx], conditions: conds };
    setRules(next);
  };

  const removeCondition = (ruleIdx, condIdx) => {
    const next = [...rules];
    next[ruleIdx] = {
      ...next[ruleIdx],
      conditions: (next[ruleIdx].conditions || []).filter((_, i) => i !== condIdx),
    };
    setRules(next);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card
        title="Automatisations"
        subtitle="Règles SI… ALORS… exécutées côté serveur (sans Zapier)"
        action={(
          <div className="flex flex-wrap gap-2">
            <OutlineButton onClick={resetDefaults}>Réinitialiser</OutlineButton>
            <RedButton onClick={save} testid="automations-save-btn">Sauver</RedButton>
          </div>
        )}
      >
        <p className="text-sm text-[var(--vsm-grey)] mb-4 leading-relaxed">
          Les commandes partagent la table Supabase avec le site e-commerce. Quand tu marques « Livré » ici,
          le statut est synchronisé automatiquement pour tout le monde.
        </p>

        <div className="space-y-4">
          {rules.map((rule, idx) => (
            <div key={rule.id} className="border border-[var(--vsm-border)] p-4 bg-[var(--vsm-void)]">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Toggle
                    checked={rule.enabled !== false}
                    onChange={(v) => updateRule(idx, { enabled: v })}
                    testid={`auto-toggle-${rule.id}`}
                  />
                  <Input
                    value={rule.name}
                    onChange={(e) => updateRule(idx, { name: e.target.value })}
                    className="flex-1 min-w-[200px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRule(idx)}
                  className="text-[var(--vsm-grey)] hover:text-[var(--vsm-red)]"
                  aria-label="Supprimer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--vsm-grey)] mb-1">SI (déclencheur)</div>
                  <Select
                    value={rule.trigger}
                    onChange={(e) => updateRule(idx, { trigger: e.target.value })}
                  >
                    {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--vsm-grey)] mb-1">ALORS (action)</div>
                  <Select
                    value={rule.actions?.[0]?.type || "whatsapp_notify_admin"}
                    onChange={(e) => updateRule(idx, { actions: [{ ...rule.actions?.[0], type: e.target.value }] })}
                  >
                    {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </Select>
                </div>
              </div>

              {(rule.conditions || []).length > 0 && (
                <div className="mb-3 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--vsm-grey)]">Conditions (toutes requises)</div>
                  {(rule.conditions || []).map((c, ci) => (
                    <div key={ci} className="flex flex-wrap items-center gap-2">
                      <Select
                        value={c.field}
                        onChange={(e) => updateCondition(idx, ci, { field: e.target.value })}
                        className="min-w-[140px]"
                      >
                        {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </Select>
                      <Select
                        value={c.op}
                        onChange={(e) => updateCondition(idx, ci, { op: e.target.value })}
                        className="min-w-[120px]"
                      >
                        {CONDITION_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                      {c.op !== "changed" && (
                        <Input
                          value={Array.isArray(c.value) ? c.value.join(",") : String(c.value ?? "")}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const val = c.field === "urgent" ? raw === "true" : (c.op === "in" ? raw.split(",").map((s) => s.trim()) : raw);
                            updateCondition(idx, ci, { value: val });
                          }}
                          placeholder="valeur"
                          className="flex-1 min-w-[100px]"
                        />
                      )}
                      <button type="button" onClick={() => removeCondition(idx, ci)} className="text-[var(--vsm-grey)] hover:text-[var(--vsm-red)]">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <OutlineButton onClick={() => addCondition(idx)}>
                  <Plus size={12} className="mr-1" /> Condition
                </OutlineButton>
                {rule.actions?.[0]?.type === "whatsapp_notify_admin" && (
                  <label className="flex items-center gap-2 text-xs text-[var(--vsm-cream)]">
                    <input
                      type="checkbox"
                      checked={!!rule.actions[0].priority}
                      onChange={(e) => updateRule(idx, { actions: [{ ...rule.actions[0], priority: e.target.checked }] })}
                    />
                    <Zap size={12} className="text-[var(--vsm-red)]" /> Alerte prioritaire
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        <OutlineButton onClick={() => setRules([...rules, newRule()])} className="mt-4">
          <Plus size={12} className="mr-1" /> Ajouter une règle
        </OutlineButton>
      </Card>
    </div>
  );
}
