/**
 * Sélection intelligente des médias ambassadeur — pas d'envoi massif automatique.
 */

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

export function userWantsVisual(text) {
  const q = norm(text);
  return /aperçu|apercu|photo|image|voir|ressemble|montre|capture|visuel|exemple|screenshot|écran|ecran/.test(q);
}

export function selectAmbassadorAssets(message, reply, assets = []) {
  if (!assets.length) return [];

  const q = norm(`${message} ${reply}`);
  const explicit = userWantsVisual(message);

  const scored = assets
    .map((asset) => {
      let score = 0;
      const title = norm(asset.title);
      const caption = norm(asset.caption || "");
      const desc = norm(asset.description || "");
      const keywords = (asset.keywords || []).map(norm);

      if (title && q.includes(title)) score += 15;
      for (const w of title.split(/[\s\-_/]+/).filter((x) => x.length > 3)) {
        if (q.includes(w)) score += 4;
      }
      if (caption && q.includes(caption)) score += 8;
      for (const w of caption.split(/\s+/).filter((x) => x.length > 4)) {
        if (q.includes(w)) score += 2;
      }
      if (desc) {
        for (const w of desc.split(/\s+/).filter((x) => x.length > 4)) {
          if (q.includes(w)) score += 2;
        }
      }
      for (const kw of keywords) {
        if (kw && q.includes(kw)) score += 6;
      }

      return { asset, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];

  if (explicit) {
    return scored.slice(0, 2).map((x) => x.asset);
  }

  // Pertinence forte uniquement (IA a cité le bon visuel dans sa réponse)
  if (scored[0].score >= 10) {
    return [scored[0].asset];
  }

  return [];
}

export function assetsToImages(assets) {
  return assets.map((a) => ({
    url: a.image_url,
    caption: a.caption || a.title,
    id: a.id,
  }));
}
