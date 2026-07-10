import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, Plus, Receipt } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

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

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  active: boolean;
};

type Sale = {
  id: string;
  order_number: number | null;
  customer_name: string;
  customer_whatsapp: string | null;
  total: number;
  payment: PaymentMethod;
  created_at: string;
  notes: string | null;
};

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
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: store } = useQuery({
    queryKey: ["my-store"],
    queryFn: async () =>
      (await supabase.from("stores").select("id").maybeSingle()).data,
  });

  const { data: products } = useQuery({
    queryKey: ["products-active", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, stock, active")
        .eq("store_id", store!.id)
        .eq("active", true)
        .gt("stock", 0)
        .order("name");
      return (data ?? []) as Product[];
    },
  });

  const { data: sales } = useQuery({
    queryKey: ["quick-sales", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_whatsapp, total, payment, created_at, notes",
        )
        .eq("store_id", store!.id)
        .eq("type", "presencial")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Sale[];
    },
  });

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
        <Button
          onClick={() => setOpen(true)}
          disabled={!store?.id}
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Venda Rápida
        </Button>
      </div>

      {!sales?.length ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Nenhuma venda presencial ainda</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Clique em "Nova Venda Rápida" para registrar a primeira.
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
                  <th className="text-left px-4 py-2">Pagamento</th>
                  <th className="text-right px-4 py-2">Total</th>
                  <th className="text-left px-4 py-2 whitespace-nowrap">Data</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">#{s.order_number}</td>
                    <td className="px-4 py-2">{s.customer_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {s.customer_whatsapp ?? "—"}
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
                ))}
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
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["quick-sales"] });
          qc.invalidateQueries({ queryKey: ["products-active"] });
          qc.invalidateQueries({ queryKey: ["products"] });
          setOpen(false);
        }}
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

  const createSale = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Loja não carregada");
      const parsed = schema.parse({
        customer_name: customerName,
        customer_whatsapp: customerWhatsapp,
        product_id: productId,
        quantity,
        payment,
        notes,
      });
      const { data, error } = await supabase.rpc("create_quick_sale", {
        _store_id: storeId,
        _customer_name: parsed.customer_name,
        _customer_whatsapp: parsed.customer_whatsapp,
        _product_id: parsed.product_id,
        _quantity: parsed.quantity,
        _payment: parsed.payment,
        _notes: parsed.notes || undefined,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (row) => {
      toast.success(
        row
          ? `Venda #${row.order_number} registrada • ${formatBRL(row.total)}`
          : "Venda registrada",
      );
      reset();
      onCreated();
    },
    onError: (e: Error) => {
      const zerr = e as unknown as { issues?: { message: string }[] };
      const msg = zerr.issues?.[0]?.message ?? e.message;
      toast.error(msg);
    },
  });

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
            onClick={() => createSale.mutate()}
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