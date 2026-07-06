/**
 * State machine vente VSM — flux obligatoire :
 * disponibilité → taille → couleur → confirmation stock → commande
 */

import { parseSize, parseColor } from "./intent-analyzer.js";

export const SALE_STATES = {
  IDLE: "idle",
  COLLECTION_PICK: "collection_pick",
  ASK_SIZE: "ask_size",
  ASK_COLOR: "ask_color",
  STOCK_READY: "stock_ready",
  CONFIRM_ORDER: "confirm_order",
};

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

export function emptySaleFlow() {
  return {
    state: SALE_STATES.IDLE,
    product_id: null,
    product_name: null,
    size: null,
    color: null,
    known_colors: [],
    updated_at: new Date().toISOString(),
  };
}

export function getSaleFlow(profile = {}) {
  const raw = profile?.sale_flow;
  if (!raw || typeof raw !== "object") return emptySaleFlow();
  return { ...emptySaleFlow(), ...raw };
}

function uniqueColors(variants = []) {
  return [...new Set(variants.map((v) => v.color).filter(Boolean))];
}

function uniqueSizes(variants = []) {
  const order = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
  const sizes = [...new Set(variants.map((v) => (v.size || "").toUpperCase()).filter(Boolean))];
  return sizes.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function variantStock(variants, size, color) {
  const v = (variants || []).find(
    (x) => norm(x.size) === norm(size) && norm(x.color) === norm(color)
  );
  return v ? Number(v.stock) || 0 : 0;
}

/**
 * Met à jour le flux vente selon intention + résultat catalogue.
 * Retourne { saleFlow, instructionBlock, facts, resetPinned }
 */
export function advanceSaleFlow({
  profile = {},
  intent = {},
  catalog = {},
  userText = "",
  orderActive = false,
}) {
  if (orderActive) {
    return { saleFlow: getSaleFlow(profile), instructionBlock: "", facts: null, resetPinned: false };
  }

  let flow = getSaleFlow(profile);
  const variants = catalog.variants || [];
  const product = catalog.primary;
  const matchType = catalog.matchType || "none";

  if (intent.primary === "cancel" && flow.state !== SALE_STATES.IDLE) {
    flow = emptySaleFlow();
    return {
      saleFlow: flow,
      instructionBlock: buildInstructionBlock(flow, { reset: true }),
      facts: null,
      resetPinned: true,
    };
  }

  // Nouvelle collection mentionnée → réinitialiser si produit différent
  if (product && matchType === "exact" && flow.product_id && flow.product_id !== product.id) {
    if (intent.all.includes("collection") || intent.all.includes("availability") || intent.all.includes("price")) {
      flow = { ...emptySaleFlow(), product_id: product.id, product_name: product.name };
    }
  }

  if (matchType === "ambiguous") {
    flow = { ...emptySaleFlow(), state: SALE_STATES.COLLECTION_PICK };
    return {
      saleFlow: flow,
      instructionBlock: buildAmbiguousBlock(catalog.candidates),
      facts: { type: "ambiguous", candidates: catalog.candidates },
      resetPinned: true,
    };
  }

  if (matchType === "none" && (intent.all.includes("collection") || intent.all.includes("availability"))) {
    flow = emptySaleFlow();
    return {
      saleFlow: flow,
      instructionBlock: buildNotInCatalogBlock(catalog.availableNames),
      facts: { type: "not_found" },
      resetPinned: true,
    };
  }

  if (product && matchType === "exact") {
    flow.product_id = product.id;
    flow.product_name = product.name;
    flow.known_colors = uniqueColors(variants);
    const sizes = uniqueSizes(variants);

    if (!flow.size && intent.size) flow.size = intent.size;
    if (!flow.color && intent.color) flow.color = intent.color;

    if (flow.state === SALE_STATES.IDLE || flow.state === SALE_STATES.COLLECTION_PICK) {
      if (intent.all.includes("availability") || intent.all.includes("collection") || intent.all.includes("price")) {
        flow.state = SALE_STATES.ASK_SIZE;
        return {
          saleFlow: flow,
          instructionBlock: buildAskSizeBlock(product, sizes),
          facts: { type: "available", product: product.name, sizes },
          resetPinned: false,
        };
      }
    }

    if (flow.state === SALE_STATES.ASK_SIZE || (!flow.size && intent.size)) {
      if (intent.size || flow.size) {
        flow.size = intent.size || flow.size;
        flow.state = SALE_STATES.ASK_COLOR;
        const colorsForSize = uniqueColors(
          variants.filter((v) => norm(v.size) === norm(flow.size))
        );
        return {
          saleFlow: flow,
          instructionBlock: buildAskColorBlock(product, flow.size, colorsForSize),
          facts: { type: "need_color", product: product.name, size: flow.size },
          resetPinned: false,
        };
      }
    }

    if (flow.state === SALE_STATES.ASK_COLOR || (!flow.color && intent.color && flow.size)) {
      flow.color = intent.color || flow.color;
      if (flow.size && flow.color) {
        const stock = variantStock(variants, flow.size, flow.color);
        flow.state = stock > 0 ? SALE_STATES.STOCK_READY : SALE_STATES.ASK_COLOR;
        return {
          saleFlow: flow,
          instructionBlock: buildStockBlock(product, flow.size, flow.color, stock),
          facts: { type: "stock", product: product.name, size: flow.size, color: flow.color, stock },
          resetPinned: false,
        };
      }
    }

    if (flow.state === SALE_STATES.STOCK_READY && intent.all.includes("order")) {
      flow.state = SALE_STATES.CONFIRM_ORDER;
      return {
        saleFlow: flow,
        instructionBlock: buildConfirmOrderBlock(flow),
        facts: { type: "ready_order", ...flow },
        resetPinned: false,
      };
    }

    // Suivi court (oui, ok, etc.) dans un flux actif
    if (flow.state !== SALE_STATES.IDLE && intent.isShort) {
      return {
        saleFlow: flow,
        instructionBlock: buildFollowUpBlock(flow),
        facts: null,
        resetPinned: false,
      };
    }
  }

  return { saleFlow: flow, instructionBlock: "", facts: null, resetPinned: false };
}

function buildAmbiguousBlock(candidates = []) {
  const names = candidates.map((c) => c.name).slice(0, 4).join(", ");
  return [
    "--- FLUX VENTE (étape: clarification collection)",
    `Plusieurs collections correspondent. Demande poliment laquelle le client veut : ${names}.`,
    "Ne cite pas de stock ni de prix tant que la collection n'est pas confirmée.",
    "1 à 2 phrases, ton conseiller VSM.",
  ].join("\n");
}

function buildNotInCatalogBlock(availableNames = []) {
  const list = availableNames.length ? availableNames.join(", ") : "nos collections officielles VSM Collection";
  return [
    "--- FLUX VENTE (collection non reconnue)",
    `Cette collection ne fait pas partie de nos collections actuellement commercialisées.`,
    `Oriente naturellement vers : ${list}.`,
    "Ne dis jamais « introuvable en base », « erreur » ou « pas dans la DB ».",
    "1 à 2 phrases maximum.",
  ].join("\n");
}

function buildAskSizeBlock(product, sizes = []) {
  const hint = sizes.length ? `Tailles disponibles : ${sizes.join(", ")}.` : "";
  return [
    "--- FLUX VENTE (étape: taille)",
    `Le client s'intéresse à « ${product.name} ».`,
    "Confirme que la collection est disponible, SANS donner de stock détaillé.",
    "Demande ensuite quelle taille il recherche.",
    hint,
    "Interdit : annoncer des quantités ou couleurs avant la taille.",
    "1 à 2 phrases.",
  ].join("\n");
}

function buildAskColorBlock(product, size, colors = []) {
  const hint = colors.length ? `Couleurs pour cette taille : ${colors.join(", ")}.` : "";
  return [
    "--- FLUX VENTE (étape: couleur)",
    `Collection : ${product.name}, taille : ${size}.`,
    "Demande quelle couleur le client souhaite.",
    hint,
    "Ne donne pas encore de quantité en stock.",
    "1 à 2 phrases.",
  ].join("\n");
}

function buildStockBlock(product, size, color, stock) {
  if (stock > 0) {
    return [
      "--- FLUX VENTE (étape: disponibilité confirmée)",
      `Données vérifiées : ${product.name}, ${color}, taille ${size} — disponible.`,
      "Confirme naturellement la disponibilité. Propose de finaliser la commande.",
      "Ne invente pas d'autres variantes.",
      "1 à 2 phrases.",
    ].join("\n");
  }
  return [
    "--- FLUX VENTE (rupture)",
    `Données vérifiées : ${product.name}, ${color}, taille ${size} — épuisé.`,
    "Dis poliment que cette combinaison n'est plus disponible. Propose une autre couleur ou taille.",
    "1 à 2 phrases.",
  ].join("\n");
}

function buildConfirmOrderBlock(flow) {
  return [
    "--- FLUX VENTE (prêt commande)",
    `Article : ${flow.product_name}, ${flow.color}, taille ${flow.size}.`,
    "Guide le client vers la commande (nom, téléphone, adresse, livraison).",
    "1 à 2 phrases.",
  ].join("\n");
}

function buildFollowUpBlock(flow) {
  const step = {
    [SALE_STATES.ASK_SIZE]: "redemande la taille",
    [SALE_STATES.ASK_COLOR]: "redemande la couleur",
    [SALE_STATES.STOCK_READY]: "propose de passer commande",
    [SALE_STATES.CONFIRM_ORDER]: "continue la collecte commande",
  }[flow.state] || "continue naturellement";
  return [
    "--- FLUX VENTE (suivi)",
    `Étape en cours : ${flow.state}. ${step}.`,
    "1 à 2 phrases.",
  ].join("\n");
}

function buildInstructionBlock(flow, { reset = false } = {}) {
  if (reset) {
    return "--- FLUX VENTE réinitialisé. Réponds normalement au client.";
  }
  return "";
}
