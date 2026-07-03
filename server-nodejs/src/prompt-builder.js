const TONE_MAP = {
  premium: "Ton premium, urbain et assuré.",
  friendly: "Ton chaleureux et accessible.",
  formal: "Ton professionnel et poli (vouvoiement).",
  urban: "Ton streetwear, décontracté et authentique.",
};

const LENGTH_MAP = {
  short: "Réponses très brèves (1-2 phrases).",
  medium: "Réponses moyennes (2-4 phrases).",
  long: "Réponses détaillées si nécessaire.",
};

const EMOJI_MAP = {
  none: "N'utilise aucun emoji.",
  minimal: "Emojis discrets, maximum 1 par message.",
  rich: "Emojis expressifs avec modération.",
};

const DEFAULT_PROMPTS = {
  vision: `Tu analyses les photos envoyées par les clients VSM Collection.
Identifie si c'est un produit VSM, le nom de collection, le texte sur le vêtement, les couleurs.
Collections actuellement en vente: {COLLECTIONS}.
Réponds en JSON: is_vsm_product (yes/no/uncertain), confidence, product_guess, garment_type, colors_visible, text_on_garment, summary_fr.`,
  discontinued: `Cette collection ({COLLECTION}) n'est plus commercialisée / pas en stock actuellement. Propose poliment les collections disponibles: {COLLECTIONS}.`,
  not_in_catalog: `Ce visuel ne correspond pas à notre catalogue actuel. Oriente le client vers nos collections en vente: {COLLECTIONS}.`,
  night_mode: "Mode nuit actif: réponses plus courtes et directes.",
};

const DEFAULT_LANGUAGES = [
  { code: "fr", label: "Français", enabled: true, reply_instruction: "Réponds en français." },
  { code: "en", label: "English", enabled: true, reply_instruction: "Reply in English." },
  { code: "ln", label: "Lingala", enabled: false, reply_instruction: "Yano na Lingala." },
];

export function getBehavior(cfg = {}) {
  return cfg.behavior || {};
}

export function getPrompts(cfg = {}) {
  const b = getBehavior(cfg);
  const qr = cfg.quick_replies || {};
  return {
    ...DEFAULT_PROMPTS,
    welcome: qr.welcome || "",
    out_of_stock: qr.out_of_stock || "",
    transfer_human: qr.transfer_human || "",
    ...(b.prompts || {}),
  };
}

export function getLanguages(cfg = {}) {
  const b = getBehavior(cfg);
  return b.languages?.length ? b.languages : DEFAULT_LANGUAGES;
}

export function getArchivedCollections(cfg = {}) {
  return getBehavior(cfg).archived_collections || ["vie sur moi", "écrit vie"];
}

export function substitutePlaceholders(text, vars = {}) {
  if (!text) return "";
  return Object.entries(vars).reduce(
    (out, [key, val]) => out.replaceAll(`{${key}}`, val ?? ""),
    text
  );
}

export function buildLanguageBlock(cfg = {}) {
  const b = getBehavior(cfg);
  const langs = getLanguages(cfg).filter((l) => l.enabled);
  const primary = b.primary_language || b.language || "fr";
  const primaryLang = langs.find((l) => l.code === primary) || langs[0];

  if (b.auto_detect_language !== false) {
    const codes = langs.map((l) => l.code).join(", ");
    return [
      `LANGUE: détecte la langue du client et réponds dans la même langue (${codes}).`,
      primaryLang?.reply_instruction ? `Langue par défaut: ${primaryLang.reply_instruction}` : null,
    ].filter(Boolean).join("\n");
  }

  return primaryLang?.reply_instruction || "Réponds en français.";
}

export function buildStyleBlock(cfg = {}) {
  const b = getBehavior(cfg);
  return [
    TONE_MAP[b.tone] || TONE_MAP.premium,
    LENGTH_MAP[b.length] || LENGTH_MAP.medium,
    EMOJI_MAP[b.emoji] || EMOJI_MAP.minimal,
  ].join(" ");
}

