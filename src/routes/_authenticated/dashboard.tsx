import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
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

type OrderRow = {
  total: number;
  type: "reserva" | "presencial";
  status: string;
  payment_status: string;
  created_at: string;
};

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Último ano" },
];

function startOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function bucketFor(days: number): "day" | "week" | "month" {
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  return "month";
}

function bucketKey(d: Date, gran: "day" | "week" | "month"): string {
  const dt = new Date(d);
  if (gran === "day") {
    dt.setHours(0, 0, 0, 0);
    return dt.toISOString().slice(0, 10);
  }
  if (gran === "week") {
    const day = dt.getDay();
    const diff = (day + 6) % 7; // start Monday
    dt.setDate(dt.getDate() - diff);
    dt.setHours(0, 0, 0, 0);
    return dt.toISOString().slice(0, 10);
  }
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function labelKey(key: string, gran: "day" | "week" | "month"): string {
  if (gran === "month") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    });
  }
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function Dashboard() {
  const qc = useQueryClient();
  const [days, setDays] = useState<number>(30);

  const { data: store } = useQuery({
    queryKey: ["my-store"],
    queryFn: async () =>
      (await supabase.from("stores").select("id").maybeSingle()).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", store?.id, days],
    enabled: !!store?.id,
    queryFn: async () => {
      const start = startOfDay(new Date());
      start.setDate(start.getDate() - (days - 1));

      const startMonth = new Date();
      startMonth.setDate(1);
      startMonth.setHours(0, 0, 0, 0);

      const startDay = startOfDay(new Date());

      const earliest = start < startMonth ? start : startMonth;

      const [{ data: rows }, { data: top }] = await Promise.all([
        supabase
          .from("orders")
          .select("total, type, status, payment_status, created_at")
          .eq("store_id", store!.id)
          .gte("created_at", earliest.toISOString()),
        supabase
          .from("order_items")
          .select("quantity, product:products(name, store_id)")
          .gte("created_at", startMonth.toISOString())
          .limit(500),
      ]);

      const all = (rows ?? []) as OrderRow[];
      const isPaid = (r: OrderRow) =>
        r.status === "entregue" && r.payment_status === "pago";

      const inPeriod = all.filter((r) => new Date(r.created_at) >= start);
      const inMonth = all.filter((r) => new Date(r.created_at) >= startMonth);
      const inToday = all.filter((r) => new Date(r.created_at) >= startDay);
      const inWeek = all.filter((r) => {
        const w = new Date();
        w.setDate(w.getDate() - 7);
        return new Date(r.created_at) >= w;
      });

      const monthPaid = inMonth.filter(isPaid);
      const quickSalesMonth = monthPaid.filter((r) => r.type === "presencial");
      const orderSalesMonth = monthPaid.filter((r) => r.type === "reserva");

      // Build chart series for quick sales in selected period
      const gran = bucketFor(days);
      const seriesMap = new Map<string, { revenue: number; count: number }>();
      inPeriod
        .filter(isPaid)
        .filter((r) => r.type === "presencial")
        .forEach((r) => {
          const k = bucketKey(new Date(r.created_at), gran);
          const cur = seriesMap.get(k) ?? { revenue: 0, count: 0 };
          cur.revenue += Number(r.total);
          cur.count += 1;
          seriesMap.set(k, cur);
        });

      // Fill missing buckets
      const buckets: string[] = [];
      const cursor = new Date(start);
      const end = new Date();
      while (cursor <= end) {
        buckets.push(bucketKey(cursor, gran));
        if (gran === "day") cursor.setDate(cursor.getDate() + 1);
        else if (gran === "week") cursor.setDate(cursor.getDate() + 7);
        else cursor.setMonth(cursor.getMonth() + 1);
      }
      const uniqueBuckets = Array.from(new Set(buckets));
      const series = uniqueBuckets.map((k) => ({
        key: k,
        label: labelKey(k, gran),
        revenue: seriesMap.get(k)?.revenue ?? 0,
        count: seriesMap.get(k)?.count ?? 0,
      }));

      const map = new Map<string, number>();
      (top ?? []).forEach((r) => {
        const row = r as {
          quantity: number;
          product: { name: string; store_id: string } | null;
        };
        if (!row.product || row.product.store_id !== store!.id) return;
        map.set(row.product.name, (map.get(row.product.name) ?? 0) + row.quantity);
      });
      const topProduct =
        [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const revenueOrdersMonth = orderSalesMonth.reduce(
        (s, r) => s + Number(r.total),
        0,
      );
      const quickSalesRevenue = quickSalesMonth.reduce(
        (s, r) => s + Number(r.total),
        0,
      );

      return {
        ordersToday: inToday.filter((r) => r.type === "reserva").length,
        revenueToday: inToday
          .filter(isPaid)
          .reduce((s, r) => s + Number(r.total), 0),
        ordersWeek: inWeek.filter((r) => r.type === "reserva").length,
        revenueOrdersMonth,
        quickSalesCount: quickSalesMonth.length,
        quickSalesRevenue,
        revenueMonthTotal: revenueOrdersMonth + quickSalesRevenue,
        topProduct,
        series,
        granularity: gran,
      };
    },
  });

  // Realtime: refresh on any order change for the store
  useEffect(() => {
    if (!store?.id) return;
    const channel = supabase
      .channel(`orders-dashboard-${store.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${store.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [store?.id, qc]);

  const cards = useMemo(
    () => [
      { label: "Pedidos hoje", value: data?.ordersToday ?? 0, icon: ClipboardList },
      {
        label: "Vendas hoje",
        value: formatBRL(data?.revenueToday ?? 0),
        icon: DollarSign,
      },
      { label: "Pedidos (7 dias)", value: data?.ordersWeek ?? 0, icon: TrendingUp },
      {
        label: "Vendas rápidas (mês)",
        value: data?.quickSalesCount ?? 0,
        icon: Zap,
      },
      {
        label: "Faturamento vendas rápidas",
        value: formatBRL(data?.quickSalesRevenue ?? 0),
        icon: Receipt,
      },
      {
        label: "Faturamento total do mês",
        value: formatBRL(data?.revenueMonthTotal ?? 0),
        icon: DollarSign,
        highlight: true,
      },
    ],
    [data],
  );

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel</h1>
          <p className="text-muted-foreground">
            Um resumo de como sua loja está indo hoje.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border bg-card p-5 transition-all duration-300 ${
              c.highlight
                ? "border-primary/40 shadow-md shadow-primary/10"
                : "border-border"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="text-sm text-muted-foreground">{c.label}</div>
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  c.highlight
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <c.icon className="h-4 w-4" />
              </div>
            </div>
            <div
              className={`mt-3 text-2xl font-bold transition-all duration-300 ${
                c.highlight ? "text-primary" : ""
              }`}
            >
              {isLoading ? <Skeleton className="h-7 w-24" /> : c.value}
            </div>
            {c.highlight && !isLoading && (
              <div className="mt-2 text-xs text-muted-foreground">
                Pedidos {formatBRL(data?.revenueOrdersMonth ?? 0)} + Vendas rápidas{" "}
                {formatBRL(data?.quickSalesRevenue ?? 0)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Faturamento das vendas rápidas</h2>
            <p className="text-xs text-muted-foreground">
              Agrupado por{" "}
              {data?.granularity === "day"
                ? "dia"
                : data?.granularity === "week"
                  ? "semana"
                  : "mês"}
            </p>
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !data?.series?.some((s) => s.count > 0) ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
            Nenhuma venda rápida encontrada para este período.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
                  }
                />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name) => {
                    if (name === "revenue")
                      return [formatBRL(value), "Faturamento"];
                    return [value, "Vendas"];
                  }}
                  labelFormatter={(l) => `Período: ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">
              Produto mais vendido no mês
            </div>
            <div className="text-lg font-semibold">
              {isLoading
                ? "Calculando..."
                : (data?.topProduct ?? "Nenhuma venda registrada ainda")}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}