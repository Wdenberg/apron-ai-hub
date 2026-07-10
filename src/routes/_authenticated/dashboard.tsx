import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import {
  ClipboardList,
  DollarSign,
  Package,
  Receipt,
  TrendingUp,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — ProntoPede" }] }),
  component: Dashboard,
});

type Kpi = {
  ordersToday: number;
  revenueToday: number;
  ordersWeek: number;
  // Faturamento do mês (pedidos entregues + pagos, tipo reserva)
  revenueOrdersMonth: number;
  // Vendas rápidas do mês
  quickSalesCount: number;
  quickSalesRevenue: number;
  // Total = pedidos + vendas rápidas
  revenueMonthTotal: number;
  topProduct: string | null;
};

function Dashboard() {
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: store } = await supabase.from("stores").select("id").limit(1).maybeSingle();
      if (!store) { setLoading(false); return; }
      const startDay = new Date(); startDay.setHours(0,0,0,0);
      const startWeek = new Date(); startWeek.setDate(startWeek.getDate() - 7);
      const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0,0,0,0);

      type OrderRow = {
        total: number;
        type: "reserva" | "presencial";
        status: string;
        payment_status: string;
      };

      const [{ data: today }, { data: week }, { data: month }, { data: top }] = await Promise.all([
        supabase
          .from("orders")
          .select("total, type, status, payment_status")
          .eq("store_id", store.id)
          .gte("created_at", startDay.toISOString()),
        supabase
          .from("orders")
          .select("id, type")
          .eq("store_id", store.id)
          .eq("type", "reserva")
          .gte("created_at", startWeek.toISOString()),
        supabase
          .from("orders")
          .select("total, type, status, payment_status")
          .eq("store_id", store.id)
          .gte("created_at", startMonth.toISOString()),
        supabase
          .from("order_items")
          .select("quantity, product:products(name, store_id)")
          .gte("created_at", startMonth.toISOString())
          .limit(500),
      ]);

      const map = new Map<string, number>();
      (top ?? []).forEach((r) => {
        const row = r as { quantity: number; product: { name: string; store_id: string } | null };
        if (!row.product || row.product.store_id !== store.id) return;
        map.set(row.product.name, (map.get(row.product.name) ?? 0) + row.quantity);
      });
      const topProduct = [...map.entries()].sort((a,b) => b[1]-a[1])[0]?.[0] ?? null;

      const isPaid = (r: OrderRow) =>
        r.status === "entregue" && r.payment_status === "pago";

      const todayRows = (today ?? []) as OrderRow[];
      const monthRows = (month ?? []) as OrderRow[];

      const revenueToday = todayRows
        .filter(isPaid)
        .reduce((s, r) => s + Number(r.total), 0);

      const monthPaid = monthRows.filter(isPaid);
      const quickSales = monthPaid.filter((r) => r.type === "presencial");
      const orderSales = monthPaid.filter((r) => r.type === "reserva");

      const quickSalesRevenue = quickSales.reduce((s, r) => s + Number(r.total), 0);
      const revenueOrdersMonth = orderSales.reduce((s, r) => s + Number(r.total), 0);

      setKpi({
        ordersToday: todayRows.filter((r) => r.type === "reserva").length,
        revenueToday,
        ordersWeek: week?.length ?? 0,
        revenueOrdersMonth,
        quickSalesCount: quickSales.length,
        quickSalesRevenue,
        revenueMonthTotal: revenueOrdersMonth + quickSalesRevenue,
        topProduct,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Pedidos hoje", value: kpi?.ordersToday ?? 0, icon: ClipboardList },
    { label: "Vendas hoje", value: formatBRL(kpi?.revenueToday ?? 0), icon: DollarSign },
    { label: "Pedidos (7 dias)", value: kpi?.ordersWeek ?? 0, icon: TrendingUp },
    {
      label: "Vendas rápidas (mês)",
      value: kpi?.quickSalesCount ?? 0,
      icon: Zap,
    },
    {
      label: "Faturamento vendas rápidas",
      value: formatBRL(kpi?.quickSalesRevenue ?? 0),
      icon: Receipt,
    },
    {
      label: "Faturamento total do mês",
      value: formatBRL(kpi?.revenueMonthTotal ?? 0),
      icon: DollarSign,
      highlight: true,
    },
  ];

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel</h1>
        <p className="text-muted-foreground">Um resumo de como sua loja está indo hoje.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border bg-card p-5 ${
              c.highlight ? "border-primary/40 shadow-md shadow-primary/10" : "border-border"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="text-sm text-muted-foreground">{c.label}</div>
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  c.highlight ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                }`}
              >
                <c.icon className="h-4 w-4" />
              </div>
            </div>
            <div className={`mt-3 text-2xl font-bold ${c.highlight ? "text-primary" : ""}`}>
              {loading ? "—" : c.value}
            </div>
            {c.highlight && !loading && (
              <div className="mt-2 text-xs text-muted-foreground">
                Pedidos {formatBRL(kpi?.revenueOrdersMonth ?? 0)} + Vendas rápidas{" "}
                {formatBRL(kpi?.quickSalesRevenue ?? 0)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Produto mais vendido no mês</div>
            <div className="text-lg font-semibold">{loading ? "Calculando..." : kpi?.topProduct ?? "Nenhuma venda registrada ainda"}</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}