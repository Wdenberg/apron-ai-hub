import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(8).max(72),
  store_name: z.string().trim().min(2).max(80).optional(),
});

export const adminCreateLojista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const storeName = data.store_name ?? data.name;
    let slugBase = slugify(storeName) || "loja";
    let slug = slugBase;
    for (let i = 1; i < 20; i++) {
      const { data: exists } = await supabaseAdmin.from("stores").select("id").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = `${slugBase}-${i}`;
    }

    const { data: created, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name, signup_source: "owner" },
    });
    if (userErr || !created.user) throw new Error(userErr?.message ?? "Falha ao criar usuário");

    const { error: storeErr } = await supabaseAdmin.from("stores").insert({
      owner_id: created.user.id,
      name: storeName,
      slug,
      whatsapp: data.phone,
    });
    if (storeErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(storeErr.message);
    }

    return { user_id: created.user.id, slug };
  });