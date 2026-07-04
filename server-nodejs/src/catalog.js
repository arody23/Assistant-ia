import { getSupabase } from "./supabase.js";

const SITE = (process.env.SITE_URL || "https://www.vsmcollection.com").replace(/\/$/, "");

const CATALOG_HINTS =
  /\b(prix|stock|taille|couleur|produit|article|collection|commander|acheter|dispo|disponible|hoodie|t-?shirt|veste|renescentia|classic|classic of life|vsm|boutique|fc|cdf|pointure|slug)\b/i;

const SIZES = ["3xl", "xxl", "xl", "l", "m", "s", "xs"];

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

export function productUrl(product) {
  if (product?.slug) return `${SITE}/produit/${product.slug}`;
  return `${SITE}/produits/${product.id}`;
}

function formatPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return String(price ?? "");
  return `${n.toLocaleString("fr-FR")} FC`;
}

function scoreProduct(product, query, extraKeywords = []) {
  const q = norm(query);
  const name = norm(product.name);
  const slug = norm(product.slug || "");
  const desc = norm(product.description);
  const cat = norm(product.category);
  let score = 0;

  if (slug) {
    if (q.includes(slug)) score += 30;
    const slugSpaced = slug.replace(/-/g, " ");
    if (slugSpaced && q.includes(slugSpaced)) score += 28;
    for (const part of slug.split(/[-_\s]+/).filter((w) => w.length > 2)) {
      if (q.includes(part)) score += 10;
    }
    for (const word of q.split(/\s+/).filter((w) => w.length > 3)) {
      if (slug.includes(word)) score += 8;
    }
  }

  if (name && q.includes(name.replace(/\s+/g, " "))) score += 12;
  if (name) {
    for (const word of name.split(/\s+/).filter((w) => w.length > 2)) {
      if (q.includes(word)) score += 4;
    }
  }
  if (cat && q.includes(cat)) score += 3;
  if (desc) {
    for (const word of desc.split(/\s+/).filter((w) => w.length > 4).slice(0, 8)) {
      if (q.includes(word)) score += 1;
    }
  }
  for (const kw of extraKeywords || []) {
    const k = norm(kw);
    if (k && q.includes(k)) score += 5;
    if (slug && k && slug.includes(k)) score += 8;
  }

  // Pénalité si la requête cible clairement une autre collection
  if (slug.includes("classic") && q.includes("renescentia") && !q.includes("classic")) score -= 25;
  if (slug.includes("renescentia") && q.includes("classic") && !q.includes("renescentia")) score -= 25;

  return score;
}

function findProductByGuess(products, guess) {
  if (!guess?.trim()) return null;
  const g = norm(guess);
  const gSlug = g.replace(/\s+/g, "-");

  return products.find((p) => {
    const slug = norm(p.slug || "");
    const name = norm(p.name);
    return slug === gSlug
      || slug === g
      || name === g
      || name.includes(g)
      || g.includes(name)
      || slug.replace(/-/g, " ").includes(g)
      || g.includes(slug.replace(/-/g, " "));
  }) || null;
}

function parseSize(query) {
  const q = norm(query);
  for (const s of SIZES) {
    if (new RegExp(`\\b${s}\\b`).test(q)) return s.toUpperCase();
  }
  return null;
}

function parseColor(query, variants) {
  const q = norm(query);
  const colors = [...new Set((variants || []).map((v) => v.color).filter(Boolean))];
  for (const c of colors) {
    if (q.includes(norm(c))) return c;
  }
  return null;
}

function variantLine(v) {
  const stock = v.stock > 0 ? `${v.stock} en stock` : "rupture";
  return `  - ${v.color} / ${v.size}: ${stock}`;
}

function summarizeVariants(variants, askedSize, askedColor) {
  let list = variants || [];
  if (askedSize) list = list.filter((v) => norm(v.size) === norm(askedSize));
  if (askedColor) list = list.filter((v) => norm(v.color) === norm(askedColor));

  if (!list.length) return "  (aucune variante correspondante en stock)";

  const inStock = list.filter((v) => v.stock > 0);
  const lines = (inStock.length ? inStock : list).slice(0, 12).map(variantLine);
  if (list.length > 12) lines.push(`  … +${list.length - 12} autres variantes`);
  return lines.join("\n");
}

