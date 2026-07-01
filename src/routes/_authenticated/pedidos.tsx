import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBRL, whatsappLink } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageCircle, ClipboardList } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["order_status"];

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — ProntoPede" }] }),
  component: OrdersPage,
});

const COLUMNS: { key: Status; label: string; tint: string }[] = [
  { key: "recebido", label: "Recebidos", tint: "bg-primary/10 text-primary" },
  { key: "preparo", label: "Em preparo", tint: "bg-warning/15 text-warning-foreground" },
  { key: "pronto", label: "Pronto p/ retirar", tint: "bg-success/15 text-success" },
  { key: "entregue", label: "Entregues", tint: "bg-muted text-muted-foreground" },
];

type Order = {
  id: string;
  order_number: number;
  customer_name: string;
  customer_whatsapp: string | null;
  total: number;
  status: Status;
  created_at: string;
  notes: string | null;
};

function OrdersPage() {
  const qc = useQueryClient();
  const { data: store } = useQuery({
    queryKey: ["my-store"],
    queryFn: async () => (await supabase.from("stores").select("id, name").maybeSingle()).data,
  });

  const { data: orders } = useQuery({
    queryKey: ["orders", store?.id],
    enabled: !!store?.id,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("id, order_number, customer_name, customer_whatsapp, total, status, created_at, notes")
        .eq("store_id", store!.id)
        .neq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as Order[];
    },
  });

  const advance = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function nextStatus(s: Status): Status | null {
    const flow: Status[] = ["recebido", "preparo", "pronto", "entregue"];
    const i = flow.indexOf(s);
    return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground">Atualize o status conforme o pedido evolui.</p>
      </div>

      {!orders?.length ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Nenhum pedido por aqui ainda</h3>
          <p className="text-muted-foreground text-sm mt-1">Compartilhe o link da sua loja para começar a receber pedidos.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = orders.filter((o) => o.status === col.key);
            return (
              <div key={col.key} className="rounded-2xl bg-muted/40 border border-border p-3 flex flex-col min-h-[300px]">
                <div className="flex items-center justify-between px-2 py-2">
                  <div className="font-semibold text-sm">{col.label}</div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.tint}`}>{items.length}</span>
                </div>
                <div className="flex-1 space-y-2">
                  {items.map((o) => {
                    const next = nextStatus(o.status);
                    return (
                      <div key={o.id} className="rounded-xl bg-card border border-border p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-sm">#{o.order_number} · {o.customer_name}</div>
                          <div className="text-primary font-bold text-sm">{formatBRL(o.total)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {o.notes && <div className="text-xs mt-2 text-muted-foreground">{o.notes}</div>}
                        <div className="flex gap-2 mt-3">
                          {o.customer_whatsapp && (
                            <a
                              href={whatsappLink(o.customer_whatsapp, `Olá ${o.customer_name}! Sobre seu pedido #${o.order_number}...`)}
                              target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-success hover:underline"
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                            </a>
                          )}
                          {next && (
                            <Button size="sm" variant="outline" className="ml-auto h-7 text-xs"
                              onClick={() => advance.mutate({ id: o.id, status: next })}>
                              Avançar →
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!items.length && <div className="text-xs text-muted-foreground px-2 py-4 text-center">Vazio</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}