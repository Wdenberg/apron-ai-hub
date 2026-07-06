import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/format";
import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { customerProfilePhoneSchema, normalizePhone } from "@/lib/customer-validation";

export const Route = createFileRoute("/minhas-compras")({
  head: () => ({ meta: [{ title: "Meus pedidos — ProntoPede" }] }),
  component: MyOrders,
});

type Row = { id: string; order_number: number; store_id: string; store_name: string; store_slug: string; status: string; total: number; created_at: string };

function MyOrders() {
  const navigate = useNavigate();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const profile = useQuery({
    queryKey: ["profile", session.data?.id],
    enabled: !!session.data,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, whatsapp")
        .eq("id", session.data!.id)
        .maybeSingle();
      return data;
    },
  });

  const orders = useQuery({
    queryKey: ["my-orders", session.data?.id],
    enabled: !!session.data && !!profile.data?.whatsapp,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_orders");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const savePhone = useMutation({
    mutationFn: async (whatsapp: string) => {
      const { data: existing } = await supabase
        .from("profiles").select("id").eq("whatsapp", whatsapp).neq("id", session.data!.id).maybeSingle();
      if (existing) throw new Error("Telefone já cadastrado em outra conta.");
      const { error } = await supabase.from("profiles").update({ whatsapp }).eq("id", session.data!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Telefone salvo!"); profile.refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [phoneInput, setPhoneInput] = useState("");

  if (session.isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;

  if (!session.data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
          <ShoppingBag className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Meus pedidos</h1>
          <p className="text-sm text-muted-foreground mt-2">Crie uma conta ou entre para acompanhar todos os pedidos.</p>
          <Button className="w-full mt-6" onClick={() => navigate({ to: "/entrar", search: { mode: "signup", redirect: "/minhas-compras" } })}>
            Criar conta / Entrar
          </Button>
        </div>
      </div>
    );
  }

  if (profile.isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando perfil...</div>;

  if (!profile.data?.whatsapp) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = customerProfilePhoneSchema.safeParse({ whatsapp: phoneInput });
            if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Telefone inválido"); return; }
            savePhone.mutate(parsed.data.whatsapp);
          }}
          className="max-w-md w-full rounded-2xl border border-border bg-card p-8 space-y-4"
        >
          <div>
            <h1 className="text-xl font-bold">Complete seu cadastro</h1>
            <p className="text-sm text-muted-foreground mt-1">Informe seu WhatsApp para concluir a criação da conta.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">Telefone (WhatsApp)</Label>
            <Input
              id="whatsapp"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="(11) 99999-0000"
              required
            />
            <p className="text-xs text-muted-foreground">Somente números com DDD. Ex: 11999990000.</p>
          </div>
          <Button type="submit" className="w-full" disabled={savePhone.isPending || normalizePhone(phoneInput).length < 10}>
            {savePhone.isPending ? "Salvando..." : "Salvar e continuar"}
          </Button>
        </form>
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
