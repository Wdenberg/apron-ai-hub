import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { updateUserPassword, signOutGlobal } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShoppingBag, Check, X } from "lucide-react";
import {
  evaluatePassword,
  passwordRules,
  PASSWORD_MIN,
  PASSWORD_MAX,
} from "@/lib/passwordPolicy";

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
  password: z
    .string()
    .max(PASSWORD_MAX, `A senha deve ter no máximo ${PASSWORD_MAX} caracteres`)
    .superRefine((v, ctx) => {
      const res = evaluatePassword(v);
      if (!res.valid) ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error! });
    }),
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
  const [validating, setValidating] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const strength = evaluatePassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  function mapAuthError(raw: string): string {
    const s = raw.toLowerCase();
    if (s.includes("expired")) return "Este link de recuperação expirou. Solicite um novo.";
    if (s.includes("invalid") || s.includes("not found") || s.includes("otp"))
      return "Link de recuperação inválido. Solicite um novo.";
    if (s.includes("used")) return "Este link já foi utilizado. Solicite um novo.";
    return raw;
  }

  useEffect(() => {
    let cancelled = false;

    // 1) Error carried in the URL hash (expired/invalid link from Supabase).
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    const search = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(search);

    const hashErr = hashParams.get("error_description") ?? hashParams.get("error");
    if (hashErr) {
      setError(mapAuthError(decodeURIComponent(hashErr.replace(/\+/g, " "))));
      setValidating(false);
      return;
    }

    // 2) Listen for the PASSWORD_RECOVERY event (implicit flow — hash tokens).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setError(null);
        setValidating(false);
      }
    });

    (async () => {
      // 3) PKCE flow: ?code=... — exchange for a session.
      const code = queryParams.get("code");
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exErr) {
          setError(mapAuthError(exErr.message));
          setValidating(false);
          return;
        }
        setReady(true);
        setValidating(false);
        return;
      }

      // 4) token_hash flow (?token_hash=&type=recovery).
      const tokenHash = queryParams.get("token_hash") ?? hashParams.get("token_hash");
      const type = queryParams.get("type") ?? hashParams.get("type");
      if (tokenHash && type === "recovery") {
        const { error: vErr } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
        if (cancelled) return;
        if (vErr) {
          setError(mapAuthError(vErr.message));
          setValidating(false);
          return;
        }
        setReady(true);
        setValidating(false);
        return;
      }

      // 5) Implicit flow — tokens already in hash; Supabase parses them automatically.
      //    Give it a brief grace window, then check the session.
      await new Promise((r) => setTimeout(r, 1200));
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session && (hash.includes("type=recovery") || hashParams.get("access_token"))) {
        setReady(true);
        setValidating(false);
        return;
      }
      if (!ready) {
        setError("Link de recuperação inválido ou expirado. Solicite um novo.");
        setValidating(false);
      }
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Dados inválidos";
      setFormError(msg);
      toast.error(msg);
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      await updateUserPassword(parsed.data.password);
      toast.success("Senha atualizada. Entre novamente.");
      await signOutGlobal();
      navigate({ to: "/entrar", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao atualizar senha";
      const s = msg.toLowerCase();
      if (s.includes("session") || s.includes("jwt") || s.includes("expired")) {
        setError("Sua sessão de recuperação expirou. Solicite um novo link.");
        setReady(false);
      } else {
        toast.error(mapAuthError(msg));
      }
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

          {validating ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              Validando link de recuperação...
            </div>
          ) : error ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm space-y-1">
                <p className="font-semibold">Não foi possível validar o link</p>
                <p>{error}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline">
                  <Link to="/entrar">Voltar ao login</Link>
                </Button>
                <Button asChild>
                  <Link to="/esqueci-senha">Solicitar novo link</Link>
                </Button>
              </div>
            </div>
          ) : ready ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}