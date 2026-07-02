import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/minhas-compras")({
  head: () => ({ meta: [{ title: "Meus pedidos — ProntoPede" }] }),
  component: MyOrders,
});

type Row = { id: string; order_number: number; store_id: string; store_name: string; store_slug: string; status: string; total: number; created_at: string };

function MyOrders() {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const orders = useQuery({
    queryKey: ["my-orders", session.data?.id],
    enabled: !!session.data,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_orders");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  async function signIn() {
    await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/minhas-compras" });
  }

  if (session.isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;

  if (!session.data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
          <ShoppingBag className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Meus pedidos</h1>
          <p className="text-sm text-muted-foreground mt-2">Entre para acompanhar todos os pedidos feitos nas lojas ProntoPede.</p>
          <Button className="w-full mt-6" onClick={signIn}>Entrar com Google</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto py-8">
        <h1 className="text-2xl font-bold mb-1">Meus pedidos</h1>
        <p className="text-sm text-muted-foreground mb-6">{session.data.email}</p>
        {orders.isLoading && <div className="text-muted-foreground">Carregando...</div>}
        {orders.data && !orders.data.length && (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-muted-foreground">
            Você ainda não fez nenhum pedido logado.
          </div>
        )}
        <div className="space-y-3">
          {orders.data?.map((o) => (
            <Link key={o.id} to="/loja/$slug" params={{ slug: o.store_slug }} className="block rounded-2xl border border-border bg-card p-4 hover:border-primary transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{o.store_name} · Pedido #{o.order_number}</div>
                  <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <div className="text-right">
                  <div className="text-primary font-bold">{formatBRL(Number(o.total))}</div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{o.status}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}