/** Blocs personnalisés créés depuis le dashboard (prompts + champs structurés). */
export function buildCustomSectionsBlock(cfg = {}) {
  const sections = getBehavior(cfg).custom_sections || [];
  const blocks = [];

  for (const section of sections) {
    if (!section?.title) continue;
    const fields = section.fields || [];
    const masterToggle = fields.find((f) => f.type === "toggle" && f.key === "enabled");
    if (masterToggle && masterToggle.value === false) continue;

    const lines = [`--- ${section.title.toUpperCase()}`];
    for (const field of fields) {
      if (field.type === "toggle" && field.key === "enabled") continue;
      if (field.type === "toggle" && !field.value) continue;
      if (field.type === "list") {
        const items = (field.value || []).filter(Boolean);
        if (items.length) lines.push(`${field.label || field.key}: ${items.join(", ")}`);
      } else if (field.value != null && String(field.value).trim()) {
        lines.push(`${field.label || field.key}: ${field.value}`);
      }
    }
    if (lines.length > 1) blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n");
}

/** Capacités métier ajoutées par l'admin (en plus des toggles techniques). */
export function buildCustomCapabilitiesBlock(cfg = {}) {
  const caps = getBehavior(cfg).custom_capabilities || [];
  const active = caps.filter((c) => c.enabled !== false && c.instruction?.trim());
  if (!active.length) return "";
  return [
    "--- CAPACITÉS MÉTIER",
    ...active.map((c) => `• ${c.label}: ${c.instruction}`),
  ].join("\n");
}

/** Contexte client (notes, statut, mémoire longue) injecté par conversation. */
export function buildClientContextBlock(client = {}) {
  if (!client || !Object.keys(client).length) return "";
  const lines = ["--- CONTEXTE CLIENT (fiche CRM)"];
  if (client.name) lines.push(`Nom: ${client.name}`);
  if (client.status) lines.push(`Statut: ${client.status}`);
  if (client.tags?.length) lines.push(`Tags: ${client.tags.join(", ")}`);
  if (client.kit_paid === true) lines.push("Kit ambassadeur: payé en boutique");
  if (client.kit_paid === false) lines.push("Kit ambassadeur: non payé — orienter vers la boutique physique");
  if (client.ambassador_applied === true) lines.push("Candidature ambassadeur: déposée sur ambassadeur.vsmcollection.com");
  if (client.summary) lines.push(`Résumé des échanges: ${client.summary}`);
  if (client.notes) lines.push(`Notes internes: ${client.notes}`);
  return lines.join("\n");
}

export function isNightMode(cfg = {}) {
  const b = getBehavior(cfg);
  if (!b.night_mode) return false;
  const h = new Date().getHours();
  return h >= 22 || h < 7;
}

export function buildSystemPrompt(cfg = {}, { catalogContext = "", visionContext = "", extra = "", clientContext = "" } = {}) {
  const parts = [
    cfg.system_prompt || "",
    buildLanguageBlock(cfg),
    buildStyleBlock(cfg),
    buildCustomSectionsBlock(cfg),
    buildCustomCapabilitiesBlock(cfg),
  ];

  if (isNightMode(cfg)) {
    parts.push(getPrompts(cfg).night_mode || DEFAULT_PROMPTS.night_mode);
  }
  if (clientContext) parts.push(clientContext);
  if (visionContext) parts.push(`--- ${visionContext}`);
  if (catalogContext) {
    parts.push(`--- CATALOGUE VSM (source de vérité)\n${catalogContext}`);
    parts.push(`RÈGLES: utilise uniquement ces données pour prix/stock. Ne jamais inventer une disponibilité.`);
  }
  if (extra) parts.push(extra);

  const brand = getBehavior(cfg).brand_name || "VSM Collection";
  const shop = getBehavior(cfg).shop_url || process.env.SITE_URL || "https://www.vsmcollection.com";

  return substitutePlaceholders(parts.filter(Boolean).join("\n\n"), {
    MARQUE: brand,
    BOUTIQUE: shop,
    BRAND: brand,
    SHOP: shop,
  });
}

export function detectArchivedCollection(text, cfg = {}) {
  const q = (text || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  for (const hint of getArchivedCollections(cfg)) {
    const h = hint.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (h && q.includes(h)) return hint;
  }
  return null;
}

export function buildArchivedHint(cfg, label, collectionsSummary) {
  const tpl = getPrompts(cfg).discontinued || DEFAULT_PROMPTS.discontinued;
  return substitutePlaceholders(tpl, {
    COLLECTION: label,
    COLLECTIONS: collectionsSummary,
  });
}
