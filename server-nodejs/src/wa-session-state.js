/**
 * État persistant du bot WA (sur le volume Railway /data)
 * — filigrane anti-backlog + déduplication des message IDs
 */

import fs from "fs";
import path from "path";

const MAX_IDS = 1000;
const STATE_FILE = "wa-bot-state.json";

export function stateFilePath(sessionDir) {
  return path.join(sessionDir, STATE_FILE);
}

export function loadWaState(sessionDir) {
  try {
    const raw = fs.readFileSync(stateFilePath(sessionDir), "utf8");
    const data = JSON.parse(raw);
    return {
      processedIds: Array.isArray(data.processedIds) ? data.processedIds : [],
      ignoreBeforeSec: Number(data.ignoreBeforeSec) || 0,
      lastReadyAtSec: Number(data.lastReadyAtSec) || 0,
      warmupUntilMs: Number(data.warmupUntilMs) || 0,
    };
  } catch {
    return { processedIds: [], ignoreBeforeSec: 0, lastReadyAtSec: 0, warmupUntilMs: 0 };
  }
}

export function saveWaState(sessionDir, state) {
  try {
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(stateFilePath(sessionDir), JSON.stringify({
      processedIds: (state.processedIds || []).slice(0, MAX_IDS),
      ignoreBeforeSec: state.ignoreBeforeSec || 0,
      lastReadyAtSec: state.lastReadyAtSec || 0,
      warmupUntilMs: state.warmupUntilMs || 0,
      updatedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.warn("[wa-state] save failed:", e.message);
  }
}

export function markReady(sessionDir, state, { warmupMs = 120_000 } = {}) {
  const sec = Math.floor(Date.now() / 1000);
  const next = {
    ...state,
    lastReadyAtSec: sec,
    ignoreBeforeSec: sec,
    warmupUntilMs: Date.now() + warmupMs,
  };
  saveWaState(sessionDir, next);
  return next;
}

export function markProcessed(sessionDir, state, msgId) {
  if (!msgId) return state;
  if (state.processedIds.includes(msgId)) return state;
  const next = {
    ...state,
    processedIds: [msgId, ...state.processedIds].slice(0, MAX_IDS),
  };
  saveWaState(sessionDir, next);
  return next;
}

export function wasProcessed(state, msgId) {
  return !!(msgId && state.processedIds.includes(msgId));
}

/** Vide les IDs traités au redémarrage (nouveau snapshot backlog). */
export function clearProcessedIds(sessionDir, state) {
  const next = { ...state, processedIds: [] };
  saveWaState(sessionDir, next);
  return next;
}

/** Timestamp WA en secondes (gère ms si besoin). */
export function normalizeMsgTimestamp(ts) {
  const n = Number(ts) || 0;
  if (n > 1e12) return Math.floor(n / 1000);
  return Math.floor(n);
}
