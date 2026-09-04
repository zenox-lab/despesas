import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  Home,
  ShoppingCart,
  Heart,
  Repeat2,
  CircleDollarSign,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Hoje", icon: Home },
  { to: "/comprar", label: "Comprar", icon: ShoppingCart },
  { to: "/desejos", label: "Desejos", icon: Heart },
  { to: "/recorrentes", label: "Recorrentes", icon: Repeat2 },
  { to: "/financas", label: "Finanças", icon: CircleDollarSign },
] as const;

type AppLayoutProps = {
  children: React.ReactNode;
  onQuickAdd?: () => void;
};

export function AppLayout({ children, onQuickAdd }: AppLayoutProps) {
  const matchRoute = useMatchRoute();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — desktop only (≥768px) */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:shrink-0 md:fixed md:inset-y-0 md:left-0 md:z-30">
        <div className="flex flex-1 flex-col bg-navy border-r border-sidebar-border overflow-y-auto">
          {/* Logo / App name */}
          <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
            <div className="grid size-7 place-items-center rounded-lg bg-primary/20">
              <ShoppingCart className="size-3.5 text-primary" />
            </div>
            <span className="text-[13px] font-bold text-sidebar-foreground">
              Minhas Compras
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-3 space-y-0.5">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const isActive = matchRoute({ to, fuzzy: to === "/" ? false : true });
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Quick add button */}
          {onQuickAdd && (
            <div className="p-3 border-t border-sidebar-border">
              <button
                onClick={onQuickAdd}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-[12px] font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                <Plus className="size-3.5" />
                Adicionar item
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-56 w-full min-w-0 overflow-x-hidden pb-safe-nav">
        {/* Safe area top spacer — mobile only */}
        <div
          className="md:hidden"
          style={{ height: "env(safe-area-inset-top)" }}
        />
        <div className="w-full px-4 pt-3 pb-5 md:px-8 md:py-8 lg:px-12">
          {children}
        </div>
      </main>

      {/* Bottom nav — mobile only (<768px) */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-navy border-t border-sidebar-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch justify-around">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const isActive = matchRoute({ to, fuzzy: to === "/" ? false : true });
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-sidebar-foreground/50 active:text-sidebar-foreground/80",
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="text-[10px] font-bold leading-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
