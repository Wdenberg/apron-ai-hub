import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StoreImage } from "@/components/StoreImage";
import { useAssetUrl } from "@/hooks/useAssets";
import { useAuthUser, useUpdateEmail, useUpdatePassword } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { Camera, Loader2, Save, KeyRound, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — ProntoPede" }] }),
  component: PerfilPage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(80),
  whatsapp: z.string().trim().min(8, "Informe um telefone válido").max(20),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "Mínimo de 8 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não coincidem" });

const emailSchema = z.string().trim().email("E-mail inválido").max(120);

function PerfilPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: user } = useAuthUser();
  const { data: profile, isLoading } = useProfile(user?.id);
  const updateProfileMut = useUpdateProfile();
  const updateEmailMut = useUpdateEmail();
  const updatePasswordMut = useUpdatePassword();
  const uploadAvatarMut = useUploadAvatar();
  const avatarPreview = useAssetUrl(profile?.avatar_url ?? null);

  const uploading = uploadAvatarMut.isPending;
  const savingProfile = updateProfileMut.isPending;
  const savingEmail = updateEmailMut.isPending;
  const savingPassword = updatePasswordMut.isPending;

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = profileSchema.safeParse({
      full_name: fd.get("full_name"),
      whatsapp: fd.get("whatsapp"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos");
      return;
    }
    updateProfileMut.mutate(
      {
        userId: user.id,
        patch: { full_name: parsed.data.full_name, whatsapp: parsed.data.whatsapp },
      },
      {
        onSuccess: () => toast.success("Perfil atualizado"),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  async function saveEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = emailSchema.safeParse(fd.get("email"));
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "E-mail inválido");
    if (parsed.data === user?.email) return toast.info("Este já é o seu e-mail atual");
    updateEmailMut.mutate(parsed.data, {
      onSuccess: () =>
        toast.success("Verifique seu novo e-mail para confirmar a alteração"),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = passwordSchema.safeParse({
      password: fd.get("password"),
      confirm: fd.get("confirm"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Senha inválida");
    updatePasswordMut.mutate(parsed.data.password, {
      onSuccess: () => {
        form.reset();
        toast.success("Senha atualizada");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    uploadAvatarMut.mutate(
      { userId: user.id, file },
      {
        onSuccess: () => toast.success("Foto atualizada"),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Meu perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Atualize suas informações pessoais, e-mail e senha da conta.
          </p>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Carregando...</div>
        ) : (
          <>
            {/* Avatar + info */}
            <section className="border rounded-xl p-6 bg-card">
              <div className="flex items-center gap-5">
                <div className="relative">
                  {profile?.avatar_url && avatarPreview ? (
                    <StoreImage
                      path={profile.avatar_url}
                      alt="Foto de perfil"
                      className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
                      fallbackClassName="h-20 w-20 rounded-full bg-primary/10"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-semibold ring-2 ring-border">
                      {(profile?.full_name ?? user?.email ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 disabled:opacity-60"
                    aria-label="Trocar foto"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{profile?.full_name ?? "Sem nome"}</div>
                  <div className="text-sm text-muted-foreground truncate">{user?.email}</div>
                </div>
              </div>

              <form onSubmit={saveProfile} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Nome completo</Label>
                  <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} maxLength={80} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp">Telefone / WhatsApp</Label>
                  <Input id="whatsapp" name="whatsapp" defaultValue={profile?.whatsapp ?? ""} placeholder="(21) 99999-0000" maxLength={20} required />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar alterações
                  </Button>
                </div>
              </form>
            </section>

            {/* Email */}
            <section className="border rounded-xl p-6 bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">E-mail de login</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Ao alterar o e-mail você receberá um link de confirmação no novo endereço.
              </p>
              <form onSubmit={saveEmail} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Novo e-mail</Label>
                  <Input id="email" name="email" type="email" defaultValue={user?.email ?? ""} maxLength={120} required />
                </div>
                <Button type="submit" variant="outline" disabled={savingEmail}>
                  {savingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Atualizar e-mail
                </Button>
              </form>
            </section>

            {/* Password */}
            <section className="border rounded-xl p-6 bg-card">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Alterar senha</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Use pelo menos 8 caracteres.</p>
              <form onSubmit={savePassword} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Nova senha</Label>
                  <Input id="password" name="password" type="password" minLength={8} maxLength={72} required autoComplete="new-password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirmar senha</Label>
                  <Input id="confirm" name="confirm" type="password" minLength={8} maxLength={72} required autoComplete="new-password" />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" variant="outline" disabled={savingPassword}>
                    {savingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Atualizar senha
                  </Button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}