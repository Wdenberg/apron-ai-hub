import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { ClipboardList, DollarSign, Package, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — ProntoPede" }] }),
  component: Dashboard,
});

type Kpi = {
  ordersToday: number;
  revenueToday: number;
  ordersWeek: number;
  revenueMonth: number;
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

      const [{ data: today }, { data: week }, { data: month }, { data: top }] = await Promise.all([
        supabase.from("orders").select("total").eq("store_id", store.id).gte("created_at", startDay.toISOString()),
        supabase.from("orders").select("id").eq("store_id", store.id).gte("created_at", startWeek.toISOString()),
        supabase.from("orders").select("total").eq("store_id", store.id).gte("created_at", startMonth.toISOString()),
        supabase.from("order_items").select("product_name, quantity").eq("store_id", store.id).gte("created_at", startMonth.toISOString()).limit(500),
      ]);

      const map = new Map<string, number>();
      (top ?? []).forEach((r: { product_name: string; quantity: number }) => {
        map.set(r.product_name, (map.get(r.product_name) ?? 0) + r.quantity);
      });
      const topProduct = [...map.entries()].sort((a,b) => b[1]-a[1])[0]?.[0] ?? null;

      setKpi({
        ordersToday: today?.length ?? 0,
        revenueToday: (today ?? []).reduce((s, r: { total: number }) => s + Number(r.total), 0),
        ordersWeek: week?.length ?? 0,
        revenueMonth: (month ?? []).reduce((s, r: { total: number }) => s + Number(r.total), 0),
        topProduct,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Pedidos hoje", value: kpi?.ordersToday ?? 0, icon: ClipboardList },
    { label: "Vendas hoje", value: formatBRL(kpi?.revenueToday ?? 0), icon: DollarSign },
    { label: "Pedidos (7 dias)", value: kpi?.ordersWeek ?? 0, icon: TrendingUp },
    { label: "Faturamento do mês", value: formatBRL(kpi?.revenueMonth ?? 0), icon: DollarSign },
  ];

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel</h1>
        <p className="text-muted-foreground">Um resumo de como sua loja está indo hoje.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="text-sm text-muted-foreground">{c.label}</div>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <c.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold">{loading ? "—" : c.value}</div>
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