function buildContext(entries, query) {
  const askedSize = parseSize(query);
  const lines = entries.map(({ product, variants }) => {
    const allVariants = variants || [];
    const askedColor = parseColor(query, allVariants);
    const totalStock = allVariants.reduce((s, v) => s + (v.stock || 0), 0);
    return [
      `• ${product.name.trim()} (id ${product.id})`,
      product.slug ? `  Slug: ${product.slug}` : null,
      `  Prix: ${formatPrice(product.price)} | Catégorie: ${product.category || "—"}`,
      `  Stock total: ${totalStock} | Actif: ${product.is_active ? "oui" : "non"}`,
      `  Lien: ${productUrl(product)}`,
      product.description ? `  Description: ${product.description.trim().slice(0, 280)}` : null,
      `  Variantes${askedSize || askedColor ? " (filtrées)" : ""}:`,
      summarizeVariants(allVariants, askedSize, askedColor),
      "  RÈGLE: cite UNIQUEMENT ces variantes pour stock/tailles. N'invente jamais une taille absente.",
    ].filter(Boolean).join("\n");
  });
  return lines.join("\n\n");
}

async function loadVariantsByProduct(productIds) {
  const supabase = getSupabase();
  if (!supabase || !productIds.length) return {};
  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .in("product_id", productIds);
  const byProduct = {};
  for (const v of variants || []) {
    (byProduct[v.product_id] ||= []).push(v);
  }
  return byProduct;
}

async function catalogFromProduct(product, query, cfg, matchScore = 100) {
  const byProduct = await loadVariantsByProduct([product.id]);
  const entry = { product, variants: byProduct[product.id] || [], score: matchScore };
  return {
    products: [product],
    context: buildContext([entry], query),
    primary: product,
    matchScore,
  };
}

export async function getActiveProducts() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("products").select("*").eq("is_active", true);
  if (error || !data?.length) return [];
  return data;
}

export async function getActiveProductNames() {
  return (await getActiveProducts()).map((p) => (p.name || "").trim()).filter(Boolean);
}

export function buildAvailableSummary(products) {
  return (products || [])
    .map((p) => `• ${p.name.trim()} — ${formatPrice(p.price)} — ${productUrl(p)}`)
    .join("\n");
}

export async function searchCatalog(query, cfg = {}) {
  const supabase = getSupabase();
  if (!supabase) return { products: [], context: "", primary: null, matchScore: 0 };

  const products = await getActiveProducts();
  if (!products.length) return { products: [], context: "", primary: null, matchScore: 0 };

  const byProduct = await loadVariantsByProduct(products.map((p) => p.id));
  const keywords = cfg.product_keywords || [];
  const scored = products
    .map((p) => ({ product: p, variants: byProduct[p.id] || [], score: scoreProduct(p, query, keywords) }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);

  const catalogQuestion = CATALOG_HINTS.test(query) || keywords.some((k) => norm(query).includes(norm(k)));

  let entries;
  if (scored.length) {
    entries = scored.slice(0, 1);
  } else if (catalogQuestion) {
    entries = products
      .map((p) => ({
        product: p,
        variants: byProduct[p.id] || [],
        score: scoreProduct(p, query, keywords),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 1);
  } else {
    return { products: [], context: "", primary: null, matchScore: 0 };
  }

  const context = buildContext(entries, query);
  const primary = entries[0]?.product || null;
  const matchScore = entries[0]?.score ?? 0;

  return {
    products: entries.map((e) => e.product),
    context,
    primary,
    matchScore,
  };
}

/**
 * Résolution catalogue — priorité vision (product_guess) puis texte client.
 */
export async function resolveCatalog({ userText = "", visionGuess = "", visionSearchTerms = "", cfg = {} }) {
  const products = await getActiveProducts();
  const query = visionSearchTerms || userText;

  const fromVision = findProductByGuess(products, visionGuess);
  if (fromVision) {
    return catalogFromProduct(fromVision, query, cfg, 100);
  }

  const catalog = await searchCatalog(query, cfg);

  if (visionGuess && catalog.primary) {
    const forced = findProductByGuess(products, visionGuess);
    if (forced && forced.id !== catalog.primary.id) {
      return catalogFromProduct(forced, query, cfg, 95);
    }
  }

  const fromText = findProductByGuess(products, userText);
  if (fromText && catalog.primary && fromText.id !== catalog.primary.id) {
    const textScore = scoreProduct(fromText, userText, cfg.product_keywords);
    if (textScore >= (catalog.matchScore || 0)) {
      return catalogFromProduct(fromText, query, cfg, textScore);
    }
  }

  return catalog;
}
