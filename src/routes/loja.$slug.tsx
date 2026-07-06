import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { StoreImage, resolveStoreAssetUrl } from "@/components/StoreImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/format";
import { openWhatsAppOrder } from "@/lib/whatsapp";
import { toast } from "sonner";
import { ShoppingBag, MapPin, MessageCircle, Plus, Minus, X } from "lucide-react";
import { z } from "zod";
import { customerCheckoutSchema } from "@/lib/customer-validation";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/loja/$slug")({
  head: () => ({ meta: [{ title: "Loja — ProntoPede" }] }),
  loader: async ({ params }) => {
    const { data: store } = await supabase
      .from("stores_public" as never)
      .select("id, name, slug, description, whatsapp, address, city, state, is_open, logo_url, cover_url")
      .eq("slug", params.slug)
      .maybeSingle<{
        id: string; name: string; slug: string; description: string | null;
        whatsapp: string; address: string | null; city: string | null; state: string | null;
        is_open: boolean; logo_url: string | null; cover_url: string | null;
      }>();
    if (!store) throw notFound();
    const { data: products } = await supabase.rpc("list_public_products" as never, {
      _slug: params.slug,
    } as never);
    return { store, products: (products ?? []) as Array<{
      id: string; name: string; description: string | null; price: number;
      stock: number; category: string | null; photo_url: string | null; store_id: string;
    }> };
  },
  component: PublicStore,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-center p-6">
      <div>
        <h1 className="text-2xl font-bold">Loja não encontrada</h1>
        <p className="text-muted-foreground mt-2">Verifique o link e tente novamente.</p>
      </div>
    </div>
  ),
});

type CartItem = { id: string; name: string; price: number; qty: number; stock: number };

const checkoutSchema = customerCheckoutSchema;

