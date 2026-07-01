import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  ChefHat,
  QrCode,
  ClipboardList,
  BarChart3,
  Package,
  MessageCircle,
  Check,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ProntoPede — Do caderno pro digital em minutos" },
      {
        name: "description",
        content:
          "Sua loja digital, pedidos organizados, estoque no controle e vendas na palma da mão. Feito para quem cozinha e vende.",
      },
      { property: "og:title", content: "ProntoPede — Do caderno pro digital em minutos" },
      { property: "og:description", content: "Cardápio digital, pedidos via WhatsApp e controle de estoque por R$ 29,90/mês." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
          <Link to="/" className="text-xl font-extrabold tracking-tight">
            <span className="text-primary">Pronto</span>Pede
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Recursos</a>
            <a href="#pricing" className="hover:text-foreground">Preço</a>
            <a href="#faq" className="hover:text-foreground">Perguntas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost">Entrar</Button></Link>
            <Link to="/auth" search={{ mode: "signup" } as never}>
              <Button>Começar grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-60"
          style={{ background: "radial-gradient(ellipse at top, oklch(0.93 0.06 55) 0%, transparent 60%)" }} />
        <div className="max-w-6xl mx-auto px-4 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground mb-6">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> 7 dias grátis, sem cartão
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Do <span className="text-primary">caderno</span> pro digital,
              <br /> em minutos.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Sua loja digital com link exclusivo, cardápio do dia, pedidos organizados por WhatsApp e
              controle de estoque automático. Feito para quem cozinha, produz e vende.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "signup" } as never}>
                <Button size="lg" className="shadow-lg shadow-primary/20">Testar grátis por 7 dias</Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline">Ver como funciona</Button>
              </a>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Depois, R$ 29,90/mês. Cancela quando quiser.</p>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-2xl shadow-primary/10">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ChefHat className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Marmitas da Dona Zefa</div>
                  <div className="text-xs text-muted-foreground">prontopede.com.br/donazefa</div>
                </div>
                <span className="ml-auto text-xs px-2 py-1 rounded-full bg-success/15 text-success font-semibold">Aberta</span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { name: "Marmita Fitness", price: "R$ 18,90", stock: "12 disp." },
                  { name: "Feijoada da casa", price: "R$ 22,00", stock: "5 disp." },
                  { name: "Pudim caseiro", price: "R$ 8,00", stock: "20 disp." },
                ].map((p) => (
                  <div key={p.name} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10" />
                    <div className="flex-1">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.stock}</div>
                    </div>
                    <div className="font-bold text-primary">{p.price}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-4 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Tudo que você precisa. Nada que atrapalhe.</h2>
          <p className="mt-3 text-muted-foreground">Simples de usar, mesmo pra quem nunca mexeu em sistema.</p>
        </div>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: QrCode, title: "Loja digital + QR Code", text: "Link exclusivo e QR Code pra colar no ponto de venda." },
            { icon: ClipboardList, title: "Pedidos organizados", text: "Recebido → Preparo → Pronto → Entregue. Kanban simples." },
            { icon: Package, title: "Estoque automático", text: "Baixa em tempo real. Produto sem estoque some do cardápio." },
            { icon: MessageCircle, title: "WhatsApp integrado", text: "Cliente confirma o pedido pelo WhatsApp com um clique." },
            { icon: BarChart3, title: "Indicadores claros", text: "Vendas do dia, semana e mês. Produto mais vendido." },
            { icon: ChefHat, title: "Venda presencial", text: "Registre PIX, cartão ou dinheiro sem cadastrar cliente." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="bg-muted/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Preço único e justo.</h2>
          <p className="mt-3 text-muted-foreground">Sem taxa por pedido. Sem letras miúdas.</p>
          <div className="mt-10 mx-auto max-w-md rounded-3xl border-2 border-primary bg-card p-8 shadow-xl shadow-primary/20 text-left">
            <div className="text-sm font-semibold text-primary uppercase tracking-wide">Plano ProntoPede</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold">R$ 29,90</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Loja digital com link e QR Code exclusivos",
                "Pedidos ilimitados via WhatsApp",
                "Controle de estoque automático",
                "Vendas presenciais (PIX, cartão, dinheiro)",
                "Relatórios do dia, semana e mês",
                "7 dias grátis, sem cartão",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-success shrink-0" /> {t}
                </li>
              ))}
            </ul>
            <Link to="/auth" search={{ mode: "signup" } as never}>
              <Button size="lg" className="w-full mt-8">Começar teste grátis</Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-4 py-10 text-sm text-muted-foreground flex flex-wrap gap-4 items-center justify-between">
        <div>© {new Date().getFullYear()} ProntoPede.</div>
        <div>Feito com carinho para quem cozinha.</div>
      </footer>
    </div>
  );
}
