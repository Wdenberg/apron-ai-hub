import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatBRL,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MessageCircle, ClipboardList, XCircle, Pencil, Printer } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["order_status"];
type PayStatus = Database["public"]["Enums"]["payment_status"];

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — ProntoPede" }] }),
  component: OrdersPage,
});

const COLUMNS: { key: Status; tint: string }[] = [
  { key: "pendente", tint: "bg-primary/10 text-primary" },
  { key: "preparo", tint: "bg-warning/15 text-warning-foreground" },
  { key: "pronto", tint: "bg-accent/15 text-accent-foreground" },
  { key: "saiu_entrega", tint: "bg-secondary text-secondary-foreground" },
  { key: "entregue", tint: "bg-success/15 text-success" },
];

const STATUS_FLOW: Status[] = ["pendente", "preparo", "pronto", "saiu_entrega", "entregue"];

type Order = {
  id: string;
  order_number: number;
  customer_name: string;
  customer_whatsapp: string | null;
  total: number;
  status: Status;
  payment_status: PayStatus;
  created_at: string;
  notes: string | null;
};

function OrdersPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [payAsking, setPayAsking] = useState<Order | null>(null);
  const [printData, setPrintData] = useState<{
    order: Order;
    items: { name: string; quantity: number }[];
  } | null>(null);

  const { data: store } = useQuery({
    queryKey: ["my-store"],
    queryFn: async () =>
      (await supabase.from("stores").select("id, name").maybeSingle()).data,
  });

  const { data: orders } = useQuery({
    queryKey: ["orders", store?.id],
    enabled: !!store?.id,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_whatsapp, total, status, payment_status, created_at, notes",
        )
        .eq("store_id", store!.id)
        .neq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as Order[];
    },
  });

  const updateOrder = useMutation({
    mutationFn: async (patch: {
      id: string;
      status?: Status;
      payment_status?: PayStatus;
      notes?: string | null;
    }) => {
      const { id, ...changes } = patch;
      const { error } = await supabase.from("orders").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function advance(o: Order) {
    const i = STATUS_FLOW.indexOf(o.status);
    if (i < 0 || i >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[i + 1];
    if (next === "entregue" && o.payment_status === "pendente") {
      setPayAsking(o);
      return;
    }
    updateOrder.mutate({ id: o.id, status: next });
  }

  async function handlePrint(o: Order) {
    const { data, error } = await supabase
      .from("order_items")
      .select("quantity, products(name)")
      .eq("order_id", o.id);
    if (error) {
      toast.error("Erro ao carregar itens do pedido");
      return;
    }
    const items = (data ?? []).map((r: { quantity: number; products: { name: string } | null }) => ({
      name: r.products?.name ?? "Item",
      quantity: r.quantity,
    }));
    setPrintData({ order: o, items });
    // Wait for React to render the hidden receipt before opening the print dialog.
    await new Promise((r) => setTimeout(r, 50));
    window.print();
    setTimeout(() => setPrintData(null), 300);
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground">
          Atualize o status conforme o pedido evolui.
        </p>
      </div>

      {!orders?.length ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Nenhum pedido por aqui ainda</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Compartilhe o link da sua loja para começar a receber pedidos.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = orders.filter((o) => o.status === col.key);
            return (
              <div
                key={col.key}
                className="rounded-2xl bg-muted/40 border border-border p-3 flex flex-col min-h-[300px]"
              >
                <div className="flex items-center justify-between px-2 py-2">
                  <div className="font-semibold text-sm">
                    {ORDER_STATUS_LABELS[col.key]}
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.tint}`}
                  >
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2">
                  {items.map((o) => {
                    const i = STATUS_FLOW.indexOf(o.status);
                    const canAdvance = i >= 0 && i < STATUS_FLOW.length - 1;
                    return (
                      <div
                        key={o.id}
                        className="rounded-xl bg-card border border-border p-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-sm">
                            #{o.order_number} · {o.customer_name}
                          </div>
                          <div className="text-primary font-bold text-sm">
                            {formatBRL(o.total)}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(o.created_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {o.status === "entregue" && (
                          <div
                            className={`inline-flex items-center text-xs font-medium mt-2 px-2 py-0.5 rounded-full ${
                              o.payment_status === "pago"
                                ? "bg-success/15 text-success"
                                : o.payment_status === "nao_pago"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            Pagamento: {PAYMENT_STATUS_LABELS[o.payment_status]}
                          </div>
                        )}
                        {o.notes && (
                          <div className="text-xs mt-2 text-muted-foreground whitespace-pre-line">
                            {o.notes}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-3">
                          {o.customer_whatsapp && (
                            <a
                              href={buildWhatsAppUrl(
                                o.customer_whatsapp,
                                `Olá ${o.customer_name}! Sobre seu pedido #${o.order_number}...`,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-success hover:underline px-1"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 ml-auto"
                            onClick={() => setEditing(o)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handlePrint(o)}
                            title="Imprimir comanda"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => setCancelling(o)}
                            title="Cancelar"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                          {canAdvance && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => advance(o)}
                            >
                              Avançar →
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!items.length && (
                    <div className="text-xs text-muted-foreground px-2 py-4 text-center">
                      Vazio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EditOrderDialog
        order={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          updateOrder.mutate(patch, { onSuccess: () => setEditing(null) });
        }}
      />

      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido #{cancelling?.order_number} será marcado como Cancelado.
              O histórico permanece salvo para consultas e relatórios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!cancelling) return;
                updateOrder.mutate(
                  { id: cancelling.id, status: "cancelado" },
                  {
                    onSuccess: () => {
                      toast.success("Pedido cancelado");
                      setCancelling(null);
                    },
                  },
                );
              }}
            >
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaymentOnDeliveryDialog
        order={payAsking}
        onClose={() => setPayAsking(null)}
        onConfirm={(paymentStatus) => {
          if (!payAsking) return;
          updateOrder.mutate(
            { id: payAsking.id, status: "entregue", payment_status: paymentStatus },
            {
              onSuccess: () => {
                toast.success("Pedido entregue");
                setPayAsking(null);
              },
            },
          );
        }}
      />

      {printData && (
        <PrintReceipt
          storeName={store?.name ?? ""}
          order={printData.order}
          items={printData.items}
        />
      )}
    </AppShell>
  );
}

function PrintReceipt({
  storeName,
  order,
  items,
}: {
  storeName: string;
  order: Order;
  items: { name: string; quantity: number }[];
}) {
  function abbreviateName(text: string, max: number) {
    const t = text.trim().replace(/\s+/g, " ");
    return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
  }
  const dt = new Date(order.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="print-receipt">
      <h1>{storeName || "Comanda"}</h1>
      <div className="row muted">
        <span>Pedido #{order.order_number}</span>
        <span>{dt}</span>
      </div>
      <hr />
      <div>
        <strong>Cliente:</strong> {order.customer_name}
      </div>
      {order.customer_whatsapp && (
        <div>
          <strong>Tel:</strong> {order.customer_whatsapp}
        </div>
      )}
      <hr />
      <div>
        {items.map((it, i) => (
          <div key={i} className="item">
            {it.quantity}x {abbreviateName(it.name, 60)}
          </div>
        ))}
      </div>
      {order.notes && (
        <>
          <hr />
          <div className="notes">
            <strong>Obs:</strong> {abbreviateName(order.notes, 240)}
          </div>
        </>
      )}
      <hr />
      <div className="muted" style={{ textAlign: "center" }}>
        * * *
      </div>
    </div>
  );
}

function EditOrderDialog({
  order,
  onClose,
  onSave,
}: {
  order: Order | null;
  onClose: () => void;
  onSave: (patch: {
    id: string;
    status: Status;
    payment_status: PayStatus;
    notes: string | null;
  }) => void;
}) {
  const [status, setStatus] = useState<Status | "">("");
  const [paymentStatus, setPaymentStatus] = useState<PayStatus | "">("");
  const [notes, setNotes] = useState("");

  // reset when opened
  const key = order?.id ?? "";
  if (order && key && status === "") {
    setStatus(order.status);
    setPaymentStatus(order.payment_status);
    setNotes(order.notes ?? "");
  }
  function close() {
    setStatus("");
    setPaymentStatus("");
    setNotes("");
    onClose();
  }

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar pedido #{order?.order_number}</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["pendente", "preparo", "pronto", "saiu_entrega", "entregue"] as Status[]).map((s) => (
                      <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pagamento</Label>
                <Select
                  value={paymentStatus}
                  onValueChange={(v) => setPaymentStatus(v as PayStatus)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["pendente", "pago", "nao_pago"] as PayStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {status === "entregue" && paymentStatus === "pendente" && (
              <p className="text-xs text-destructive">
                Ao entregar, informe se o pagamento foi Pago ou Não pago.
              </p>
            )}
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>Voltar</Button>
          <Button
            disabled={
              !order ||
              !status ||
              !paymentStatus ||
              (status === "entregue" && paymentStatus === "pendente")
            }
            onClick={() => {
              if (!order || !status || !paymentStatus) return;
              onSave({
                id: order.id,
                status: status as Status,
                payment_status: paymentStatus as PayStatus,
                notes: notes.trim() ? notes.trim() : null,
              });
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentOnDeliveryDialog({
  order,
  onClose,
  onConfirm,
}: {
  order: Order | null;
  onClose: () => void;
  onConfirm: (payment: PayStatus) => void;
}) {
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pedido #{order?.order_number} entregue</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Informe a situação do pagamento:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => onConfirm("pago")}>Pago</Button>
          <Button variant="outline" onClick={() => onConfirm("nao_pago")}>
            Não pago
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
