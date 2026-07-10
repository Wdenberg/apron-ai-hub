import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { useMyStoreShell } from "@/hooks/useStore";
import { useAvailableProducts } from "@/hooks/useProducts";
import {
  useQuickSales,
  useCreateQuickSale,
  useStoreOrdersRealtime,
} from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { Download, Loader2, Plus, Receipt, Search } from "lucide-react";
import type { PaymentMethod } from "@/services/ordersService";
import type { ProductPickerRow as Product } from "@/services/productsService";
import type { QuickSale as Sale } from "@/services/ordersService";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({ meta: [{ title: "Venda rápida — ProntoPede" }] }),
  component: VendasPage,
});

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

const PAYMENT_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_OPTIONS.map((p) => [p.value, p.label]),
);
PAYMENT_LABELS.cartao = "Cartão";
PAYMENT_LABELS.nao_definido = "A definir";

const schema = z.object({
  customer_name: z.string().trim().min(2, "Informe o nome").max(80),
  customer_whatsapp: z
    .string()
    .trim()
    .refine(
      (v) => v.replace(/\D/g, "").length >= 10,
      "Informe um telefone válido",
    ),
  product_id: z.string().uuid("Selecione um produto"),
  quantity: z.coerce.number().int().min(1).max(999),
  payment: z.enum([
    "pix",
    "dinheiro",
    "cartao_debito",
    "cartao_credito",
    "transferencia",
    "outro",
  ]),
  notes: z.string().max(500).optional().or(z.literal("")),
});

