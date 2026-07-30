import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/services/authService";
import {
  checkResetRateLimit,
  registerResetAttempt,
  formatRetryDelay,
} from "@/lib/resetRateLimit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/esqueci-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — ProntoPede" },
      { name: "description", content: "Recupere o acesso à sua conta ProntoPede por e-mail." },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({ email: z.string().trim().email("E-mail inválido").max(255) });

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [retryInMs, setRetryInMs] = useState(0);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  // Countdown tick while the send is throttled/blocked.
  useEffect(() => {
    if (retryInMs <= 0) return;
    const id = window.setInterval(() => {
      setRetryInMs((ms) => {
        const next = ms - 1000;
        if (next <= 0) {
          setLimitMsg(null);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [retryInMs > 0]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ email: fd.get("email") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "E-mail inválido");
      return;
    }
    const limit = checkResetRateLimit();
    if (!limit.allowed) {
      const wait = formatRetryDelay(limit.retryInMs);
      const msg =
        limit.reason === "blocked"
          ? `Muitas tentativas de recuperação. Tente novamente em ${wait}.`
          : `Aguarde ${wait} para solicitar um novo link.`;
      setRetryInMs(limit.retryInMs);
      setLimitMsg(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      registerResetAttempt();
      await sendPasswordResetEmail(
        parsed.data.email,
        window.location.origin + "/reset-password",
      );
      setSent(true);
      toast.success("Se o e-mail existir, enviaremos as instruções.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao enviar e-mail";
      toast.error(
        /rate limit|too many|429/i.test(msg)
          ? "Muitas solicitações. Aguarde alguns minutos e tente novamente."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }

  function handleResend() {
    const limit = checkResetRateLimit();
    if (!limit.allowed) {
      const wait = formatRetryDelay(limit.retryInMs);
      const msg =
        limit.reason === "blocked"
          ? `Muitas tentativas de recuperação. Tente novamente em ${wait}.`
          : `Aguarde ${wait} para solicitar um novo link.`;
      setRetryInMs(limit.retryInMs);
      setLimitMsg(msg);
      toast.error(msg);
      return;
    }
    setSent(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 mb-6 text-lg font-extrabold">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <span><span className="text-primary">Pronto</span>Pede</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          <h1 className="text-2xl font-bold">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Informe seu e-mail e enviaremos um link para você criar uma nova senha.
          </p>

          {sent ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg bg-muted p-4 text-sm">
                Se o e-mail estiver cadastrado, você receberá um link em instantes.
                Verifique também sua caixa de spam.
              </div>
              {limitMsg ? (
                <div
                  role="alert"
                  className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm"
                >
                  {limitMsg}
                </div>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleResend}
                disabled={retryInMs > 0}
              >
                {retryInMs > 0
                  ? `Reenviar em ${formatRetryDelay(retryInMs)}`
                  : "Reenviar link"}
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/entrar">Voltar para o login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 mt-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              {limitMsg ? (
                <div
                  role="alert"
                  className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm"
                >
                  {limitMsg}
                </div>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || retryInMs > 0}
              >
                {loading
                  ? "Enviando..."
                  : retryInMs > 0
                    ? `Aguarde ${formatRetryDelay(retryInMs)}`
                    : "Enviar link de recuperação"}
              </Button>
            </form>
          )}

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link to="/entrar" className="text-primary hover:underline">Sou cliente</Link>
            <Link to="/auth" className="text-primary hover:underline">Sou lojista</Link>
          </div>
        </div>
      </div>
    </div>
  );
}