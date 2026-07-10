import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useMyStoreShell } from "@/hooks/useStore";
import {
  useActiveOrders,
  useUpdateOrder,
  fetchOrderItems,
} from "@/hooks/useOrders";
import {
  formatBRL,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatPhoneBR, formatProperName } from "@/lib/formatters";
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
import { MessageCircle, ClipboardList, XCircle, Pencil, Printer, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  OrderStatus as Status,
  PaymentStatus as PayStatus,
} from "@/services/ordersService";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — ProntoPede" }] }),
  component: OrdersPage,
});

const COLUMNS: {
  key: Status;
  tint: string;
  accent: string;
  border: string;
  dot: string;
}[] = [
  {
    key: "pendente",
    tint: "bg-yellow-100 text-yellow-900 dark:bg-yellow-500/20 dark:text-yellow-100",
    accent: "border-l-yellow-500",
    border: "border-yellow-200 dark:border-yellow-500/30",
    dot: "bg-yellow-500",
  },
  {
    key: "preparo",
    tint: "bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-100",
    accent: "border-l-orange-500",
    border: "border-orange-200 dark:border-orange-500/30",
    dot: "bg-orange-500",
  },
  {
    key: "pronto",
    tint: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100",
    accent: "border-l-blue-500",
    border: "border-blue-200 dark:border-blue-500/30",
    dot: "bg-blue-500",
  },
  {
    key: "saiu_entrega",
    tint: "bg-purple-100 text-purple-900 dark:bg-purple-500/20 dark:text-purple-100",
    accent: "border-l-purple-500",
    border: "border-purple-200 dark:border-purple-500/30",
    dot: "bg-purple-500",
  },
  {
    key: "entregue",
    tint: "bg-green-100 text-green-900 dark:bg-green-500/20 dark:text-green-100",
    accent: "border-l-green-500",
    border: "border-green-200 dark:border-green-500/30",
    dot: "bg-green-500",
  },
];

const STATUS_FLOW: Status[] = ["pendente", "preparo", "pronto", "saiu_entrega", "entregue"];

