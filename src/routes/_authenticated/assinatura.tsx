import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Calendar, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({ meta: [{ title: "Assinatura — ProntoPede" }] }),
  component: AssinaturaPage,
});

type Status = "trial" | "active" | "past_due" | "blocked" | "canceled" | null | undefined;

const PLAN_PRICE_CENTS = 2990;

function statusMeta(status: Status) {
  switch (status) {
    case "trial":
      return { label: "Período de teste", color: "bg-warning/15 text-warning-foreground border-warning/30", icon: Clock };
    case "active":
      return { label: "Assinatura ativa", color: "bg-success/15 text-success-foreground border-success/30", icon: CheckCircle2 };
    case "past_due":
      return { label: "Pagamento pendente", color: "bg-warning/15 text-warning-foreground border-warning/30", icon: AlertTriangle };
    case "blocked":
      return { label: "Conta bloqueada", color: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle };
    case "canceled":
      return { label: "Cancelada", color: "bg-muted text-muted-foreground border-border", icon: XCircle };
    default:
      return { label: "Sem assinatura", color: "bg-muted text-muted-foreground border-border", icon: CreditCard };
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function daysUntil(iso: string | null | undefined) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function AssinaturaPage() {
  const { data: store, isLoading } = useQuery({
    queryKey: ["my-store-subscription"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, subscription_status, trial_ends_at, created_at, stripe_subscription_id")
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="text-muted-foreground">Carregando...</div>
      </AppShell>
    );
  }

  if (!store) {
    return (
      <AppShell>
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold mb-2">Assinatura</h1>
          <p className="text-muted-foreground">Crie sua loja primeiro para ver os dados da assinatura.</p>
        </div>
      </AppShell>
    );
  }

  const status = store.subscription_status as Status;
  const meta = statusMeta(status);
  const Icon = meta.icon;
  const isTrial = status === "trial";
  const trialDaysLeft = isTrial ? daysUntil(store.trial_ends_at) : null;
  const planLabel = isTrial ? "Plano Teste Grátis (7 dias)" : "Plano Mensal ProntoPede";
  const priceLabel = isTrial ? "Grátis durante o teste" : `R$ ${(PLAN_PRICE_CENTS / 100).toFixed(2).replace(".", ",")} / mês`;

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Assinatura</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe o status do seu plano e quando ele expira.</p>
        </div>

        <div className="border rounded-xl p-6 bg-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold text-lg">{planLabel}</div>
                <div className="text-sm text-muted-foreground">{priceLabel}</div>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border ${meta.color}`}>
              <Icon className="h-4 w-4" />
              {meta.label}
            </span>
          </div>

          {isTrial && (
            <div className="mt-6 p-4 rounded-lg bg-warning/10 border border-warning/30">
              <div className="flex items-center gap-2 text-warning-foreground font-medium">
                <Clock className="h-4 w-4" />
                {trialDaysLeft !== null && trialDaysLeft > 0
                  ? `Faltam ${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"} para o fim do teste`
                  : "Seu período de teste terminou"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Expira em <strong className="text-foreground">{formatDate(store.trial_ends_at)}</strong>
              </div>
            </div>
          )}

          {status === "active" && (
            <div className="mt-6 p-4 rounded-lg bg-success/10 border border-success/30">
              <div className="flex items-center gap-2 text-success-foreground font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Sua assinatura está ativa
              </div>
              <div className="text-sm text-muted-foreground mt-1">Obrigado por ser cliente ProntoPede.</div>
            </div>
          )}

          {status === "past_due" && (
            <div className="mt-6 p-4 rounded-lg bg-warning/10 border border-warning/30">
              <div className="flex items-center gap-2 text-warning-foreground font-medium">
                <AlertTriangle className="h-4 w-4" />
                Existe um pagamento pendente
              </div>
              <div className="text-sm text-muted-foreground mt-1">Regularize para manter sua loja no ar.</div>
            </div>
          )}

          {(status === "blocked" || status === "canceled") && (
            <div className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <div className="flex items-center gap-2 text-destructive font-medium">
                <XCircle className="h-4 w-4" />
                {status === "blocked" ? "Sua conta está bloqueada" : "Assinatura cancelada"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Entre em contato com o suporte para reativar.</div>
            </div>
          )}

          <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <dt className="text-muted-foreground">Cliente desde</dt>
                <dd className="font-medium">{formatDate(store.created_at)}</dd>
              </div>
            </div>
            {isTrial && (
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="text-muted-foreground">Fim do teste</dt>
                  <dd className="font-medium">{formatDate(store.trial_ends_at)}</dd>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <dt className="text-muted-foreground">Tipo de assinatura</dt>
                <dd className="font-medium">{isTrial ? "Teste grátis" : status === "active" ? "Mensal" : "—"}</dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="text-xs text-muted-foreground">
          Precisa de ajuda com a cobrança? Fale com o suporte pelo WhatsApp.
        </div>
      </div>
    </AppShell>
  );
}