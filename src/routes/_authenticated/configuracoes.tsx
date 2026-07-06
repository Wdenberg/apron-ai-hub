import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { StoreImage } from "@/components/StoreImage";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Upload, Store as StoreIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ProntoPede" }] }),
  component: SettingsPage,
});

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  whatsapp: z.string().trim().min(10).max(20),
  description: z.string().max(300).optional().or(z.literal("")),
  address: z.string().max(160).optional().or(z.literal("")),
  city: z.string().max(60).optional().or(z.literal("")),
  state: z.string().max(2).optional().or(z.literal("")),
});

type Store = {
  id: string; name: string; slug: string; whatsapp: string;
  description: string | null; address: string | null; city: string | null; state: string | null;
  is_open: boolean; logo_url: string | null; cover_url: string | null;
};

function SettingsPage() {
  const qc = useQueryClient();
  const { data: store, isLoading } = useQuery({
    queryKey: ["my-store-full"],
    queryFn: async () => {
      const { data } = await supabase.from("stores")
        .select("id, name, slug, whatsapp, description, address, city, state, is_open, logo_url, cover_url")
        .maybeSingle();
      return data as Store | null;
    },
  });

  const save = useMutation({
    mutationFn: async (payload: z.infer<typeof schema>) => {
      if (!store?.id) throw new Error("Sem loja");
      const { error } = await supabase.from("stores").update({
        name: payload.name,
        whatsapp: payload.whatsapp,
        description: payload.description || null,
        address: payload.address || null,
        city: payload.city || null,
        state: payload.state || null,
      }).eq("id", store.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-store-full"] });
      qc.invalidateQueries({ queryKey: ["my-store"] });
      toast.success("Configurações salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleOpen = useMutation({
    mutationFn: async (v: boolean) => {
      if (!store?.id) return;
      const { error } = await supabase.from("stores").update({ is_open: v }).eq("id", store.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-store-full"] }),
  });

  const uploadAsset = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: "logo" | "cover" }) => {
      if (!store?.id) throw new Error("Sem loja");
      if (file.size > 5 * 1024 * 1024) throw new Error("Arquivo maior que 5MB");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${store.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("store-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const col = kind === "logo" ? "logo_url" : "cover_url";
      const { error: uerr } = await supabase.from("stores").update({ [col]: path }).eq("id", store.id);
      if (uerr) throw uerr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-store-full"] });
      toast.success("Imagem enviada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: fd.get("name"), whatsapp: fd.get("whatsapp"),
      description: fd.get("description"), address: fd.get("address"),
      city: fd.get("city"), state: fd.get("state"),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    save.mutate(parsed.data);
  }

  if (isLoading) return <AppShell><div className="text-muted-foreground">Carregando...</div></AppShell>;
  if (!store) return <AppShell><div>Nenhuma loja encontrada.</div></AppShell>;

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações da loja</h1>
          <p className="text-muted-foreground">Ajuste os dados, imagens e o status da sua loja.</p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2">
          <span className="text-sm">Loja {store.is_open ? "aberta" : "fechada"}</span>
          <Switch checked={store.is_open} onCheckedChange={(v) => toggleOpen.mutate(v)} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><StoreIcon className="h-4 w-4 text-primary" /> Dados da loja</h2>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name">Nome da loja</Label>
              <Input id="name" name="name" defaultValue={store.name} required maxLength={80} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Link público</Label>
              <div className="text-sm rounded-md bg-muted px-3 py-2 border border-border">
                prontopede.com.br/loja/<span className="font-medium">{store.slug}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" name="whatsapp" defaultValue={store.whatsapp} required maxLength={20} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" name="city" defaultValue={store.city ?? ""} maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">UF</Label>
                <Input id="state" name="state" defaultValue={store.state ?? ""} maxLength={2} />
              </div>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="address">Endereço</Label>
              <Input id="address" name="address" defaultValue={store.address ?? ""} maxLength={160} placeholder="Rua, número, bairro" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="description">Sobre a sua loja</Label>
              <Textarea id="description" name="description" defaultValue={store.description ?? ""} maxLength={300} rows={3} />
            </div>
            <div className="sm:col-span-2 flex justify-end pt-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <div>
            <h2 className="font-semibold mb-3">Logo</h2>
            <div className="flex items-center gap-4">
              <StoreImage path={store.logo_url} alt="Logo" className="h-20 w-20 rounded-full object-cover border border-border" fallbackClassName="h-20 w-20 rounded-full border border-dashed border-border flex items-center justify-center" />
              <UploadButton onFile={(f) => uploadAsset.mutate({ file: f, kind: "logo" })} pending={uploadAsset.isPending} />
            </div>
          </div>
          <div>
            <h2 className="font-semibold mb-3">Capa</h2>
            <StoreImage path={store.cover_url} alt="Capa" className="h-32 w-full rounded-xl object-cover border border-border" fallbackClassName="h-32 w-full rounded-xl border border-dashed border-border flex items-center justify-center" />
            <div className="mt-3">
              <UploadButton onFile={(f) => uploadAsset.mutate({ file: f, kind: "cover" })} pending={uploadAsset.isPending} />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function UploadButton({ onFile, pending }: { onFile: (f: File) => void; pending: boolean }) {
  const [key, setKey] = useState(0);
  useEffect(() => { if (!pending) setKey((k) => k + 1); }, [pending]);
  return (
    <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-border bg-background hover:bg-accent cursor-pointer">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      Enviar imagem
      <input
        key={key}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={pending}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </label>
  );
}