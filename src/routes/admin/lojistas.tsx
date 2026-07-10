import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  useAdminStores,
  useSetSubscriptionStatus,
  useActivateWithPlan,
  useCreateLojista,
} from "@/hooks/admin/useAdminStores";
import { AdminShell } from "@/components/AdminShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, whatsappLink } from "@/lib/format";
import { MessageCircle, UserPlus, Ban, CheckCircle2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/admin/lojistas")({
  head: () => ({ meta: [{ title: "Lojistas — Admin ProntoPede" }] }),
  component: LojistasPage,
});

import type { AdminStoreRow as Row, SubscriptionPlan as Plan } from "@/services/admin/adminStoresService";

const PLAN_LABEL: Record<Plan, string> = {
  mensal: "Mensal — R$ 39,90",
  trimestral: "Trimestral — R$ 107,73",
  semestral: "Semestral — R$ 203,49",
  anual: "Anual — R$ 383,04",
};

function LojistasPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [health, setHealth] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useAdminStores({ status, health, search });
  const setStatusMutBase = useSetSubscriptionStatus();
  const activatePlanMutBase = useActivateWithPlan();
  const setStatusMut = {
    ...setStatusMutBase,
    mutate: (payload: { id: string; next: "blocked" | "active" }) =>
      setStatusMutBase.mutate(
        { id: payload.id, status: payload.next },
        {
          onSuccess: () => toast.success("Status atualizado"),
          onError: (e: Error) => toast.error(e.message),
        },
      ),
  };
  const activatePlanMut = {
    ...activatePlanMutBase,
    mutate: (payload: { id: string; plan: Plan }) =>
      activatePlanMutBase.mutate(payload, {
        onSuccess: () => toast.success("Assinatura ativada"),
        onError: (e: Error) => toast.error(e.message),
      }),
  };

  const createFn = useServerFn(adminCreateLojista);
  const createMut = useMutation({
    mutationFn: async (payload: z.infer<typeof createFormSchema>) => {
      return await createFn({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "stores"] });
      setCreateOpen(false);
      toast.success("Lojista criado com sucesso");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = createFormSchema.safeParse({
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      password: fd.get("password"),
      store_name: (fd.get("store_name") as string) || undefined,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    createMut.mutate(parsed.data);
  }

  return (
    <AdminShell title="Lojistas">
      <div className="mb-4 flex flex-wrap gap-3 items-stretch sm:items-center">
        <Input placeholder="Buscar por nome, slug ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:max-w-xs" />
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
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
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Saúde" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda saúde</SelectItem>
            <SelectItem value="green">🟢 Saudável</SelectItem>
            <SelectItem value="yellow">🟡 Atenção</SelectItem>
            <SelectItem value="red">🔴 Crítico</SelectItem>
          </SelectContent>
        </Select>
        <div className="hidden sm:block sm:flex-1" />
        <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}><UserPlus className="h-4 w-4 mr-1" /> Novo lojista</Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Lojista</th>
                <th className="text-left px-4 py-3">E-mail</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Plano</th>
                <th className="text-left px-4 py-3">Trial / Venc.</th>
                <th className="text-left px-4 py-3">Saúde</th>
                <th className="text-left px-4 py-3">Último acesso</th>
                <th className="text-left px-4 py-3">Último pedido</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
              )}
              {!isLoading && !data?.length && (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum lojista encontrado.</td></tr>
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
                  <td className="px-4 py-3 text-xs">{planLabel(s.plan)}</td>
                  <td className="px-4 py-3 text-xs">{trialLabel(s)}</td>
                  <td className="px-4 py-3"><HealthDot value={s.health} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.last_login_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.last_order_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-nowrap items-center justify-end gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            disabled={activatePlanMut.isPending}
                            className="inline-flex items-center gap-1 text-success hover:underline text-xs disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Ativar plano
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ativar conforme pagamento</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {(Object.keys(PLAN_LABEL) as Plan[]).map((p) => (
                            <DropdownMenuItem
                              key={p}
                              onSelect={() => activatePlanMut.mutate({ id: s.id, plan: p })}
                            >
                              {PLAN_LABEL[p]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {s.subscription_status === "blocked" ? (
                        <button
                          onClick={() => setStatusMut.mutate({ id: s.id, next: "active" })}
                          disabled={setStatusMut.isPending}
                          className="inline-flex items-center gap-1 text-success hover:underline text-xs"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Desbloquear
                        </button>
                      ) : (
                        <button
                          onClick={() => { if (confirm(`Bloquear ${s.name}?`)) setStatusMut.mutate({ id: s.id, next: "blocked" }); }}
                          disabled={setStatusMut.isPending}
                          className="inline-flex items-center gap-1 text-destructive hover:underline text-xs"
                        >
                          <Ban className="h-3 w-3" /> Bloquear
                        </button>
                      )}
                      <a href={whatsappLink(s.whatsapp, `Olá ${s.name}, aqui é da ProntoPede!`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-success hover:underline text-xs">
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar conta de lojista</DialogTitle></DialogHeader>
          <form onSubmit={submitCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome do responsável</Label>
              <Input id="name" name="name" required maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store_name">Nome da loja (opcional)</Label>
              <Input id="store_name" name="store_name" maxLength={80} placeholder="Usa o nome do responsável se vazio" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail de acesso</Label>
              <Input id="email" name="email" type="email" required maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input id="phone" name="phone" required maxLength={20} placeholder="(21) 99999-0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha provisória</Label>
              <Input id="password" name="password" type="text" required minLength={8} maxLength={72} placeholder="mín. 8 caracteres" />
              <p className="text-xs text-muted-foreground">O lojista poderá alterar depois no primeiro acesso.</p>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar conta
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

const createFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(80),
  email: z.string().trim().email("E-mail inválido").max(160),
  phone: z.string().trim().min(8, "Telefone inválido").max(20),
  password: z.string().min(8, "Senha muito curta").max(72),
  store_name: z.string().trim().min(2).max(80).optional(),
});

function trialLabel(s: Row) {
  if (s.subscription_status === "trial") {
    return s.trial_days_left > 0 ? `${s.trial_days_left}d restantes` : "expirado";
  }
  if (s.subscription_status === "active") {
    if (s.subscription_ends_at) {
      return `vence ${new Date(s.subscription_ends_at).toLocaleDateString("pt-BR")}`;
    }
    return "assinatura ativa";
  }
  if (s.subscription_status === "past_due") return "pagamento pendente";
  if (s.subscription_status === "blocked") return "bloqueado";
  if (s.subscription_status === "canceled") return "cancelado";
  return "—";
}

function planLabel(plan: Row["plan"]) {
  if (!plan) return <span className="text-muted-foreground">—</span>;
  const map: Record<Plan, string> = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };
  return <span className="font-medium">{map[plan]}</span>;
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