const ALL_STATUSES: Status[] = STATUS_FLOW;
const NEW_ORDER_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

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
  const [editing, setEditing] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [payAsking, setPayAsking] = useState<Order | null>(null);
  const [printBatch, setPrintBatch] = useState<
    { order: Order; items: { name: string; quantity: number }[] }[] | null
  >(null);
  const [printWidth, setPrintWidth] = useState<"58" | "80">("80");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(
    () => new Set(ALL_STATUSES),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const saved = typeof window !== "undefined"
      ? window.localStorage.getItem("pp_orders_status_filter")
      : null;
    if (!saved) return;
    try {
      const arr = JSON.parse(saved) as Status[];
      const valid = arr.filter((s) => ALL_STATUSES.includes(s));
      if (valid.length) setStatusFilter(new Set(valid));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "pp_orders_status_filter",
        JSON.stringify(Array.from(statusFilter)),
      );
    }
  }, [statusFilter]);

  // Ticker to keep the "novo" highlight fresh as time passes.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  function toggleStatusFilter(s: Status) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      if (next.size === 0) return new Set(ALL_STATUSES); // never empty
      return next;
    });
  }
  const allSelected = statusFilter.size === ALL_STATUSES.length;

  const visibleColumns = COLUMNS.filter((c) => statusFilter.has(c.key));

  useEffect(() => {
    const saved = typeof window !== "undefined"
      ? (window.localStorage.getItem("pp_print_width") as "58" | "80" | null)
      : null;
    if (saved === "58" || saved === "80") setPrintWidth(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("pp_print_width", printWidth);
    }
  }, [printWidth]);

  const { data: store } = useMyStoreShell();
  const { data: orders } = useActiveOrders(store?.id);
  const updateOrder = useUpdateOrder();

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

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function printOrders(list: Order[]) {
    if (!list.length) return;
    const ids = list.map((o) => o.id);
    let data: Awaited<ReturnType<typeof fetchOrderItems>>;
    try {
      data = await fetchOrderItems(ids);
    } catch {
      toast.error("Erro ao carregar itens do pedido");
      return;
    }
    const map = new Map<string, { name: string; quantity: number }[]>();
    data.forEach(
      (r) => {
        const arr = map.get(r.order_id) ?? [];
        arr.push({ name: r.products?.name ?? "Item", quantity: r.quantity });
        map.set(r.order_id, arr);
      },
    );
    const batch = list.map((o) => ({ order: o, items: map.get(o.id) ?? [] }));

    // Inject dynamic @page rule matching the chosen thermal width.
    const widthMm = printWidth === "58" ? 58 : 80;
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-print-page", "1");
    styleEl.textContent = `@media print { @page { size: ${widthMm}mm auto; margin: 3mm; } }`;
    document.head.appendChild(styleEl);

    setPrintBatch(batch);
    await new Promise((r) => setTimeout(r, 80));
    window.print();
    setTimeout(() => {
      setPrintBatch(null);
      styleEl.remove();
    }, 400);
  }

  async function printSelected() {
    if (!orders || !selectedIds.size) return;
    const list = orders.filter((o) => selectedIds.has(o.id));
    await printOrders(list);
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">
            Atualize o status conforme o pedido evolui.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2">
            <Label htmlFor="print-width" className="text-xs whitespace-nowrap">
              Impressão
            </Label>
            <Select value={printWidth} onValueChange={(v) => setPrintWidth(v as "58" | "80")}>
              <SelectTrigger id="print-width" className="h-9 w-full sm:w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58">Térmica 58 mm</SelectItem>
                <SelectItem value="80">Térmica 80 mm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedIds.size}
            onClick={printSelected}
            className="whitespace-nowrap"
          >
            <Printer className="h-4 w-4 mr-1" />
            Imprimir selecionados ({selectedIds.size})
          </Button>
        </div>
      </div>

      <div
        role="group"
        aria-label="Filtrar por status"
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <span className="text-xs font-medium text-muted-foreground mr-1">
          Filtrar:
        </span>
        <button
          type="button"
          onClick={() => setStatusFilter(new Set(ALL_STATUSES))}
          aria-pressed={allSelected}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            allSelected
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-foreground border-border hover:bg-muted"
          }`}
        >
          Todos
        </button>
        {COLUMNS.map((col) => {
          const active = statusFilter.has(col.key) && !allSelected;
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => toggleStatusFilter(col.key)}
              aria-pressed={statusFilter.has(col.key)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? `${col.tint} border-transparent`
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${col.dot}`} aria-hidden />
              {ORDER_STATUS_LABELS[col.key]}
            </button>
          );
        })}
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
          {visibleColumns.map((col) => {
            const items = orders.filter((o) => o.status === col.key);
            return (
              <div
                key={col.key}
                className="rounded-2xl bg-muted/40 border border-border p-3 flex flex-col min-h-[300px]"
              >
                <div className="flex items-center justify-between px-2 py-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
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
                    const isNew =
                      o.status === "pendente" &&
                      now - new Date(o.created_at).getTime() < NEW_ORDER_WINDOW_MS;
                    return (
                      <div
                        key={o.id}
                        className={`relative rounded-xl bg-card border ${col.border} border-l-4 ${col.accent} p-3 shadow-sm transition-shadow ${
                          isNew
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg"
                            : ""
                        }`}
                      >
                        {isNew && (
                          <span
                            className="absolute -top-2 -right-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary text-primary-foreground shadow"
                            aria-label="Pedido recém-chegado"
                          >
                            <Sparkles className="h-3 w-3" aria-hidden />
                            Novo
                          </span>
                        )}
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={selectedIds.has(o.id)}
                            onCheckedChange={() => toggleSelected(o.id)}
                            aria-label="Selecionar para imprimir"
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="text-xl font-bold leading-none">
                              #{o.order_number}
                            </div>
                            <div className="font-semibold text-sm truncate">
                              {formatProperName(o.customer_name)}
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Valor: </span>
                              <span className="font-semibold text-primary">
                                {formatBRL(o.total)}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Hora: </span>
                              {new Date(o.created_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            {o.notes && (
                              <div className="text-sm whitespace-pre-line">
                                <span className="text-muted-foreground">Obs: </span>
                                {o.notes}
                              </div>
                            )}
                          </div>
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
                        <div className="flex flex-wrap gap-1 mt-3">
                          {o.customer_whatsapp && (
                            <a
                              href={buildWhatsAppUrl(
                                o.customer_whatsapp,
                                `Olá ${formatProperName(o.customer_name)}! Sobre seu pedido #${o.order_number}...`,
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
                            onClick={() => printOrders([o])}
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

      {printBatch && (
        <div className={`print-area w${printWidth}`}>
          {printBatch.map(({ order, items }) => (
            <PrintReceipt
              key={order.id}
              storeName={store?.name ?? ""}
              order={order}
              items={items}
            />
          ))}
        </div>
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
        <strong>Cliente:</strong> {formatProperName(order.customer_name)}
      </div>
      {order.customer_whatsapp && (
        <div>
          <strong>Tel:</strong> {formatPhoneBR(order.customer_whatsapp)}
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
