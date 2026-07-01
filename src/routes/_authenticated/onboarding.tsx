import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { slugify } from "@/lib/format";
import { ChefHat } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Configure sua loja — ProntoPede" }] }),
  component: Onboarding,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome da loja").max(80),
  slug: z.string().trim().regex(/^[a-z0-9-]{3,40}$/i, "Use 3-40 letras/números/hífen"),
  whatsapp: z.string().trim().min(10, "Informe um WhatsApp válido").max(20),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  state: z.string().trim().max(2).optional().or(z.literal("")),
  description: z.string().max(300).optional().or(z.literal("")),
});

function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("stores").select("id").maybeSingle();
      if (data) navigate({ to: "/dashboard", replace: true });
    })();
  }, [navigate]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: fd.get("name"),
      slug: fd.get("slug"),
      whatsapp: fd.get("whatsapp"),
      city: fd.get("city"),
      state: fd.get("state"),
      description: fd.get("description"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setLoading(false); return; }
    const { error } = await supabase.from("stores").insert({
      owner_id: user.user.id,
      name: parsed.data.name,
      slug: parsed.data.slug.toLowerCase(),
      whatsapp: parsed.data.whatsapp,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      description: parsed.data.description || null,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Loja criada! Vamos começar.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <ChefHat className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Vamos configurar sua loja</h1>
            <p className="text-sm text-muted-foreground">Leva menos de 2 minutos.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="name">Nome da loja</Label>
            <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Marmitas da Dona Zefa" required maxLength={80} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="slug">Link da loja</Label>
            <div className="flex items-center rounded-md border border-input focus-within:ring-2 focus-within:ring-ring bg-background overflow-hidden">
              <span className="px-3 text-sm text-muted-foreground bg-muted h-10 flex items-center border-r border-input">prontopede.com.br/loja/</span>
              <input
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true); }}
                className="flex-1 h-10 px-3 bg-transparent outline-none text-sm"
                required
                pattern="[a-z0-9-]{3,40}"
                maxLength={40}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" name="whatsapp" placeholder="(21) 99999-0000" required maxLength={20} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" name="city" placeholder="Rio de Janeiro" maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">UF</Label>
              <Input id="state" name="state" placeholder="RJ" maxLength={2} />
            </div>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="description">Sobre a sua loja</Label>
            <Textarea id="description" name="description" placeholder="Uma frase curta sobre o que você vende." maxLength={300} />
          </div>
          <div className="sm:col-span-2 flex justify-end pt-2">
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? "Criando..." : "Criar minha loja"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}