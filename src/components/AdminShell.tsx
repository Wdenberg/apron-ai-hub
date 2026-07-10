import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  UserX,
  Megaphone,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSignOut } from "@/hooks/useAuth";

const NAV = [
  { to: "/admin/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { to: "/admin/lojistas", label: "Lojistas", icon: Users },
  { to: "/admin/trial", label: "Trial & recuperação", icon: UserX },
  { to: "/admin/campanhas", label: "Campanhas WhatsApp", icon: Megaphone },
  { to: "/admin/equipe", label: "Equipe (admins)", icon: ShieldCheck },
] as const;

export function AdminShell({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const signOut = useSignOut();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-sidebar shrink-0">
        <Inner pathname={pathname} onSignOut={signOut} />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-sidebar h-full flex flex-col">
            <Inner pathname={pathname} onSignOut={signOut} onClose={() => setOpen(false)} />
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
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-semibold">Painel ProntoPede</span>
          {title && <><span className="text-muted-foreground">/</span><span className="text-sm text-muted-foreground">{title}</span></>}
          <div className="flex-1" />
          <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
            <Store className="h-3 w-3" /> Sair do modo admin
          </Link>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function Inner({
  pathname,
  onSignOut,
  onClose,
}: {
  pathname: string;
  onSignOut: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="h-14 flex items-center px-4 border-b border-border justify-between">
        <Link to="/admin/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span>Admin</span>
        </Link>
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
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <Button variant="ghost" className="w-full justify-start" onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </>
  );
}