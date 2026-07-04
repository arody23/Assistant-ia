/**
 * Décide si le bot WhatsApp doit envoyer l'image catalogue d'un produit.
 */

import { userWantsVisual } from "./asset-picker.js";

const PRODUCT_INTENT =
  /\b(prix|stock|taille|couleur|collection|commander|acheter|dispo|disponible|hoodie|t-?shirt|veste|renescentia|classic|produit|article|montre|voir|photo|image|aperçu|apercu)\b/i;

export function productKey(product) {
  if (!product) return "";
  return (product.slug || String(product.id || "")).toLowerCase();
}

export function shouldSendProductImage({ userText, catalog, profile = {} }) {
  if (!catalog?.primary?.image_url) return false;
  if ((catalog.matchScore || 0) < 4) return false;

  const key = productKey(catalog.primary);
  if (!key) return false;

  const sent = profile.sent_product_images || [];
  if (sent.includes(key)) return false;

  if (userWantsVisual(userText)) return true;

  if (PRODUCT_INTENT.test(userText || "") && (catalog.matchScore || 0) >= 8) return true;

  return false;
}

/** Envoie l'image catalogue après qu'une photo client a identifié un produit. */
export function shouldSendAfterPhoto({ mediaType, catalog, profile = {} }) {
  if (mediaType !== "image") return false;
  if (!catalog?.primary?.image_url) return false;
  if ((catalog.matchScore || 0) < 50) return false;

  const key = productKey(catalog.primary);
  if (!key) return false;

  const sent = profile.sent_product_images || [];
  return !sent.includes(key);
}

/** Réinitialise les images envoyées si le client change de collection. */
export function resetProductImagesIfChanged(profile = {}, product) {
  const key = productKey(product);
  if (!key) return profile;
  if (profile.pinned_product_key === key) return profile;
  return {
    ...profile,
    pinned_product_key: key,
    sent_product_images: [],
  };
}

export function markProductImageSent(profile = {}, product) {
  const key = productKey(product);
  if (!key) return profile;
  const sent = [...(profile.sent_product_images || [])];
  if (!sent.includes(key)) sent.push(key);
  return {
    ...profile,
    pinned_product_key: key,
    sent_product_images: sent.slice(-20),
  };
}
