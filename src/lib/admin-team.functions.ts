import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createAdminSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  full_name: z.string().trim().min(2).max(80).optional(),
});

export const adminCreateAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createAdminSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // If a user with this email already exists, just grant the admin role.
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(listErr.message);
    const existing = list.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());

    let userId: string;
    let created = false;
    if (existing) {
      userId = existing.id;
    } else {
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name ?? data.email, signup_source: "admin_team" },
      });
      if (createErr || !newUser?.user) throw new Error(createErr?.message ?? "Falha ao criar usuário");
      userId = newUser.user.id;
      created = true;
    }

    const { error: roleInsertErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleInsertErr) throw new Error(roleInsertErr.message);

    return { user_id: userId, created, status: created ? "created" : "promoted" as const };
  });