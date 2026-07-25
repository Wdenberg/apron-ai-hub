import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { updateUserPassword, signOutGlobal } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — ProntoPede" },
      { name: "description", content: "Defina uma nova senha para sua conta ProntoPede." },
    ],
  }),
  component: ResetPasswordPage,
});

const schema = z.object({
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "As senhas não coincidem",
  path: ["confirm"],
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase JS auto-processes the recovery token in the URL hash and
    // fires a PASSWORD_RECOVERY event with a temporary session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setError(null);
      }
    });

    // If arriving with an existing session (e.g. token already parsed), allow.
    supabase.auth.getSession().then(({ data }) => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (data.session && hash.includes("type=recovery")) setReady(true);
    });

    // Detect error in hash (expired link, etc.)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const err = params.get("error_description") ?? params.get("error");
      if (err) setError(decodeURIComponent(err.replace(/\+/g, " ")));
    }

    // Grace window: if no recovery event within 1.5s and no session, mark as invalid link.
    const t = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) setError((e) => e ?? "Link inválido ou expirado. Solicite um novo.");
    }, 1500);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(t);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      password: fd.get("password"),
      confirm: fd.get("confirm"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      await updateUserPassword(parsed.data.password);
      toast.success("Senha atualizada. Entre novamente.");
      await signOutGlobal();
      navigate({ to: "/entrar", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 mb-6 text-lg font-extrabold">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <span><span className="text-primary">Pronto</span>Pede</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          <h1 className="text-2xl font-bold">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha uma nova senha para acessar sua conta.
          </p>

          {error ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm">
                {error}
              </div>
              <Button asChild className="w-full">
                <Link to="/esqueci-senha">Solicitar novo link</Link>
              </Button>
            </div>
          ) : !ready ? (
            <div className="mt-6 text-sm text-muted-foreground">Validando link...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 mt-5">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nova senha</Label>
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={6} required />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}