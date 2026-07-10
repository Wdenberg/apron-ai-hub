import { Link, useRouterState } from "@tanstack/react-router";
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
  UserCircle,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useMyStoreShell } from "@/hooks/useStore";
import { useSignOut } from "@/hooks/useAuth";
import { ShieldCheck } from "lucide-react";

/**
 * Minimal outline cash register icon (matches lucide stroke weight/size).
 */
function CashRegister({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="10" width="18" height="10" rx="2" />
      <rect x="6" y="4" width="12" height="6" rx="1" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h8" />
    </svg>
  );
}

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon | ((p: { className?: string }) => JSX.Element);
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Gestão e operação",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
      { to: "/produtos", label: "Produtos", icon: Package },
      { to: "/vendas", label: "Venda rápida", icon: CashRegister },
      { to: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    title: "Análise",
    items: [{ to: "/relatorios", label: "Relatórios", icon: BarChart3 }],
  },
  {
    title: "Administração",
    items: [
      { to: "/configuracoes", label: "Configurações", icon: Settings },
      { to: "/assinatura", label: "Assinatura", icon: CreditCard },
      { to: "/perfil", label: "Meu perfil", icon: UserCircle },
    ],
  },
];

function getInitials(name?: string | null) {
  if (!name) return "PP";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (first + second).toUpperCase() || "PP";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const isAdmin = useIsAdmin();
  const { data: store } = useMyStoreShell();
  const signOut = useSignOut();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="hidden lg:flex w-72 flex-col border-r border-border bg-sidebar shrink-0">
        <SidebarInner storeName={store?.name} onSignOut={signOut} pathname={pathname} />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="relative w-72 bg-sidebar h-full flex flex-col">
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
            <Link
              to="/loja/$slug"
              params={{ slug: store.slug }}
              className="text-xs sm:text-sm text-muted-foreground hover:text-primary underline underline-offset-4"
            >
              Ver loja pública
            </Link>
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
  const initials = getInitials(storeName);
  return (
    <>
      <div className="h-16 flex items-center px-5 border-b border-border justify-between">
        <a
          href="/dashboard"
          className="flex items-center gap-2 font-bold text-lg tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <span className="text-primary">Pronto</span>
          <span className="text-sidebar-foreground">Pede</span>
        </a>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {NAV_GROUPS.map((group, idx) => (
          <div key={group.title} className={cn(idx > 0 && "mt-6")}>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.title}
            </div>
            <ul className="space-y-1">
              {group.items.map(({ to, label, icon: Icon }) => {
                const active = pathname === to || pathname.startsWith(to + "/");
                return (
                  <li key={to}>
                    <a
                      href={to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          active
                            ? "text-primary-foreground"
                            : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
                        )}
                      />
                      <span className="truncate">{label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-3 space-y-1">
        <button
          type="button"
          className="w-full flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Conta"
        >
          <span className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-sidebar-foreground truncate">
              {storeName ?? "Minha loja"}
            </span>
            <span className="block text-xs text-muted-foreground truncate">
              Trocar conta
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            "text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <LogOut className="h-[18px] w-[18px] text-destructive/80" />
          Sair
        </button>
      </div>
    </>
  );
}