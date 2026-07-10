import { createFileRoute } from "@tanstack/react-router";
import {
  useAdminTeam,
  useInviteAdmin,
  useCreateAdmin,
} from "@/hooks/admin/useAdminTeam";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { ShieldCheck, Mail, UserPlus } from "lucide-react";

export const Route = createFileRoute("/admin/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Admin ProntoPede" }] }),
  component: EquipePage,
});

function EquipePage() {
  const [email, setEmail] = useState("");
  const [createForm, setCreateForm] = useState({ email: "", password: "", full_name: "" });

  const team = useAdminTeam();
  const inviteBase = useInviteAdmin();
  const invite = {
    isPending: inviteBase.isPending,
    mutate: () =>
      inviteBase.mutate(email, {
        onSuccess: (data) => {
          toast.success(data.status === "promoted" ? "Usuário promovido a admin" : "Convite pendente registrado");
          setEmail("");
        },
        onError: (e: Error) => toast.error(e.message),
      }),
  };

  const createAdminMut = useCreateAdmin();
  const createAdmin = {
    isPending: createAdminMut.isPending,
    mutate: () =>
      createAdminMut.mutate(createForm, {
        onSuccess: (res) => {
          toast.success(res.created ? "Admin criado — já pode entrar com e-mail e senha" : "Usuário existente promovido a admin");
          setCreateForm({ email: "", password: "", full_name: "" });
        },
        onError: (e: Error) => toast.error(e.message),
      }),
  };

  return (
    <AdminShell title="Equipe de admins">
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border font-semibold">Sócios com acesso admin</div>
          <div className="divide-y divide-border">
            {team.isLoading && <div className="p-6 text-center text-muted-foreground text-sm">Carregando...</div>}
            {team.data?.map((r) => (
              <div key={`${r.user_id ?? "invite"}-${r.email}`} className="px-5 py-3 flex items-center gap-3">
                <span className={`h-9 w-9 rounded-full flex items-center justify-center ${r.invited ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                  {r.invited ? <Mail className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.full_name ?? r.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.invited ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
                  {r.invited ? "Convite pendente" : "Admin"}
                </span>
              </div>
            ))}
            {team.data && !team.data.length && <div className="p-6 text-center text-muted-foreground text-sm">Nenhum admin ainda.</div>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <UserPlus className="h-4 w-4" />
              </span>
              <h3 className="font-semibold">Criar admin com senha</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Cria a conta já ativa. O novo admin faz login direto com e-mail e senha.</p>
            <div className="space-y-2">
              <Input placeholder="Nome (opcional)" value={createForm.full_name} onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))} maxLength={80} />
              <Input type="email" placeholder="socio@empresa.com" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} maxLength={255} autoComplete="off" />
              <Input type="password" placeholder="Senha (mín. 8 caracteres)" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} minLength={8} maxLength={72} autoComplete="new-password" />
            </div>
            <Button
              className="w-full mt-3"
              disabled={!createForm.email || createForm.password.length < 8 || createAdmin.isPending}
              onClick={() => createAdmin.mutate()}
            >
              {createAdmin.isPending ? "Criando..." : "Criar admin"}
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Convidar por e-mail</h3>
            <p className="text-xs text-muted-foreground mb-3">Se o e-mail já tem conta, é promovido na hora. Caso contrário, vira admin assim que se cadastrar.</p>
            <Input type="email" placeholder="socio@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
            <Button variant="outline" className="w-full mt-3" disabled={!email || invite.isPending} onClick={() => invite.mutate()}>Convidar</Button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}