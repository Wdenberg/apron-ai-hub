import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { formatBRL } from "@/lib/format";
import { Users, TrendingUp, AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_admin/dashboard")({
  head: () => ({ meta: [{ title: "Painel admin — ProntoPede" }] }),
  component: AdminDashboard,
});

type Overview = {
  total: number; active: number; trial: number; trial_expired: number;
  past_due: number; blocked: number; canceled: number;
  new_today: number; new_week: number; new_month: number;
  mrr_estimated_cents: number;
  revenue_today_cents: number; revenue_week_cents: number; revenue_month_cents: number; revenue_year_cents: number;
  past_due_amount_cents: number;
};

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_overview");
      if (error) throw error;
      return data as unknown as Overview;
    },
  });

  return (
    <AdminShell title="Visão geral">
      {isLoading || !data ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold mb-3">Empresas</h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              <Kpi label="Total" value={data.total} icon={Users} />
              <Kpi label="Ativos" value={data.active} icon={CheckCircle2} tone="success" />
              <Kpi label="Em teste" value={data.trial} icon={Clock} tone="warning" />
              <Kpi label="Teste expirado" value={data.trial_expired} icon={AlertTriangle} tone="warning" />
              <Kpi label="Inadimplentes" value={data.past_due} icon={AlertTriangle} tone="destructive" />
              <Kpi label="Bloqueados" value={data.blocked} icon={XCircle} tone="destructive" />
              <Kpi label="Cancelados" value={data.canceled} icon={XCircle} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Novos cadastros</h2>
            <div className="grid gap-3 grid-cols-3">
              <Kpi label="Hoje" value={data.new_today} icon={TrendingUp} tone="success" />
              <Kpi label="7 dias" value={data.new_week} icon={TrendingUp} />
              <Kpi label="30 dias" value={data.new_month} icon={TrendingUp} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Financeiro</h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <Kpi label="MRR estimado" value={formatBRL(data.mrr_estimated_cents / 100)} icon={TrendingUp} tone="success" />
              <Kpi label="Receita hoje" value={formatBRL(data.revenue_today_cents / 100)} icon={TrendingUp} />
              <Kpi label="Receita 7d" value={formatBRL(data.revenue_week_cents / 100)} icon={TrendingUp} />
              <Kpi label="Receita 30d" value={formatBRL(data.revenue_month_cents / 100)} icon={TrendingUp} />
              <Kpi label="Receita 12m" value={formatBRL(data.revenue_year_cents / 100)} icon={TrendingUp} />
              <Kpi label="Inadimplência" value={formatBRL(data.past_due_amount_cents / 100)} icon={AlertTriangle} tone="destructive" />
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

function Kpi({
  label, value, icon: Icon, tone,
}: {
  label: string; value: number | string; icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "success" ? "text-success bg-success/10" :
    tone === "warning" ? "text-warning bg-warning/10" :
    tone === "destructive" ? "text-destructive bg-destructive/10" :
    "text-primary bg-primary/10";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
        <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="text-2xl font-bold mt-2 truncate">{value}</div>
    </div>
  );
}