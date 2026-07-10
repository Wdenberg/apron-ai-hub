import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatBRL } from "@/lib/format";
import { useDashboard } from "@/hooks/useDashboard";
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

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Último ano" },
];

function Dashboard() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading } = useDashboard(days);

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