import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** URL API Node (Railway) — force HTTPS hors localhost (évite Mixed Content sur Vercel). */
export function getNodeUrl() {
  const raw = (process.env.REACT_APP_NODE_URL || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  if (raw.startsWith("http://") && !/^http:\/\/localhost(:\d+)?$/i.test(raw)) {
    return raw.replace(/^http:\/\//i, "https://");
  }
  return raw;
}
