import { useCallback, useEffect, useState } from "react";
import { Card, OutlineButton, Pill, RedButton, Input, Select } from "@/components/Primitives";
import { RefreshCw, Package, Zap, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const STATUS_TONE = {
  pending: "orange",
  confirmed: "green",
  delivered: "green",
  livree: "green",
  cancelled: "red",
};

function isUrgent(order) {
  return (order.notes || "").includes("URGENT");
}

const EMPTY_FORM = {
  customer_name: "",
  customer_phone: "",
  delivery_address: "",
  delivery_date: "",
  product_name: "",
  size: "",
  color: "",
  quantity: 1,
  unit_price: "",
  urgent: false,
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, c] = await Promise.all([api.listOrders(), api.listCouriers().catch(() => [])]);
      setOrders(o);
      setCouriers(c);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markDelivered = async (id) => {
    try {
      await api.updateOrder(id, { status: "delivered" });
      toast.success("Commande marquée livrée (sync site)");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const assignCourier = async (id, courierId) => {
    try {
      await api.updateOrder(id, { courier_id: courierId || null });
      toast.success("Livreur assigné");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleUrgent = async (order) => {
    try {
      await api.updateOrder(order.id, { urgent: !isUrgent(order) });
      toast.success(isUrgent(order) ? "Urgence retirée" : "Marquée urgente");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const submitForm = async () => {
    if (!form.customer_name || !form.customer_phone || !form.product_name) {
      toast.error("Nom, téléphone et produit requis");
      return;
    }
    try {
      await api.createOrder({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        delivery_address: form.delivery_address,
        delivery_date: form.delivery_date,
        urgent: form.urgent,
        order_source: "dashboard",
        items: [{
          product_name: form.product_name,
          size: form.size,
          color: form.color,
          quantity: Number(form.quantity) || 1,
          unit_price: Number(form.unit_price) || 0,
        }],
      });
      toast.success("Commande créée");
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const courierOptions = [
    { value: "", label: "— Aucun —" },
    ...couriers.map((c) => ({ value: String(c.id), label: c.name || c.phone || `Livreur ${c.id}` })),
  ];

  return (
    <div className="space-y-4">
      <Card
        title="Commandes"
        subtitle="Table partagée avec le site · source whatsapp_bot = créées par l'IA"
        action={(
          <div className="flex flex-wrap gap-2">
            <OutlineButton onClick={() => setShowForm((v) => !v)}>
              <Plus size={12} className="mr-1" /> {showForm ? "Fermer" : "Nouvelle"}
            </OutlineButton>
            <OutlineButton onClick={load} disabled={loading}>
              <RefreshCw size={12} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </OutlineButton>
          </div>
        )}
      >
        {showForm && (
          <div className="mb-6 p-4 border border-[var(--vsm-border)] bg-[var(--vsm-void)] grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Nom client" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            <Input placeholder="Téléphone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            <Input placeholder="Adresse livraison" value={form.delivery_address} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} className="sm:col-span-2" />
            <Input placeholder="Date/heure livraison" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
            <Input placeholder="Produit" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            <Input placeholder="Taille" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
            <Input placeholder="Couleur" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            <Input placeholder="Prix unitaire (FC)" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} type="number" />
            <label className="flex items-center gap-2 text-sm text-[var(--vsm-cream)] sm:col-span-2">
              <input type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} />
              <Zap size={14} className="text-[var(--vsm-red)]" /> Livraison urgente
            </label>
            <RedButton onClick={submitForm} className="sm:col-span-2 w-fit">Créer la commande</RedButton>
          </div>
        )}

        {orders.length === 0 ? (
          <p className="text-sm text-[var(--vsm-grey)]">Aucune commande pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--vsm-grey)] border-b border-[var(--vsm-border)]">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Articles</th>
                  <th className="py-2 pr-3">Livraison</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Livreur</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-[var(--vsm-border)] align-top">
                    <td className="py-3 pr-3 font-mono text-[var(--vsm-grey)]">{o.id}</td>
                    <td className="py-3 pr-3">
                      <div className="text-[var(--vsm-white)]">{o.customer_name}</div>
                      <div className="text-xs text-[var(--vsm-grey)]">{o.customer_phone}</div>
                      <div className="text-xs text-[var(--vsm-grey-2)] truncate max-w-[180px]">{o.delivery_address}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {o.order_source === "whatsapp_bot" && <Pill tone="red">Bot WA</Pill>}
                        {isUrgent(o) && <Pill tone="orange"><Zap size={10} className="inline mr-0.5" />Urgent</Pill>}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-xs text-[var(--vsm-cream)]">
                      {(o.items || []).map((it, i) => (
                        <div key={i}>{it.product_name} · {it.color} {it.size} ×{it.quantity}</div>
                      ))}
                    </td>
                    <td className="py-3 pr-3 text-xs text-[var(--vsm-grey)]">{o.delivery_date || "—"}</td>
                    <td className="py-3 pr-3 font-mono">{Number(o.total_amount || 0).toLocaleString("fr-FR")} FC</td>
                    <td className="py-3 pr-3">
                      {couriers.length > 0 ? (
                        <Select
                          value={o.courier_id ? String(o.courier_id) : ""}
                          onChange={(e) => assignCourier(o.id, e.target.value || null)}
                          className="text-xs min-w-[120px]"
                        >
                          {courierOptions.map((opt) => (
                            <option key={opt.value || "none"} value={opt.value}>{opt.label}</option>
                          ))}
                        </Select>
                      ) : (
                        <span className="text-xs text-[var(--vsm-grey)]">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <Pill tone={STATUS_TONE[o.status] || "default"}>{o.status || "—"}</Pill>
                    </td>
                    <td className="py-3 space-y-1">
                      {o.status !== "delivered" && (
                        <OutlineButton onClick={() => markDelivered(o.id)}>
                          <Package size={12} className="mr-1" /> Livré
                        </OutlineButton>
                      )}
                      <OutlineButton onClick={() => toggleUrgent(o)} className="block mt-1">
                        <Zap size={12} className="mr-1" /> {isUrgent(o) ? "Retirer urgent" : "Urgent"}
                      </OutlineButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
