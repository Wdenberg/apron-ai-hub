import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { StoreImage } from "@/components/StoreImage";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMyStoreFull,
  useProductsCount,
  useUpdateStore,
  useToggleStoreOpen,
  useUploadStoreAsset,
  useCreateStore,
} from "@/hooks/useStore";
import { getCurrentUser } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Upload, Store as StoreIcon, Rocket } from "lucide-react";
import { slugify } from "@/lib/format";

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
  const navigate = useNavigate();
  const { data: store, isLoading } = useMyStoreFull();
  const { data: productsCount } = useProductsCount(store?.id);
  const save = useUpdateStore();
  const toggleOpen = useToggleStoreOpen();
  const uploadAsset = useUploadStoreAsset();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: fd.get("name"), whatsapp: fd.get("whatsapp"),
      description: fd.get("description"), address: fd.get("address"),
      city: fd.get("city"), state: fd.get("state"),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    if (!store?.id) { toast.error("Sem loja"); return; }
    save.mutate(
      {
        id: store.id,
        patch: {
          name: parsed.data.name,
          whatsapp: parsed.data.whatsapp,
          description: parsed.data.description || null,
          address: parsed.data.address || null,
          city: parsed.data.city || null,
          state: parsed.data.state || null,
        },
      },
      {
        onSuccess: () => toast.success("Configurações salvas"),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  if (isLoading) return <AppShell><div className="text-muted-foreground">Carregando...</div></AppShell>;
  if (!store) return (
    <AppShell>
      <CreateStoreForm onCreated={() => {
        qc.invalidateQueries({ queryKey: ["my-store-full"] });
        toast.message("Agora cadastre seu primeiro produto.");
        navigate({ to: "/produtos" });
      }} />
    </AppShell>
  );

  return (
    <AppShell>
      {productsCount === 0 && (
        <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-semibold">Próximo passo: monte seu catálogo</div>
            <p className="text-sm text-muted-foreground">Cadastre seus produtos com nome, foto, descrição e preço para começar a vender.</p>
          </div>
          <Link to="/produtos"><Button><Rocket className="h-4 w-4 mr-1" /> Criar produtos</Button></Link>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações da loja</h1>
          <p className="text-muted-foreground">Ajuste os dados, imagens e o status da sua loja.</p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2">
          <span className="text-sm">Loja {store.is_open ? "aberta" : "fechada"}</span>
          <Switch
            checked={store.is_open}
            onCheckedChange={(v) => toggleOpen.mutate({ id: store.id, isOpen: v })}
          />
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
              <UploadButton onFile={(f) => uploadAsset.mutate({ storeId: store.id, file: f, kind: "logo" }, { onSuccess: () => toast.success("Imagem enviada"), onError: (e: Error) => toast.error(e.message) })} pending={uploadAsset.isPending} />
            </div>
          </div>
          <div>
            <h2 className="font-semibold mb-3">Capa</h2>
            <StoreImage path={store.cover_url} alt="Capa" className="h-32 w-full rounded-xl object-cover border border-border" fallbackClassName="h-32 w-full rounded-xl border border-dashed border-border flex items-center justify-center" />
            <div className="mt-3">
              <UploadButton onFile={(f) => uploadAsset.mutate({ storeId: store.id, file: f, kind: "cover" }, { onSuccess: () => toast.success("Imagem enviada"), onError: (e: Error) => toast.error(e.message) })} pending={uploadAsset.isPending} />
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

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da loja").max(80),
  slug: z.string().trim().regex(/^[a-z0-9-]{3,40}$/i, "Use 3-40 letras, números ou hífen"),
  whatsapp: z.string().trim().min(10, "WhatsApp inválido").max(20),
  city: z.string().max(60).optional().or(z.literal("")),
  state: z.string().max(2).optional().or(z.literal("")),
  description: z.string().max(300).optional().or(z.literal("")),
});

function CreateStoreForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!slugTouched) setSlug(slugify(name)); }, [name, slugTouched]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = createSchema.safeParse({
      name: fd.get("name"),
      slug: fd.get("slug"),
      whatsapp: fd.get("whatsapp"),
      city: fd.get("city"),
      state: fd.get("state"),
      description: fd.get("description"),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) { setLoading(false); return; }
      await createStoreSvc({
        owner_id: user.id,
        name: parsed.data.name,
        slug: parsed.data.slug.toLowerCase(),
        whatsapp: parsed.data.whatsapp,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        description: parsed.data.description || null,
      });
      toast.success("Loja criada!");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar loja");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full mb-3">
          <Rocket className="h-3 w-3" /> Comece por aqui
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Crie sua loja pública</h1>
        <p className="text-muted-foreground">Você recebe um link exclusivo em prontopede.com.br/loja/…</p>
      </div>
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="name">Nome da loja</Label>
          <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Ex.: Marmitas da Dona Zefa" />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="slug">Link da loja</Label>
          <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
            <span className="px-3 text-sm text-muted-foreground bg-muted h-10 flex items-center border-r border-input">prontopede.com.br/loja/</span>
            <input id="slug" name="slug" value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true); }}
              className="flex-1 h-10 px-3 bg-transparent outline-none text-sm" required pattern="[a-z0-9-]{3,40}" maxLength={40} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" placeholder="(21) 99999-0000" required maxLength={20} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" name="city" maxLength={60} placeholder="Rio de Janeiro" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">UF</Label>
            <Input id="state" name="state" maxLength={2} placeholder="RJ" />
          </div>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="description">Sobre a sua loja</Label>
          <Textarea id="description" name="description" maxLength={300} rows={3} placeholder="Uma frase curta sobre o que você vende." />
        </div>
        <div className="sm:col-span-2 flex justify-end pt-2">
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar minha loja
          </Button>
        </div>
      </form>
    </div>
  );
}