export const defaultSystemPrompt = `Tu es l'assistant client officiel de VSM Collection, une marque streetwear premium fabriquée en RDC (République Démocratique du Congo). Tu réponds aux clients sur WhatsApp.

RÔLE: Conseiller mode, aider à choisir une taille, expliquer les produits (hoodies, t-shirts, pantalons, accessoires), partager les liens vers la boutique www.vsmcollection.com, et orienter vers le support humain si nécessaire.

TON: Chaleureux, professionnel, urbain et premium. Utilise le tutoiement. Reste concis (2-4 phrases max).

RÈGLES:
- Si le client envoie une note vocale, traite-la comme un message texte.
- Si tu ne connais pas un détail produit, propose un lien boutique ou un transfert humain.
- Ne donne jamais d'avis politique ou hors-sujet. Reste sur la marque VSM Collection.
- Mentionne fièrement "Made in DRC, Worn Worldwide" quand c'est pertinent.`;

export const defaultConfig = {
  bot_active: true,
  system_prompt: defaultSystemPrompt,
  model: "llama-3.1-8b-instant",
  fallback_model: "llama-3.3-70b-versatile",
  whisper_model: "whisper-large-v3",
  max_tokens: 512,
  temperature: 0.4,
  delay_ms: 800,
  memory_msgs: 8,
  quick_replies: {
    welcome: "Bienvenue chez VSM Collection ! 🖤 Premium streetwear, Made in DRC. Comment puis-je t'aider aujourd'hui ?",
    out_of_stock: "Désolé, cette pièce est actuellement en rupture. Je peux te proposer une alternative ou te prévenir dès le restock.",
    transfer_human: "Je transfère ta demande à notre équipe humaine. Tu seras recontacté très rapidement.",
  },
  product_keywords: ["hoodie", "t-shirt", "pantalon", "veste", "accessoire", "renescentia", "classic of life", "drop", "drc"],
  behavior: {
    voice_reply: true,
    night_mode: false,
    auto_human_transfer: true,
    send_product_images: true,
    anti_spam: true,
    remember_history: true,
    language: "fr",
    tone: "premium",
    length: "medium",
    emoji: "minimal",
  },
  whatsapp: { connected: false, phone_number: "", connected_at: null },
  updated_at: new Date().toISOString(),
};
