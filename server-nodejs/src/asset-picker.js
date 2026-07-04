/**
 * Sélection des médias ambassadeur — respecte « Quand envoyer ? » et sort_order.
 */

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

export function userWantsVisual(text) {
  const q = norm(text);
  return /aperçu|apercu|photo|image|voir|ressemble|montre|capture|visuel|exemple|screenshot|écran|ecran/.test(q);
}

/** Instructions admin : envoi seulement si le client demande explicitement. */
function requiresExplicitRequest(description) {
  const d = norm(description);
  if (!d) return true;
  return /uniquement si|seulement si|si le client demande|si le visiteur demande|when (the )?client ask|only if|pas d'?envoi spontan|ne pas envoyer sans/.test(d);
}

function scoreAsset(asset, message, reply) {
  const q = norm(`${message} ${reply}`);
  let score = 0;
  const title = norm(asset.title);
  const caption = norm(asset.caption || "");
  const keywords = (asset.keywords || []).map(norm);

  if (title && q.includes(title)) score += 15;
  for (const w of title.split(/[\s\-_/]+/).filter((x) => x.length > 3)) {
    if (q.includes(w)) score += 4;
  }
  if (caption && q.includes(caption)) score += 8;
  for (const kw of keywords) {
    if (kw && q.includes(kw)) score += 6;
  }
  return score;
}

export function selectAmbassadorAssets(message, reply, assets = []) {
  if (!assets.length) return [];

  const explicit = userWantsVisual(message);
  const ordered = [...assets].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const candidates = ordered
    .map((asset) => ({ asset, score: scoreAsset(asset, message, reply) }))
    .filter(({ asset, score }) => {
      if (score <= 0) return false;
      if (explicit) return true;
      if (requiresExplicitRequest(asset.description)) return false;
      return score >= 8;
    });

  if (!candidates.length) return [];

  if (explicit) {
    return candidates.slice(0, 2).map((x) => x.asset);
  }

  return [candidates[0].asset];
}

export function assetsToImages(assets) {
  return assets.map((a) => ({
    url: a.image_url,
    caption: a.caption || a.title,
    id: a.id,
  }));
}
