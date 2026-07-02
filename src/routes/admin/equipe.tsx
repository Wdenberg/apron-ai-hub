import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { ShieldCheck, Mail } from "lucide-react";

export const Route = createFileRoute("/admin/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Admin ProntoPede" }] }),
  component: EquipePage,
});

type Row = { user_id: string | null; email: string; full_name: string | null; invited: boolean };

function EquipePage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const team = useQuery({
    queryKey: ["admin", "team"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_team");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_invite", { _email: email });
      if (error) throw error;
      return data as unknown as { status: string };
    },
    onSuccess: (data) => {
      toast.success(data.status === "promoted" ? "Usuário promovido a admin" : "Convite pendente registrado");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin", "team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Equipe de admins">
      <div className="grid lg:grid-cols-3 gap-6">
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

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-3">Convidar novo admin</h3>
          <p className="text-xs text-muted-foreground mb-3">Se o e-mail já tem conta, é promovido na hora. Caso contrário, vira admin assim que se cadastrar.</p>
          <Input type="email" placeholder="socio@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          <Button className="w-full mt-3" disabled={!email || invite.isPending} onClick={() => invite.mutate()}>Convidar</Button>
        </div>
      </div>
    </AdminShell>
  );
}