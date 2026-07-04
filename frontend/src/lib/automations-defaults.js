/** Miroir des règles par défaut côté serveur (automations.js) */
export const DEFAULT_AUTOMATIONS = [
  {
    id: "new_order_admin",
    name: "Nouvelle commande → alerte admin WhatsApp",
    trigger: "order_created",
    enabled: true,
    conditions: [],
    actions: [{ type: "whatsapp_notify_admin" }],
  },
  {
    id: "urgent_order_admin",
    name: "Livraison urgente → alerte prioritaire admin",
    trigger: "order_created",
    enabled: true,
    conditions: [{ field: "urgent", op: "eq", value: true }],
    actions: [{ type: "whatsapp_notify_admin", priority: true }],
  },
  {
    id: "delivered_notify",
    name: "Statut livré → notification admin (sync site)",
    trigger: "order_updated",
    enabled: true,
    conditions: [{ field: "status", op: "in", value: ["delivered", "livree", "livré"] }],
    actions: [{ type: "whatsapp_notify_admin", template: "delivered" }],
  },
  {
    id: "courier_assigned",
    name: "Livreur assigné → notification livreur",
    trigger: "order_updated",
    enabled: true,
    conditions: [{ field: "courier_id", op: "changed" }],
    actions: [{ type: "whatsapp_notify_courier" }],
  },
];
