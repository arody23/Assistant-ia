const MAX = 200;
const logs = [];

export function addLog(level, message) {
  const entry = {
    id: Math.random().toString(36).slice(2),
    ts: new Date().toISOString(),
    level: String(level).toUpperCase(),
    message,
  };
  logs.push(entry);
  if (logs.length > MAX) logs.splice(0, logs.length - MAX);
  // eslint-disable-next-line no-console
  console.log(`[${entry.level}] ${message}`);
  return entry;
}

export function getLogs() {
  return [...logs].reverse().slice(0, 100);
}

export function clearLogs() {
  logs.length = 0;
}

export function simulateLogs() {
  const samples = [
    ["info", "Bot connecté au numéro WhatsApp +243 XXX XXX"],
    ["success", "Message reçu et traité avec succès"],
    ["warn", "Limite de tokens proche"],
    ["info", "Client recherche un produit : 'hoodie'"],
    ["success", "Réponse envoyée en 1.2s via llama-3.1-8b-instant"],
    ["error", "Échec de chargement d'une image produit"],
  ];
  samples.forEach(([l, m]) => addLog(l, m));
}
