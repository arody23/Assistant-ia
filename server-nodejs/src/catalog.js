import { getSupabase } from "./supabase.js";
import { log } from "./logger.js";

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

  // Slug — priorité maximale (ex: renescentia)
  if (slug) {
    if (q.includes(slug)) score += 30;
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
  return score;
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

function summarizeVariants(variants, askedSize, askedColor, { revealStock = false } = {}) {
  let list = variants || [];
  if (askedSize) list = list.filter((v) => norm(v.size) === norm(askedSize));
  if (askedColor) list = list.filter((v) => norm(v.color) === norm(askedColor));

  if (!list.length) return "  (aucune variante correspondante)";

  if (!revealStock && !askedSize && !askedColor) {
    const sizes = [...new Set(list.map((v) => (v.size || "").toUpperCase()).filter(Boolean))];
    const colors = [...new Set(list.map((v) => v.color).filter(Boolean))];
    return [
      `  Tailles proposées: ${sizes.join(", ") || "—"}`,
      `  Couleurs: ${colors.join(", ") || "—"}`,
      "  (ne pas annoncer de quantités — demander taille puis couleur au client)",
    ].join("\n");
  }

  if (!revealStock && askedSize && !askedColor) {
    const colors = [...new Set(list.map((v) => v.color).filter(Boolean))];
    return `  Couleurs pour taille ${askedSize}: ${colors.join(", ") || "—"} (quantités après choix couleur)`;
  }

  const inStock = list.filter((v) => v.stock > 0);
  const lines = (inStock.length ? inStock : list).slice(0, 12).map(variantLine);
  if (list.length > 12) lines.push(`  … +${list.length - 12} autres variantes`);
  return lines.join("\n");
}

function buildContext(entries, query, { revealStock = false } = {}) {
  const askedSize = parseSize(query);
  const lines = entries.map(({ product, variants }) => {
    const allVariants = variants || [];
    const askedColor = parseColor(query, allVariants);
    const totalStock = allVariants.reduce((s, v) => s + (v.stock || 0), 0);
    const showStock = revealStock || (askedSize && askedColor);
    return [
      `• ${product.name.trim()} (id ${product.id})`,
      product.slug ? `  Slug: ${product.slug}` : null,
      `  Prix: ${formatPrice(product.price)} | Catégorie: ${product.category || "—"}`,
      showStock ? `  Stock total: ${totalStock}` : "  Disponibilité: oui (détails stock après taille + couleur)",
      `  Lien: ${productUrl(product)}`,
      product.description ? `  Description: ${product.description.trim().slice(0, 200)}` : null,
      `  Variantes${askedSize || askedColor ? " (filtrées)" : ""}:`,
      summarizeVariants(allVariants, askedSize, askedColor, { revealStock: showStock }),
      showStock ? "  RÈGLE: cite UNIQUEMENT ces variantes pour stock." : "  RÈGLE: ne pas citer de quantités avant taille ET couleur.",
    ].filter(Boolean).join("\n");
  });
  return lines.join("\n\n");
}

/**
 * Recherche produits + variantes dans la BDD e-commerce existante.
 */
export async function getActiveProducts() {
  const supabase = getSupabase();
  if (!supabase) {
    await log("error", "catalog: Supabase non configuré");
    return [];
  }
  const { data, error } = await supabase.from("products").select("*").eq("is_active", true);
  if (error) {
    await log("error", `catalog products: ${error.message}`);
    return [];
  }
  if (!data?.length) {
    await log("warn", "catalog: aucun produit actif");
    return [];
  }
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

function buildNames(products = []) {
  return products.map((p) => (p.name || "").trim()).filter(Boolean);
}

async function fetchProductsAndVariants() {
  const supabase = getSupabase();
  if (!supabase) return { products: [], byProduct: {}, error: "supabase_missing" };

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true);

  if (error) {
    await log("error", `catalog products: ${error.message}`);
    return { products: [], byProduct: {}, error: error.message };
  }
  if (!products?.length) {
    await log("warn", "catalog: aucun produit actif");
    return { products: [], byProduct: {}, error: "no_products" };
  }

  const ids = products.map((p) => p.id);
  const { data: variants, error: vErr } = await supabase
    .from("product_variants")
    .select("*")
    .in("product_id", ids);

  if (vErr) await log("warn", `catalog variants: ${vErr.message}`);

  const byProduct = {};
  for (const v of variants || []) {
    (byProduct[v.product_id] ||= []).push(v);
  }
  return { products, byProduct, error: null };
}

function scoreEntries(products, byProduct, query, cfg = {}) {
  const keywords = cfg.product_keywords || [];
  return products
    .map((p) => ({
      product: p,
      variants: byProduct[p.id] || [],
      score: scoreProduct(p, query, keywords),
    }))
    .sort((a, b) => b.score - a.score);
}

export async function searchCatalog(query, cfg = {}) {
  const { products, byProduct } = await fetchProductsAndVariants();
  if (!products.length) {
    return {
      products: [],
      variants: [],
      context: "",
      primary: null,
      matchScore: 0,
      matchType: "none",
      candidates: [],
      availableNames: [],
    };
  }

  const scored = scoreEntries(products, byProduct, query, cfg);
  const positive = scored.filter((e) => e.score > 0);
  const availableNames = buildNames(products);
  const keywords = cfg.product_keywords || [];
  const catalogQuestion = CATALOG_HINTS.test(query) || keywords.some((k) => norm(query).includes(norm(k)));

  if (!positive.length && !catalogQuestion) {
    return {
      products: [],
      variants: [],
      context: "",
      primary: null,
      matchScore: 0,
      matchType: "none",
      candidates: [],
      availableNames,
    };
  }

  const top = positive[0] || scored[0];
  const second = positive[1];
  const ambiguous = !!(top && second && top.score > 0 && second.score > 0 && (top.score - second.score <= 3));

  if (ambiguous) {
    const candidates = positive.slice(0, 4).map((e) => ({
      id: e.product.id,
      name: e.product.name,
      slug: e.product.slug || "",
      score: e.score,
    }));
    return {
      products: [],
      variants: [],
      context: "",
      primary: null,
      matchScore: top.score,
      matchType: "ambiguous",
      candidates,
      availableNames,
    };
  }

  const entry = top || null;
  if (!entry || !entry.product) {
    return {
      products: [],
      variants: [],
      context: "",
      primary: null,
      matchScore: 0,
      matchType: "none",
      candidates: [],
      availableNames,
    };
  }

  const context = buildContext([entry], query);
  return {
    products: [entry.product],
    variants: entry.variants || [],
    context,
    primary: entry.product,
    matchScore: entry.score ?? 0,
    matchType: (entry.score || 0) > 0 ? "exact" : "fallback",
    candidates: [],
    availableNames,
  };
}

function findProductByGuess(products, guess) {
  if (!guess?.trim()) return null;
  const g = norm(guess);
  const gSlug = g.replace(/\s+/g, "-");
  return products.find((p) => {
    const slug = norm(p.slug || "");
    const name = norm(p.name);
    return slug === gSlug || slug === g || name === g || name.includes(g) || g.includes(name)
      || slug.replace(/-/g, " ").includes(g);
  }) || null;
}

async function catalogFromProduct(product, query, cfg, matchScore = 100) {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      products: [],
      variants: [],
      context: "",
      primary: null,
      matchScore: 0,
      matchType: "none",
      candidates: [],
      availableNames: [],
    };
  }
  const { data: variants } = await supabase.from("product_variants").select("*").eq("product_id", product.id);
  const entry = { product, variants: variants || [], score: matchScore };
  const products = await getActiveProducts();
  return {
    products: [product],
    variants: variants || [],
    context: buildContext([entry], query),
    primary: product,
    matchScore,
    matchType: "exact",
    candidates: [],
    availableNames: buildNames(products),
  };
}

