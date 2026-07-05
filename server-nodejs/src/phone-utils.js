/**
 * Identité WhatsApp — sépare clé conversation (@lid) et téléphone checkout (E.164).
 */

export function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

/** Numéro Congo valide uniquement — jamais un Linked ID (14-15 chiffres). */
export function toE164(raw) {
  const d = digitsOnly(raw);
  if (!d) return "";
  if (d.length >= 14) return "";
  if (d.startsWith("242") && d.length >= 12) return `+${d}`;
  if (d.length === 9) return `+242${d}`;
  if (d.length >= 10 && d.length <= 13) return `+${d}`;
  return "";
}

/**
 * @param {object} contact - contact whatsapp-web.js
 * @param {string} msgFrom - ex. 242…@c.us ou …@lid
 */
export function resolveWaIdentity(contact, msgFrom) {
  const rawFrom = String(msgFrom || "");
  const isLid = /@lid$/i.test(rawFrom);

  const waChatId = rawFrom
    .replace(/@c\.us$/i, "")
    .replace(/@lid$/i, "")
    .replace(/@s\.whatsapp\.net$/i, "");

  const e164 = toE164(contact?.number || contact?.id?.user || "");
  const phone = isLid ? `${waChatId}@lid` : (e164 || waChatId);

  return { phone, waChatId, e164, isLid };
}

export function phoneTail(phone) {
  const d = digitsOnly(phone);
  if (!d || d.length >= 14) return "";
  return d.length >= 9 ? d.slice(-9) : d;
}

/** Téléphone pour checkout : E.164 contact, profil sauvegardé, ou 9 derniers chiffres. */
export function checkoutPhone({ e164, profile = {}, fallbackPhone = "" }) {
  if (e164) return e164;
  if (profile.wa_e164) return profile.wa_e164;
  const tail = phoneTail(fallbackPhone);
  if (tail) return `+242${tail}`;
  return "";
}
