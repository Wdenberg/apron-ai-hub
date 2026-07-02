import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Store,
  Menu,
  X,
  CreditCard,
  Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ShieldCheck } from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/vendas", label: "Venda rápida", icon: Receipt },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/assinatura", label: "Assinatura", icon: CreditCard },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();

  const { data: store } = useQuery({
    queryKey: ["my-store"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, slug, is_open, subscription_status, trial_ends_at")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => setOpen(false), [pathname]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-sidebar shrink-0">
        <SidebarInner storeName={store?.name} onSignOut={signOut} pathname={pathname} />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-sidebar h-full flex flex-col">
            <SidebarInner storeName={store?.name} onSignOut={signOut} pathname={pathname} onClose={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-30">
          <button
            className="lg:hidden -ml-2 p-2 rounded-md hover:bg-accent"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 font-semibold">
            <Store className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">{store?.name ?? "PRONTOPEDE"}</span>
          </div>
          <div className="flex-1" />
          {store?.slug && (
            <a
              href={`/loja/${store.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs sm:text-sm text-muted-foreground hover:text-primary underline underline-offset-4"
            >
              Ver loja pública
            </a>
          )}
          {store?.subscription_status === "trial" && (
            <span className="hidden sm:inline text-xs px-2 py-1 rounded-full bg-warning/20 text-warning-foreground font-medium">
              Teste grátis
            </span>
          )}
          {isAdmin.data && (
            <a href="/admin/dashboard" className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-medium inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Admin
            </a>
          )}
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarInner({
  storeName,
  onSignOut,
  pathname,
  onClose,
}: {
  storeName?: string | null;
  onSignOut: () => void;
  pathname: string;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="h-14 flex items-center px-4 border-b border-border justify-between">
        <a href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-primary">Pronto</span>
          <span>Pede</span>
        </a>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-accent" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <a
              key={to}
              href={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </a>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        {storeName && <div className="px-3 pb-2 text-xs text-muted-foreground truncate">{storeName}</div>}
        <Button variant="ghost" className="w-full justify-start" onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </>
  );
}