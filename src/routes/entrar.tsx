import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  getCurrentUser,
  signInWithPassword,
  signUpWithPassword,
} from "@/services/authService";
import {
  isPhoneTakenByOther,
  updateProfile,
} from "@/services/profileService";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { customerSignupSchema, normalizePhone } from "@/lib/customer-validation";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — ProntoPede" },
      { name: "description", content: "Crie sua conta ou entre para acompanhar seus pedidos." },
    ],
  }),
  validateSearch: searchSchema,
  component: CustomerAuth,
});

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(6, "Senha inválida"),
});

function CustomerAuth() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "signup");
  const [loading, setLoading] = useState(false);
  const redirectTo = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/minhas-compras";

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) navigate({ to: redirectTo, replace: true });
    });
  }, [navigate, redirectTo]);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = customerSignupSchema.safeParse({
      name: fd.get("name"),
      email: fd.get("email"),
      whatsapp: fd.get("whatsapp"),
      password: fd.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Preencha os dados");
      return;
    }
    setLoading(true);
    try {
      // Check phone uniqueness before signup
      const taken = await isPhoneTakenByOther(parsed.data.whatsapp);
      if (taken) {
        toast.error("Este telefone já está cadastrado em outra conta.");
        setLoading(false);
        return;
      }
      const signup = await signUpWithPassword(
        parsed.data.email,
        parsed.data.password,
        {
          emailRedirectTo: window.location.origin + redirectTo,
          data: {
            full_name: parsed.data.name,
            signup_source: "customer",
          },
        },
      );
      // Trigger created profile with full_name; persist whatsapp
      if (signup.user) {
        await updateProfile(signup.user.id, {
          whatsapp: parsed.data.whatsapp,
          full_name: parsed.data.name,
        });
      }
      toast.success("Conta criada! Bem-vindo.");
      navigate({ to: redirectTo, replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao criar conta";
      toast.error(/already registered/i.test(msg) ? "E-mail já cadastrado." : msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setLoading(true);
    try {
      await signInWithPassword(parsed.data.email, parsed.data.password);
      navigate({ to: redirectTo, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      // Store redirect for post-google phone-completion flow
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("pp:post-auth-redirect", redirectTo);
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/entrar",
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: redirectTo, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no login com Google");
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
          <h1 className="text-2xl font-bold">
            {mode === "signup" ? "Crie sua conta" : "Entrar"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup"
              ? "Acompanhe seus pedidos e compre mais rápido."
              : "Acesse seu histórico de pedidos."}
          </p>

          <Button variant="outline" className="w-full mt-5" onClick={handleGoogle} disabled={loading}>
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continuar com Google
          </Button>

          <div className="my-5 flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">ou com e-mail</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {mode === "signup" ? (
            <form onSubmit={handleSignup} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" required minLength={2} maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">Telefone (WhatsApp)</Label>
                <Input id="whatsapp" name="whatsapp" placeholder="(11) 99999-0000" required
                  onChange={(e) => {
                    const digits = normalizePhone(e.target.value);
                    e.target.setCustomValidity(digits.length >= 10 ? "" : "Telefone incompleto");
                  }} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Aguarde..." : "Criar conta"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link to="/esqueci-senha" className="text-xs text-primary hover:underline">
                    Esqueci minha senha
                  </Link>
                </div>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Aguarde..." : "Entrar"}
              </Button>
            </form>
          )}

          <p className="mt-5 text-sm text-center text-muted-foreground">
            {mode === "signup" ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
            <button
              type="button"
              className="text-primary font-medium hover:underline"
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            >
              {mode === "signup" ? "Entrar" : "Criar grátis"}
            </button>
          </p>
        </div>
        <p className="mt-4 text-xs text-center text-muted-foreground">
          É lojista?{" "}
          <Link to="/auth" className="text-primary hover:underline">Acesse o painel</Link>
        </p>
      </div>
    </div>
  );
}
