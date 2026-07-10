import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { StoreImage } from "@/components/StoreImage";
import { useMyStoreShell } from "@/hooks/useStore";
import {
  useProducts,
  useUpsertProduct,
  useToggleProductActive,
  useUploadProductPhoto,
  useUpdateProductStock,
  useDeleteProducts,
} from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBRL } from "@/lib/format";
import {
  Plus,
  Package,
  Pencil,
  Upload,
  Loader2,
  ImagePlus,
  Trash2,
  Boxes,
} from "lucide-react";
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
  const [editing, setEditing] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [categoryValue, setCategoryValue] = useState<string>("");
  const [activeValue, setActiveValue] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockValue, setStockValue] = useState<string>("");
  const [deleteOne, setDeleteOne] = useState<Product | null>(null);
  const [deleteBulk, setDeleteBulk] = useState(false);

  const { data: store } = useMyStoreShell();
  const { data: products, isLoading } = useProducts(store?.id);
  const uploadPhotoMut = useUploadProductPhoto();
  const uploadingPhoto = uploadPhotoMut.isPending;
  const updateStock = useUpdateProductStock();
  const deleteProductsMut = useDeleteProducts();

  const categories = Array.from(new Set((products ?? []).map((p) => p.category).filter(Boolean))) as string[];

  const productIds = useMemo(() => (products ?? []).map((p) => p.id), [products]);
  const allSelected =
    productIds.length > 0 && selectedIds.size === productIds.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === productIds.length ? new Set() : new Set(productIds),
    );
  }

  function openNew() {
    setEditing(null);
    setPhotoPath(null);
    setCategoryValue("");
    setActiveValue(true);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setPhotoPath(p.photo_url);
    setCategoryValue(p.category ?? "");
    setActiveValue(p.active);
    setDialogOpen(true);
  }

  function openStock(p: Product) {
    setStockTarget(p);
    setStockValue(String(p.stock));
  }

  function handlePhoto(file: File) {
    if (!store?.id) return;
    uploadPhotoMut.mutate(
      { storeId: store.id, file },
      {
        onSuccess: (path) => setPhotoPath(path),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  const upsert = useUpsertProduct();
  const toggleActive = useToggleProductActive();

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
    if (!store?.id) { toast.error("Sem loja"); return; }
    upsert.mutate(
      {
        id: editing?.id,
        row: {
          store_id: store.id,
          name: parsed.data.name,
          description: parsed.data.description || null,
          price: parsed.data.price,
          stock: parsed.data.stock,
          category: parsed.data.category || null,
          active: parsed.data.stock > 0 ? activeValue : false,
          photo_url: photoPath,
        },
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setEditing(null);
          setPhotoPath(null);
          setCategoryValue("");
          setActiveValue(true);
          toast.success("Produto salvo!");
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  function submitStock() {
    if (!stockTarget) return;
    const n = Number(stockValue);
    if (!Number.isFinite(n) || n < 0 || n > 99999) {
      toast.error("Quantidade inválida");
      return;
    }
    updateStock.mutate(
      { id: stockTarget.id, stock: Math.floor(n) },
      {
        onSuccess: () => {
          toast.success("Estoque atualizado!");
          setStockTarget(null);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  function confirmDelete(ids: string[], onDone?: () => void) {
    deleteProductsMut.mutate(ids, {
      onSuccess: () => {
        toast.success(
          ids.length > 1
            ? `${ids.length} produtos excluídos`
            : "Produto excluído",
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        onDone?.();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Cadastre e mantenha seu cardápio sempre atualizado.</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) {
              setEditing(null);
              setPhotoPath(null);
              setCategoryValue("");
              setActiveValue(true);
            }
          }}
        >
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
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label className="text-sm">Visível no cardápio</Label>
                  <p className="text-xs text-muted-foreground">
                    Produto ativo aparece na loja pública.
                  </p>
                </div>
                <Switch
                  checked={activeValue}
                  onCheckedChange={setActiveValue}
                  aria-label="Produto ativo"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {products && products.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleSelectAll}
              aria-label="Selecionar todos"
            />
            <span className="text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} selecionado${selectedIds.size > 1 ? "s" : ""}`
                : "Selecionar todos"}
            </span>
          </label>
          <Button
            size="sm"
            variant="destructive"
            disabled={!selectedIds.size || deleteProductsMut.isPending}
            onClick={() => setDeleteBulk(true)}
          >
            {deleteProductsMut.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            Excluir selecionados
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : !products?.length ? (
        <EmptyState onNew={openNew} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border bg-card p-5 flex flex-col transition-colors ${
                selectedIds.has(p.id)
                  ? "border-primary ring-1 ring-primary"
                  : "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(p.id)}
                  onCheckedChange={() => toggleSelected(p.id)}
                  aria-label={`Selecionar ${p.name}`}
                  className="mt-1"
                />
                <StoreImage path={p.photo_url} alt={p.name} className="h-16 w-16 rounded-lg object-cover border border-border shrink-0" fallbackClassName="h-16 w-16 rounded-lg border border-dashed border-border flex items-center justify-center shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted"
                    onClick={() => openEdit(p)}
                    aria-label="Editar produto"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted"
                    onClick={() => setDeleteOne(p)}
                    aria-label="Excluir produto"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {p.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-primary font-bold text-lg">{formatBRL(p.price)}</div>
                <button
                  type="button"
                  onClick={() => openStock(p)}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full hover:brightness-95 ${
                    p.stock > 0
                      ? "bg-success/15 text-success"
                      : "bg-destructive/15 text-destructive"
                  }`}
                  title="Atualizar estoque"
                >
                  <Boxes className="h-3 w-3" />
                  {p.stock > 0 ? `${p.stock} em estoque` : "Sem estoque"}
                </button>
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

      <Dialog
        open={!!stockTarget}
        onOpenChange={(o) => !o && setStockTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Atualizar estoque</DialogTitle>
          </DialogHeader>
          {stockTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Produto: <span className="font-medium text-foreground">{stockTarget.name}</span>
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="stock-quick">Nova quantidade</Label>
                <Input
                  id="stock-quick"
                  type="number"
                  min="0"
                  step="1"
                  value={stockValue}
                  onChange={(e) => setStockValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitStock();
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={submitStock} disabled={updateStock.isPending}>
              {updateStock.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteOne}
        onOpenChange={(o) => !o && setDeleteOne(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto <span className="font-medium">{deleteOne?.name}</span> será
              removido permanentemente. Essa ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteOne) return;
                confirmDelete([deleteOne.id], () => setDeleteOne(null));
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteBulk} onOpenChange={setDeleteBulk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selectedIds.size} produto{selectedIds.size > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os produtos selecionados serão removidos permanentemente. Essa
              ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                confirmDelete(Array.from(selectedIds), () => setDeleteBulk(false))
              }
            >
              Excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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