import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminStoreDetail,
  useSetSubscriptionStatusDetail,
  useExtendTrial,
  useAddAdminNote,
  useRegisterChurn,
} from "@/hooks/admin/useAdminStores";
import type { AdminStoreDetail as Detail } from "@/services/admin/adminStoresService";
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

function LojistaDetail() {
  const { id } = useParams({ from: "/admin/lojistas/$id" });
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [days, setDays] = useState("7");
  const [newStatus, setNewStatus] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const { data, isLoading } = useAdminStoreDetail(id);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "store", id] });

  const changeStatusMut = useSetSubscriptionStatusDetail(id);
  const extendTrialMut = useExtendTrial(id);
  const addNoteMut = useAddAdminNote(id);
  const changeStatus = {
    isPending: changeStatusMut.isPending,
    mutate: () =>
      changeStatusMut.mutate(
        { status: newStatus, reason: reason || undefined },
        {
          onSuccess: () => {
            toast.success("Status atualizado");
            setNewStatus(""); setReason("");
          },
          onError: (e: Error) => toast.error(e.message),
        },
      ),
  };
  const extendTrial = {
    isPending: extendTrialMut.isPending,
    mutate: () =>
      extendTrialMut.mutate(parseInt(days, 10), {
        onSuccess: () => toast.success("Trial estendido"),
        onError: (e: Error) => toast.error(e.message),
      }),
  };
  const addNote = {
    isPending: addNoteMut.isPending,
    mutate: () =>
      addNoteMut.mutate(note, {
        onSuccess: () => { toast.success("Nota salva"); setNote(""); },
        onError: (e: Error) => toast.error(e.message),
      }),
  };

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
  const saveMut = useRegisterChurn(storeId);
  const save = {
    isPending: saveMut.isPending,
    mutate: () =>
      saveMut.mutate(
        { reason, note: note || undefined },
        {
          onSuccess: () => { toast.success("Motivo registrado"); onDone(); setOpen(false); setReason(""); setNote(""); },
          onError: (e: Error) => toast.error(e.message),
        },
      ),
  };
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