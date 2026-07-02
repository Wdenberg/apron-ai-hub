import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, whatsappLink } from "@/lib/format";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_admin/lojistas")({
  head: () => ({ meta: [{ title: "Lojistas — Admin ProntoPede" }] }),
  component: LojistasPage,
});

type Row = {
  id: string; name: string; slug: string; owner_email: string | null;
  subscription_status: string; trial_days_left: number; last_login_at: string | null;
  last_order_at: string | null; health: "green" | "yellow" | "red"; created_at: string;
  whatsapp: string;
};

function LojistasPage() {
  const [status, setStatus] = useState<string>("");
  const [health, setHealth] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stores", status, health, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_stores", {
        _status: status || null,
        _health: health || null,
        _search: search || null,
        _limit: 100,
        _offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <AdminShell title="Lojistas">
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <Input placeholder="Buscar por nome, slug ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="trial">Em teste</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="past_due">Inadimplente</SelectItem>
            <SelectItem value="blocked">Bloqueado</SelectItem>
            <SelectItem value="canceled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={health || "all"} onValueChange={(v) => setHealth(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Saúde" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda saúde</SelectItem>
            <SelectItem value="green">🟢 Saudável</SelectItem>
            <SelectItem value="yellow">🟡 Atenção</SelectItem>
            <SelectItem value="red">🔴 Crítico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Lojista</th>
                <th className="text-left px-4 py-3">E-mail</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Trial</th>
                <th className="text-left px-4 py-3">Saúde</th>
                <th className="text-left px-4 py-3">Último acesso</th>
                <th className="text-left px-4 py-3">Último pedido</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
              )}
              {!isLoading && !data?.length && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum lojista encontrado.</td></tr>
              )}
              {data?.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to="/admin/lojistas/$id" params={{ id: s.id }} className="font-semibold text-primary hover:underline">
                      {s.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">/{s.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.owner_email ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={s.subscription_status} /></td>
                  <td className="px-4 py-3 text-xs">
                    {s.subscription_status === "trial" ? `${s.trial_days_left}d restantes` : "—"}
                  </td>
                  <td className="px-4 py-3"><HealthDot value={s.health} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.last_login_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.last_order_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={whatsappLink(s.whatsapp, `Olá ${s.name}, aqui é da ProntoPede!`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-success hover:underline text-xs">
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function StatusBadge({ value }: { value: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Ativo", className: "bg-success/15 text-success" },
    trial: { label: "Teste", className: "bg-warning/15 text-warning" },
    past_due: { label: "Inadimplente", className: "bg-destructive/15 text-destructive" },
    blocked: { label: "Bloqueado", className: "bg-destructive/20 text-destructive" },
    canceled: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
  };
  const s = map[value] ?? { label: value, className: "bg-muted text-muted-foreground" };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.className}`}>{s.label}</span>;
}

function HealthDot({ value }: { value: "green" | "yellow" | "red" }) {
  const color = value === "green" ? "bg-success" : value === "yellow" ? "bg-warning" : "bg-destructive";
  const label = value === "green" ? "Saudável" : value === "yellow" ? "Atenção" : "Crítico";
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

// keep formatBRL referenced to satisfy tree-shaker in strict mode
export const _formatBRL = formatBRL;