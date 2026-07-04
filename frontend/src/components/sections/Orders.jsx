import { useCallback, useEffect, useState } from "react";
import { Card, OutlineButton, Pill } from "@/components/Primitives";
import { RefreshCw, Package } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const STATUS_TONE = {
  pending: "orange",
  confirmed: "green",
  delivered: "green",
  livree: "green",
  cancelled: "red",
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await api.listOrders());
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
      toast.success("Commande marquée livrée");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Card
      title="Commandes"
      subtitle="Table partagée avec le site · source whatsapp_bot = créées par l'IA"
      action={(
        <OutlineButton onClick={load} disabled={loading}>
          <RefreshCw size={12} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </OutlineButton>
      )}
    >
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
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2">Action</th>
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
                    {o.order_source === "whatsapp_bot" && <Pill tone="red" className="mt-1">Bot WA</Pill>}
                  </td>
                  <td className="py-3 pr-3 text-xs text-[var(--vsm-cream)]">
                    {(o.items || []).map((it, i) => (
                      <div key={i}>{it.product_name} · {it.color} {it.size} ×{it.quantity}</div>
                    ))}
                  </td>
                  <td className="py-3 pr-3 text-xs text-[var(--vsm-grey)]">{o.delivery_date || "—"}</td>
                  <td className="py-3 pr-3 font-mono">{Number(o.total_amount || 0).toLocaleString("fr-FR")} FC</td>
                  <td className="py-3 pr-3">
                    <Pill tone={STATUS_TONE[o.status] || "default"}>{o.status || "—"}</Pill>
                  </td>
                  <td className="py-3">
                    {o.status !== "delivered" && (
                      <OutlineButton onClick={() => markDelivered(o.id)}>
                        <Package size={12} className="mr-1" /> Livré
                      </OutlineButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
