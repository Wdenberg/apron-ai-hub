import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { whatsappLink } from "@/lib/format";
import { toast } from "sonner";
import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";

export const Route = createFileRoute("/admin/campanhas")({
  head: () => ({ meta: [{ title: "Campanhas — Admin ProntoPede" }] }),
  component: CampanhasPage,
});

type Recipient = { store_id: string; name: string; whatsapp: string; trial_days_left: number };
type Campaign = { id: string; segment: string; message_template: string; recipient_count: number; opened_count: number; created_at: string };

const SEGMENTS = [
  { value: "trial", label: "Em teste" },
  { value: "trial_expired", label: "Teste expirado" },
  { value: "active", label: "Assinantes ativos" },
  { value: "past_due", label: "Inadimplentes" },
  { value: "canceled", label: "Cancelados/bloqueados" },
  { value: "all", label: "Todos" },
];

function CampanhasPage() {
  const qc = useQueryClient();
  const [segment, setSegment] = useState("trial");
  const [message, setMessage] = useState("Olá {{nome_loja}}! Aqui é da ProntoPede. Como está sua experiência?");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [sentRecipients, setSentRecipients] = useState<{ id: string; name: string; whatsapp: string; text: string }[]>([]);

  const recipients = useQuery({
    queryKey: ["admin", "segment", segment],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_segment_stores", { _segment: segment });
      if (error) throw error;
      return (data ?? []) as Recipient[];
    },
  });

  const history = useQuery({
    queryKey: ["admin", "campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_campaigns");
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const recs = (recipients.data ?? []).map((r) => ({
        store_id: r.store_id,
        message: message.replace(/\{\{nome_loja\}\}/g, r.name).replace(/\{\{dias_restantes\}\}/g, String(r.trial_days_left)),
      }));
      const { data, error } = await supabase.rpc("admin_create_campaign", {
        _segment: segment,
        _message_template: message,
        _recipients: recs,
      });
      if (error) throw error;
      return { id: data as unknown as string, recipients: recs };
    },
    onSuccess: async (result) => {
      const { data } = await supabase
        .from("communications_recipients")
        .select("id, store_id, rendered_message")
        .eq("communication_id", result.id);
      const enriched = (data ?? []).map((row) => {
        const rec = (recipients.data ?? []).find((r) => r.store_id === row.store_id);
        return { id: row.id, name: rec?.name ?? "Loja", whatsapp: rec?.whatsapp ?? "", text: row.rendered_message };
      });
      setCampaignId(result.id);
      setSentRecipients(enriched);
      qc.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      toast.success(`Campanha criada com ${enriched.length} destinatários`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Campanhas WhatsApp">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Nova campanha</h2>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Segmento</label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEGMENTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground mt-1">{recipients.data?.length ?? 0} destinatários</div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mensagem</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={800} className="mt-1" />
            <div className="text-xs text-muted-foreground mt-1">Variáveis: <code>{"{{nome_loja}}"}</code>, <code>{"{{dias_restantes}}"}</code></div>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => create.mutate()} disabled={!message.trim() || !recipients.data?.length || create.isPending}>
            <Send className="h-4 w-4 mr-2" /> Criar campanha
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-3">Links para abrir</h2>
          {!campaignId && <div className="text-sm text-muted-foreground">Crie uma campanha para gerar os links WhatsApp.</div>}
          {campaignId && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sentRecipients.map((r) => (
                <a
                  key={r.id}
                  href={whatsappLink(r.whatsapp, r.text)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => supabase.rpc("admin_mark_recipient_opened", { _recipient_id: r.id })}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.text}</div>
                  </div>
                  <MessageCircle className="h-4 w-4 text-success shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card overflow-hidden overflow-x-auto">
        <div className="px-5 py-3 border-b border-border font-semibold">Histórico de campanhas</div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Quando</th>
              <th className="text-left px-4 py-2">Segmento</th>
              <th className="text-left px-4 py-2">Mensagem</th>
              <th className="text-right px-4 py-2">Destinat.</th>
              <th className="text-right px-4 py-2">Abertos</th>
            </tr>
          </thead>
          <tbody>
            {history.data?.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-2 text-xs">{new Date(c.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2 text-xs">{c.segment}</td>
                <td className="px-4 py-2 text-xs truncate max-w-md">{c.message_template}</td>
                <td className="px-4 py-2 text-right text-xs">{c.recipient_count}</td>
                <td className="px-4 py-2 text-right text-xs">{c.opened_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}