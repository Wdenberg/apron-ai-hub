import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogFooter } from "@/components/ui/dialog";
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
import { Users, MessageCircle, Search, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { ORDER_STATUS_LABELS } from "@/lib/format";
import { normalizeBRPhone } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — ProntoPede" }] }),
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  whatsapp: string;
  total_orders: number;
  last_order_at: string | null;
  created_at: string;
  total_spent: number;
};

type CustomerOrder = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  created_at: string;
  notes: string | null;
};

function formatPhone(digits: string): string {
  const s = digits.replace(/^55/, "");
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return digits;
}

function CustomersPage() {
  const [query, setQuery] = useState("");
  const [openCustomer, setOpenCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const qc = useQueryClient();

  const { data: store } = useQuery({
    queryKey: ["my-store"],
    queryFn: async () => (await supabase.from("stores").select("id, name").maybeSingle()).data,
  });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_store_customers" as never, {
        _store_id: store!.id,
      } as never);
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const saveCustomer = useMutation({
    mutationFn: async (payload: { id: string; name: string; whatsapp: string }) => {
      const wa = normalizeBRPhone(payload.whatsapp).replace(/^55/, "");
      if (wa.length < 10) throw new Error("WhatsApp inválido");
      const { error } = await supabase
        .from("customers")
        .update({ name: payload.name.trim(), whatsapp: wa })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente atualizado");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente excluído. Os pedidos anteriores permanecem no histórico.");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = customers.filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.whatsapp.includes(q.replace(/\D/g, ""));
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">
              Cadastrados automaticamente no primeiro pedido.
            </p>
          </div>
        </header>

        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou WhatsApp"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {customers.length === 0
                ? "Nenhum cliente ainda. Assim que alguém fizer um pedido pelo link da loja, ele aparece aqui."
                : "Nenhum cliente encontrado para essa busca."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border overflow-hidden bg-card">
            <div className="grid grid-cols-[1fr_auto_auto_auto] md:grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border bg-muted/40">
              <div>Cliente</div>
              <div className="hidden md:block">WhatsApp</div>
              <div className="text-right">Pedidos</div>
              <div className="text-right">Total gasto</div>
              <div />
            </div>
            {filtered.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_auto_auto_auto] md:grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-4 py-3 items-center border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground md:hidden">{formatPhone(c.whatsapp)}</div>
                  {c.last_order_at && (
                    <div className="text-xs text-muted-foreground">
                      Último: {new Date(c.last_order_at).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
                <div className="hidden md:block text-sm">{formatPhone(c.whatsapp)}</div>
                <div className="text-right font-semibold">{c.total_orders}</div>
                <div className="text-right font-semibold">{formatBRL(c.total_spent)}</div>
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenCustomer(c)}
                    title="Ver pedidos"
                  >
                    <ClipboardList className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    title="Abrir no WhatsApp"
                  >
                    <a
                      href={buildWhatsAppUrl(c.whatsapp, `Olá ${c.name}!`)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(c)}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleting(c)}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CustomerOrdersDialog
        customer={openCustomer}
        onClose={() => setOpenCustomer(null)}
      />

      <EditCustomerDialog
        customer={editing}
        onClose={() => setEditing(null)}
        onSave={(payload) => saveCustomer.mutate(payload)}
        pending={saveCustomer.isPending}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.total_orders > 0 ? (
                <>
                  Este cliente possui <strong>{deleting.total_orders} pedido(s)</strong>. O cadastro será removido, mas o histórico de pedidos permanece salvo e continuará visível em /pedidos e nos relatórios.
                </>
              ) : (
                "O cadastro será removido definitivamente."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && deleteCustomer.mutate(deleting.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function EditCustomerDialog({
  customer,
  onClose,
  onSave,
  pending,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSave: (p: { id: string; name: string; whatsapp: string }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  if (customer && !name && !whatsapp) {
    setName(customer.name);
    setWhatsapp(customer.whatsapp);
  }
  function close() {
    setName("");
    setWhatsapp("");
    onClose();
  }
  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label htmlFor="wa">WhatsApp</Label>
            <Input
              id="wa"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(21) 99999-0000"
              maxLength={20}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Voltar</Button>
          <Button
            disabled={pending || !name.trim() || !whatsapp.trim()}
            onClick={() =>
              customer && onSave({ id: customer.id, name, whatsapp })
            }
          >
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerOrdersDialog({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["customer-orders", customer?.id],
    enabled: !!customer,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_customer_orders" as never, {
        _customer_id: customer!.id,
      } as never);
      if (error) throw error;
      return (data ?? []) as CustomerOrder[];
    },
  });

  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico — {customer?.name}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-lg border border-border p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold">Pedido #{o.order_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("pt-BR")}
                  </div>
                  <div className="text-xs">{ORDER_STATUS_LABELS[o.status] ?? o.status}</div>
                </div>
                <div className="font-semibold shrink-0">{formatBRL(o.total)}</div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