function PublicStore() {
  const { store, products } = Route.useLoaderData();
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<{ number: number } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user)); }, []);
  useEffect(() => {
    resolveStoreAssetUrl(store.cover_url).then(setCoverUrl);
  }, [store.cover_url]);

  const items = Object.values(cart);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  const grouped = useMemo(() => {
    const g: Record<string, typeof products> = {};
    for (const p of products) {
      const key = p.category ?? "Cardápio";
      (g[key] ??= []).push(p);
    }
    return g;
  }, [products]);

  function add(p: (typeof products)[number]) {
    setCart((c) => {
      const cur = c[p.id];
      const qty = Math.min((cur?.qty ?? 0) + 1, p.stock);
      return { ...c, [p.id]: { id: p.id, name: p.name, price: Number(p.price), qty, stock: p.stock } };
    });
  }
  function dec(id: string) {
    setCart((c) => {
      const cur = c[id]; if (!cur) return c;
      if (cur.qty <= 1) { const rest = { ...c }; delete rest[id]; return rest; }
      return { ...c, [id]: { ...cur, qty: cur.qty - 1 } };
    });
  }

  const submitOrder = useMutation({
    mutationFn: async (payload: z.infer<typeof checkoutSchema>) => {
      const { data, error } = await supabase.rpc("create_public_order" as never, {
        _store_id: store.id,
        _customer_name: payload.name,
        _customer_whatsapp: payload.whatsapp,
        _notes: payload.notes || null,
        _items: items.map((i) => ({ product_id: i.id, quantity: i.qty })),
        _customer_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
      } as never);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { id: string; order_number: number };
    },
    onSuccess: (order) => {
      openWhatsAppOrder({
        storeName: store.name,
        storePhone: store.whatsapp,
        orderNumber: order.order_number,
        customerName: order.customer_name ?? "",
        customerPhone: order.customer_whatsapp ?? "",
        items: items.map((i) => ({ name: i.name, quantity: i.qty, unit_price: i.price })),
        total,
        notes: order.notes ?? null,
      });
      setCart({}); setCheckoutOpen(false); setLastOrder({ number: order.order_number });
      toast.success(`Pedido #${order.order_number} enviado!`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function checkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = checkoutSchema.safeParse({ name: fd.get("name"), whatsapp: fd.get("whatsapp"), notes: fd.get("notes") });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Preencha nome e WhatsApp"); return; }
    submitOrder.mutate(parsed.data);
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="h-40 md:h-56 relative"
        style={{ background: coverUrl ? `url(${coverUrl}) center/cover` : "var(--gradient-warm)" }}>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>
      <div className="max-w-3xl mx-auto px-4 -mt-16 relative">
        <div className="rounded-2xl bg-card border border-border p-5 shadow-lg flex gap-4 items-start">
          {store.logo_url ? (
            <StoreImage path={store.logo_url} alt={store.name} className="h-16 w-16 rounded-xl object-cover shrink-0" fallbackClassName="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0" />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-7 w-7 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{store.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${store.is_open ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {store.is_open ? "Aberta" : "Fechada"}
              </span>
            </div>
            {store.description && <p className="text-sm text-muted-foreground mt-1">{store.description}</p>}
            {(store.city || store.address) && (
              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {[store.address, store.city, store.state].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-8">
          {!products.length && (
            <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-muted-foreground">
              O cardápio está sendo preparado. Volte em breve!
            </div>
          )}
          {Object.entries(grouped).map(([cat, list]: [string, typeof products]) => (
            <section key={cat}>
              <h2 className="text-lg font-bold mb-3">{cat}</h2>
              <div className="space-y-3">
                {list.map((p: (typeof products)[number]) => {
                  const inCart = cart[p.id]?.qty ?? 0;
                  return (
                    <div key={p.id} className="rounded-2xl border border-border bg-card p-4 flex gap-4 items-center">
                      {p.photo_url ? (
                        <StoreImage path={p.photo_url} alt={p.name} className="h-16 w-16 rounded-xl object-cover shrink-0" fallbackClassName="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 shrink-0" />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{p.name}</div>
                        {p.description && <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>}
                        <div className="text-primary font-bold mt-1">{formatBRL(Number(p.price))}</div>
                      </div>
                      {inCart > 0 ? (
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => dec(p.id)}><Minus className="h-3 w-3" /></Button>
                          <span className="w-5 text-center font-semibold text-sm">{inCart}</span>
                          <Button size="icon" className="h-8 w-8" onClick={() => add(p)} disabled={inCart >= p.stock}><Plus className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <Button size="sm" onClick={() => add(p)} disabled={!store.is_open}>Adicionar</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {count > 0 && (
        <div className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4">
          <Button size="lg" className="w-full max-w-md shadow-xl shadow-primary/30" onClick={() => setCheckoutOpen(true)}>
            Ver carrinho · {count} {count === 1 ? "item" : "itens"} · {formatBRL(total)}
          </Button>
        </div>
      )}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Finalizar pedido</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {items.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setCart((c) => { const r = { ...c }; delete r[i.id]; return r; })} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                  <span>{i.qty}x {i.name}</span>
                </div>
                <span className="font-semibold">{formatBRL(i.price * i.qty)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold border-t border-border pt-3">
            <span>Total</span><span className="text-primary">{formatBRL(total)}</span>
          </div>
          <form onSubmit={checkout} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Seu nome</Label>
              <Input id="name" name="name" required maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" name="whatsapp" placeholder="(21) 99999-0000" required maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea id="notes" name="notes" maxLength={300} />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={submitOrder.isPending}>
              <MessageCircle className="h-4 w-4 mr-2" />
              {submitOrder.isPending ? "Enviando..." : "Enviar Pedido"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lastOrder} onOpenChange={(o) => !o && setLastOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedido #{lastOrder?.number} enviado! 🎉</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Continuamos sua conversa com a loja pelo WhatsApp. Você pode acompanhar seus pedidos futuros criando uma conta grátis.
          </p>
          {!isLoggedIn ? (
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild size="lg">
                <Link to="/entrar" search={{ mode: "signup", redirect: "/minhas-compras" }}>
                  Criar conta grátis
                </Link>
              </Button>
              <Button variant="ghost" onClick={() => setLastOrder(null)}>Agora não</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild size="lg">
                <Link to="/minhas-compras">Ver meus pedidos</Link>
              </Button>
              <Button variant="ghost" onClick={() => setLastOrder(null)}>Continuar comprando</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}