import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { whatsappLink } from "@/lib/format";
import { MessageCircle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/trial")({
  head: () => ({ meta: [{ title: "Trial & recuperação — Admin" }] }),
  component: TrialPage,
});

type Metrics = { converted: number; expired: number; still_trialing: number; canceled: number; reasons: Record<string, number> };
type Recovery = { store_id: string; name: string; whatsapp: string; days_since_trial: number; owner_email: string | null; reason: string | null };

function TrialPage() {
  const [window, setWindow] = useState(30);
  const metrics = useQuery({
    queryKey: ["admin", "trial-metrics", window],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_trial_metrics", { _window_days: window });
      if (error) throw error;
      return data as unknown as Metrics;
    },
  });
  const list = useQuery({
    queryKey: ["admin", "recovery"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_recovery_list");
      if (error) throw error;
      return (data ?? []) as Recovery[];
    },
  });

  const total = (metrics.data?.converted ?? 0) + (metrics.data?.expired ?? 0) + (metrics.data?.canceled ?? 0);
  const convRate = total ? Math.round(((metrics.data?.converted ?? 0) / total) * 100) : 0;

  return (
    <AdminShell title="Trial & recuperação">
      <div className="mb-4 flex gap-2 items-center">
        <span className="text-sm text-muted-foreground">Janela:</span>
        {[30, 60, 90].map((w) => (
          <button key={w} onClick={() => setWindow(w)} className={`text-xs px-3 py-1.5 rounded-full font-medium ${window === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
            {w}d
          </button>
        ))}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5 mb-8">
        <MetricCard label="Conversão" value={`${convRate}%`} tone="success" />
        <MetricCard label="Converteram" value={metrics.data?.converted ?? 0} />
        <MetricCard label="Expiraram" value={metrics.data?.expired ?? 0} tone="warning" />
        <MetricCard label="Cancelaram" value={metrics.data?.canceled ?? 0} tone="destructive" />
        <MetricCard label="Ainda testando" value={metrics.data?.still_trialing ?? 0} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border font-semibold">Lojistas para recuperar</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Loja</th>
                  <th className="text-left px-4 py-2">Dias</th>
                  <th className="text-left px-4 py-2">Motivo</th>
                  <th className="text-right px-4 py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>}
                {list.data?.map((r) => (
                  <tr key={r.store_id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.owner_email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{r.days_since_trial}d</td>
                    <td className="px-4 py-3 text-xs capitalize">{r.reason ?? "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <a href={whatsappLink(r.whatsapp, `Olá ${r.name}, notei que o seu teste da ProntoPede terminou. Posso te ajudar?`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-success hover:underline text-xs">
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    </td>
                  </tr>
                ))}
                {list.data && !list.data.length && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Ninguém para recuperar 🎉</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-3">Motivos de desistência</h3>
          {metrics.data?.reasons && Object.keys(metrics.data.reasons).length ? (
            <div className="space-y-3">
              {Object.entries(metrics.data.reasons).map(([reason, count]) => {
                const max = Math.max(...Object.values(metrics.data!.reasons));
                return (
                  <div key={reason}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize">{reason.replace(/_/g, " ")}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Nenhum motivo registrado ainda.</div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number | string; tone?: "success" | "warning" | "destructive" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}