function VendasPage() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number>(30);
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const { data: store } = useMyStoreShell();
  const { data: products } = useAvailableProducts(store?.id);
  const { data: sales } = useQuickSales(store?.id, days);
  useStoreOrdersRealtime(store?.id, "orders-vendas", "quick-sales");

  const filteredSales = useMemo(() => {
    const list = sales ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((s) => {
      if (paymentFilter !== "all" && s.payment !== paymentFilter) return false;
      if (!q) return true;
      const inName = s.customer_name?.toLowerCase().includes(q);
      const inPhone = (s.customer_whatsapp ?? "").toLowerCase().includes(q);
      const inProduct = (s.order_items ?? []).some((it) =>
        (it.products?.name ?? "").toLowerCase().includes(q),
      );
      return inName || inPhone || inProduct;
    });
  }, [sales, paymentFilter, search]);

  function exportCsv() {
    const rows = filteredSales;
    if (!rows.length) {
      toast.error("Nenhuma venda para exportar");
      return;
    }
    const headers = [
      "Data",
      "Cliente",
      "Telefone",
      "Produto",
      "Quantidade",
      "Valor unitário",
      "Valor total",
      "Pagamento",
      "Observações",
    ];
    const esc = (v: string | number | null | undefined) => {
      const s = v == null ? "" : String(v);
      if (/[";\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines: string[] = [headers.join(";")];
    rows.forEach((s) => {
      const items = s.order_items ?? [];
      const date = new Date(s.created_at).toLocaleString("pt-BR");
      const qty = items.reduce((a, it) => a + it.quantity, 0);
      const unit =
        items.length === 1
          ? formatBRL(items[0].unit_price)
          : formatBRL(qty > 0 ? Number(s.total) / qty : 0);
      const productLabel = items.length
        ? items
            .map((it) => `${it.quantity}x ${it.products?.name ?? "Item"}`)
            .join(" | ")
        : "";
      lines.push(
        [
          date,
          s.customer_name,
          s.customer_whatsapp ?? "",
          productLabel,
          qty,
          unit,
          formatBRL(Number(s.total)),
          PAYMENT_LABELS[s.payment] ?? s.payment,
          s.notes ?? "",
        ]
          .map(esc)
          .join(";"),
      );
    });
    const csv = "\ufeff" + lines.join("\n");
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas-rapidas-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} venda(s) exportada(s)`);
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Venda rápida
          </h1>
          <p className="text-muted-foreground">
            Registre uma venda presencial em poucos cliques.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!filteredSales.length}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button
            onClick={() => setOpen(true)}
            disabled={!store?.id}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Venda Rápida
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os pagamentos</SelectItem>
            {PAYMENT_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cliente, telefone ou produto"
            className="pl-8"
          />
        </div>
      </div>

      {!filteredSales.length ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">
            Nenhuma venda encontrada
          </h3>
          <p className="text-muted-foreground text-sm mt-1">
            Ajuste os filtros ou registre uma nova venda rápida.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-4 py-2">Cliente</th>
                  <th className="text-left px-4 py-2">Telefone</th>
                  <th className="text-left px-4 py-2">Produto</th>
                  <th className="text-left px-4 py-2">Pagamento</th>
                  <th className="text-right px-4 py-2">Total</th>
                  <th className="text-left px-4 py-2 whitespace-nowrap">Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((s) => {
                  const items = s.order_items ?? [];
                  const label = items.length
                    ? items
                        .map(
                          (it) =>
                            `${it.quantity}x ${it.products?.name ?? "Item"}`,
                        )
                        .join(", ")
                    : "—";
                  return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">#{s.order_number}</td>
                    <td className="px-4 py-2">{s.customer_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {s.customer_whatsapp ?? "—"}
                    </td>
                    <td className="px-4 py-2 max-w-[220px] truncate" title={label}>
                      {label}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {PAYMENT_LABELS[s.payment] ?? s.payment}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {formatBRL(s.total)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <QuickSaleDialog
        open={open}
        onClose={() => setOpen(false)}
        storeId={store?.id ?? null}
        products={products ?? []}
        onCreated={() => setOpen(false)}
      />
    </AppShell>
  );
}

function QuickSaleDialog({
  open,
  onClose,
  storeId,
  products,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  storeId: string | null;
  products: Product[];
  onCreated: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [payment, setPayment] = useState<PaymentMethod | "">("");
  const [notes, setNotes] = useState("");

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );
  const total = selectedProduct ? selectedProduct.price * (quantity || 0) : 0;

  function reset() {
    setCustomerName("");
    setCustomerWhatsapp("");
    setProductId("");
    setQuantity(1);
    setPayment("");
    setNotes("");
  }

  const createSale = useCreateQuickSale();

  function submitSale() {
    if (!storeId) { toast.error("Loja não carregada"); return; }
    let parsed: z.infer<typeof schema>;
    try {
      parsed = schema.parse({
        customer_name: customerName,
        customer_whatsapp: customerWhatsapp,
        product_id: productId,
        quantity,
        payment,
        notes,
      });
    } catch (e) {
      const zerr = e as { issues?: { message: string }[] };
      toast.error(zerr.issues?.[0]?.message ?? "Dados inválidos");
      return;
    }
    createSale.mutate(
      {
        storeId,
        customerName: parsed.customer_name,
        customerWhatsapp: parsed.customer_whatsapp,
        productId: parsed.product_id,
        quantity: parsed.quantity,
        payment: parsed.payment,
        notes: parsed.notes || undefined,
      },
      {
        onSuccess: (row) => {
          toast.success(
            row
              ? `Venda #${row.order_number} registrada • ${formatBRL(row.total)}`
              : "Venda registrada",
          );
          reset();
          onCreated();
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  const canSubmit =
    !!storeId &&
    customerName.trim().length >= 2 &&
    customerWhatsapp.replace(/\D/g, "").length >= 10 &&
    !!productId &&
    quantity >= 1 &&
    !!payment &&
    !createSale.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova venda rápida</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qs-name">Nome do cliente *</Label>
              <Input
                id="qs-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                maxLength={80}
                placeholder="Ex.: João da Silva"
              />
            </div>
            <div>
              <Label htmlFor="qs-phone">Telefone *</Label>
              <Input
                id="qs-phone"
                value={customerWhatsapp}
                onChange={(e) => setCustomerWhatsapp(e.target.value)}
                maxLength={20}
                placeholder="(21) 99999-0000"
                inputMode="tel"
              />
            </div>
          </div>

          <div>
            <Label>Produto *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum produto disponível em estoque.
                  </div>
                ) : (
                  products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatBRL(p.price)} · estoque {p.stock}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qs-qty">Quantidade *</Label>
              <Input
                id="qs-qty"
                type="number"
                min={1}
                max={selectedProduct?.stock ?? 999}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, parseInt(e.target.value || "1", 10)))
                }
              />
              {selectedProduct && quantity > selectedProduct.stock && (
                <p className="text-xs text-destructive mt-1">
                  Estoque disponível: {selectedProduct.stock}
                </p>
              )}
            </div>
            <div>
              <Label>Pagamento *</Label>
              <Select value={payment} onValueChange={(v) => setPayment(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="qs-notes">Observações</Label>
            <Textarea
              id="qs-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Opcional"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-bold text-primary">
              {formatBRL(total)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createSale.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={submitSale}
            disabled={
              !canSubmit ||
              (selectedProduct ? quantity > selectedProduct.stock : false)
            }
          >
            {createSale.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Confirmar venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}