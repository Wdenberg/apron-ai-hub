import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatBRL, whatsappLink } from "@/lib/format";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/admin/lojistas/$id")({
  head: () => ({ meta: [{ title: "Detalhe do lojista — Admin" }] }),
  component: LojistaDetail,
});

type Detail = {
  store: {
    id: string; name: string; slug: string; description: string | null;
    whatsapp: string; city: string | null; state: string | null; address: string | null;
    subscription_status: string; trial_ends_at: string; last_login_at: string | null;
    is_open: boolean; created_at: string; health: "green" | "yellow" | "red";
    owner_email: string | null;
  };
  total_orders: number;
  total_revenue_cents: number;
  churn_reason: { reason: string; note: string | null; created_at: string } | null;
  actions: { action: string; payload: Record<string, unknown>; created_at: string }[];
  notes: { note: string; created_at: string }[];
};

function LojistaDetail() {
  const { id } = useParams({ from: "/admin/lojistas/$id" });
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [days, setDays] = useState("7");
  const [newStatus, setNewStatus] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "store", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_store_detail", { _store_id: id });
      if (error) throw error;
      return data as unknown as Detail;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "store", id] });

  const changeStatus = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_set_subscription_status", { _store_id: id, _status: newStatus as never, _reason: reason || undefined });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); invalidate(); setNewStatus(""); setReason(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const extendTrial = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_extend_trial", { _store_id: id, _days: parseInt(days, 10) });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Trial estendido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_add_note", { _store_id: id, _note: note });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Nota salva"); setNote(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <AdminShell title="Lojista"><div className="text-muted-foreground">Carregando...</div></AdminShell>;
  const s = data.store;

  return (
    <AdminShell title={s.name}>
      <Link to="/admin/lojistas" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold">{s.name}</h1>
                <div className="text-sm text-muted-foreground">/loja/{s.slug} · {s.owner_email ?? "sem e-mail"}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {[s.address, s.city, s.state].filter(Boolean).join(", ") || "sem endereço"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <a href={whatsappLink(s.whatsapp, `Olá ${s.name}, aqui é da ProntoPede!`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-success hover:underline text-sm">
                  <MessageCircle className="h-4 w-4" /> {s.whatsapp}
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-sm">
              <div><div className="text-xs text-muted-foreground uppercase">Status</div><div className="font-semibold mt-1">{s.subscription_status}</div></div>
              <div><div className="text-xs text-muted-foreground uppercase">Trial acaba</div><div className="font-semibold mt-1">{new Date(s.trial_ends_at).toLocaleDateString("pt-BR")}</div></div>
              <div><div className="text-xs text-muted-foreground uppercase">Pedidos</div><div className="font-semibold mt-1">{data.total_orders}</div></div>
              <div><div className="text-xs text-muted-foreground uppercase">Receita</div><div className="font-semibold mt-1">{formatBRL(data.total_revenue_cents / 100)}</div></div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-3">Timeline de ações do admin</h2>
            {!data.actions.length && <div className="text-sm text-muted-foreground">Nenhuma ação registrada.</div>}
            <div className="space-y-2">
              {data.actions.map((a, i) => (
                <div key={i} className="text-sm border-l-2 border-primary/40 pl-3">
                  <div className="font-medium">{a.action}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")} · {JSON.stringify(a.payload)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-3">Notas internas</h2>
            <div className="space-y-2 mb-4">
              {data.notes.map((n, i) => (
                <div key={i} className="text-sm bg-muted/40 rounded-lg p-3">
                  <div>{n.note}</div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adicionar nota..." rows={2} maxLength={500} className="flex-1" />
              <Button className="w-full sm:w-auto shrink-0" onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending}>Salvar</Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Estender teste</h3>
            <div className="flex flex-nowrap gap-2">
              <Input type="number" min="1" max="90" value={days} onChange={(e) => setDays(e.target.value)} className="w-24 shrink-0" />
              <Button className="flex-1 sm:flex-none shrink-0" onClick={() => extendTrial.mutate()} disabled={extendTrial.isPending}>+ dias</Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Alterar assinatura</h3>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger><SelectValue placeholder="Escolher status..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Teste</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="past_due">Inadimplente</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)" className="mt-2" maxLength={200} />
            <Button className="w-full mt-2" disabled={!newStatus || changeStatus.isPending} onClick={() => changeStatus.mutate()}>Aplicar</Button>
          </div>

          <ChurnCard storeId={id} current={data.churn_reason} onDone={invalidate} />
        </div>
      </div>
    </AdminShell>
  );
}

function ChurnCard({ storeId, current, onDone }: { storeId: string; current: Detail["churn_reason"]; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_register_churn", { _store_id: storeId, _reason: reason as never, _note: note || undefined });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Motivo registrado"); onDone(); setOpen(false); setReason(""); setNote(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold mb-2">Motivo de desistência</h3>
      {current && (
        <div className="text-sm mb-3">
          <div className="font-medium capitalize">{current.reason}</div>
          {current.note && <div className="text-xs text-muted-foreground mt-1">{current.note}</div>}
          <div className="text-xs text-muted-foreground">{new Date(current.created_at).toLocaleDateString("pt-BR")}</div>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="outline" size="sm" className="w-full">{current ? "Atualizar" : "Registrar motivo"}</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Motivo de desistência</DialogTitle></DialogHeader>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="preco">Preço</SelectItem>
              <SelectItem value="complexidade">Muito complexo</SelectItem>
              <SelectItem value="mudou_ramo">Mudou de ramo</SelectItem>
              <SelectItem value="nao_deu_certo">Negócio não deu certo</SelectItem>
              <SelectItem value="sem_tempo">Sem tempo</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalhes..." maxLength={500} />
          <Button disabled={!reason || save.isPending} onClick={() => save.mutate()}>Salvar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}