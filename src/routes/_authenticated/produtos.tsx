import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/format";
import { Plus, Package, Pencil, Upload, Loader2, ImagePlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Produtos — ProntoPede" }] }),
  component: ProductsPage,
});

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  active: boolean;
  photo_url: string | null;
};

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().max(300).optional().or(z.literal("")),
  price: z.coerce.number().min(0).max(99999),
  stock: z.coerce.number().int().min(0).max(99999),
  category: z.string().max(40).optional().or(z.literal("")),
});

function ProductsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [categoryValue, setCategoryValue] = useState<string>("");

  const { data: store } = useQuery({
    queryKey: ["my-store"],
    queryFn: async () => (await supabase.from("stores").select("id").maybeSingle()).data,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("store_id", store!.id).order("created_at", { ascending: false });
      return (data ?? []) as Product[];
    },
  });

  const categories = Array.from(new Set((products ?? []).map((p) => p.category).filter(Boolean))) as string[];

  function openNew() {
    setEditing(null);
    setPhotoPath(null);
    setCategoryValue("");
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setPhotoPath(p.photo_url);
    setCategoryValue(p.category ?? "");
    setDialogOpen(true);
  }

  async function handlePhoto(file: File) {
    if (!store?.id) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem maior que 5MB"); return; }
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${store.id}/produtos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("store-assets").upload(path, file, { contentType: file.type });
    setUploadingPhoto(false);
    if (error) { toast.error(error.message); return; }
    setPhotoPath(path);
  }

  const upsert = useMutation({
    mutationFn: async (payload: z.infer<typeof schema> & { id?: string }) => {
      if (!store?.id) throw new Error("Sem loja");
      const row = {
        store_id: store.id,
        name: payload.name,
        description: payload.description || null,
        price: payload.price,
        stock: payload.stock,
        category: payload.category || null,
        active: payload.stock > 0,
        photo_url: photoPath,
      };
      if (payload.id) {
        const { error } = await supabase.from("products").update(row).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false); setEditing(null); setPhotoPath(null); setCategoryValue("");
      toast.success("Produto salvo!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: fd.get("name"),
      description: fd.get("description"),
      price: fd.get("price"),
      stock: fd.get("stock"),
      category: categoryValue,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    upsert.mutate({ ...parsed.data, id: editing?.id });
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Cadastre e mantenha seu cardápio sempre atualizado.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditing(null); setPhotoPath(null); setCategoryValue(""); } }}>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo produto</Button>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Foto do produto</Label>
                <div className="flex items-center gap-4">
                  {photoPath ? (
                    <StoreImage path={photoPath} alt="Produto" className="h-20 w-20 rounded-lg object-cover border border-border" fallbackClassName="h-20 w-20 rounded-lg border border-dashed border-border flex items-center justify-center" />
                  ) : (
                    <div className="h-20 w-20 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-border bg-background hover:bg-accent cursor-pointer">
                    {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {photoPath ? "Trocar" : "Enviar"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.currentTarget.value = ""; }} />
                  </label>
                  {photoPath && (
                    <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setPhotoPath(null)}>
                      Remover
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" defaultValue={editing?.name ?? ""} required maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" name="description" defaultValue={editing?.description ?? ""} maxLength={300} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={editing?.price ?? ""} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stock">Estoque</Label>
                  <Input id="stock" name="stock" type="number" step="1" min="0" defaultValue={editing?.stock ?? 0} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Categoria</Label>
                <Input id="category" list="category-options" value={categoryValue}
                  onChange={(e) => setCategoryValue(e.target.value)}
                  maxLength={40} placeholder="Ex.: Marmitas, Bebidas, Sobremesas" />
                <datalist id="category-options">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {categories.map((c) => (
                      <button type="button" key={c} onClick={() => setCategoryValue(c)}
                        className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-accent">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : !products?.length ? (
        <EmptyState onNew={openNew} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <StoreImage path={p.photo_url} alt={p.name} className="h-16 w-16 rounded-lg object-cover border border-border shrink-0" fallbackClassName="h-16 w-16 rounded-lg border border-dashed border-border flex items-center justify-center shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
                </div>
                <button className="text-muted-foreground hover:text-primary" onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {p.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-primary font-bold text-lg">{formatBRL(p.price)}</div>
                <div className={`text-xs px-2 py-1 rounded-full ${p.stock > 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {p.stock > 0 ? `${p.stock} em estoque` : "Sem estoque"}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Visível no cardápio</span>
                <Switch
                  checked={p.active}
                  disabled={p.stock === 0}
                  onCheckedChange={(v) => toggleActive.mutate({ id: p.id, active: v })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
      <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
        <Package className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold text-lg">Nenhum produto cadastrado</h3>
      <p className="text-muted-foreground text-sm mt-1">Adicione seu primeiro item para começar a vender.</p>
      <Button className="mt-4" onClick={onNew}><Plus className="h-4 w-4 mr-1" /> Novo produto</Button>
    </div>
  );
}