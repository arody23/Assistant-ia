/**
 * Normalise le téléphone WhatsApp pour checkout / commandes.
 * Priorité : contact.number (vrai numéro) avant l'ID @lid.
 */

export function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

/** Extrait un numéro E.164 Congo (+242…) si possible. */
export function toE164(raw) {
  const d = digitsOnly(raw);
  if (!d) return "";
  if (d.startsWith("242") && d.length >= 12) return `+${d}`;
  if (d.length === 9) return `+242${d}`;
  if (d.length >= 10 && d.length <= 15) return `+${d}`;
  return "";
}

/**
 * @param {object} contact - contact whatsapp-web.js
 * @param {string} msgFrom - msg.from (ex. 242…@c.us ou …@lid)
 * @returns {{ phone: string, waChatId: string, e164: string }}
 */
export function resolveWaIdentity(contact, msgFrom) {
  const waChatId = String(msgFrom || "")
    .replace(/@c\.us$/i, "")
    .replace(/@lid$/i, "")
    .replace(/@s\.whatsapp\.net$/i, "");

  const fromContact = toE164(contact?.number || contact?.id?.user || "");
  const fromMsg = toE164(waChatId);

  const e164 = fromContact || fromMsg || "";
  const phone = e164 || waChatId || msgFrom || "";

  return { phone, waChatId, e164 };
}

/** 9 derniers chiffres pour recherche orders/profiles. */
export function phoneTail(phone) {
  const d = digitsOnly(phone);
  return d.length >= 9 ? d.slice(-9) : d;
}