const FOLLOWUP_HINT = /\b(taille|couleur|stock|prix|xl|xxl|3xl|commander|oui|non|dispo)\b/i;

/**
 * Catalogue ancré — vision > produit épinglé (suivi) > recherche texte.
 */
export async function resolveCatalog({
  userText = "",
  visionGuess = "",
  visionSearchTerms = "",
  pinnedProductName = "",
  cfg = {},
}) {
  const products = await getActiveProducts();
  if (!products.length) {
    return {
      products: [],
      variants: [],
      context: "",
      primary: null,
      matchScore: 0,
      matchType: "none",
      candidates: [],
      availableNames: [],
    };
  }

  const query = visionSearchTerms || userText;

  const fromVision = findProductByGuess(products, visionGuess);
  if (fromVision) return catalogFromProduct(fromVision, query, cfg, 100);

  const pinned = findProductByGuess(products, pinnedProductName);
  if (pinned && FOLLOWUP_HINT.test(userText)) {
    return catalogFromProduct(pinned, query, cfg, 85);
  }

  const catalog = await searchCatalog(query, cfg);
  if (visionGuess && catalog.primary) {
    const forced = findProductByGuess(products, visionGuess);
    if (forced && forced.id !== catalog.primary.id) {
      return catalogFromProduct(forced, query, cfg, 95);
    }
  }

  return catalog;
}
