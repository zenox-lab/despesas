import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Versão compacta em linha, ~60-80px de altura. Sem ícone grande. */
  compact?: boolean;
};

export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyStateProps) {
  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-4 text-muted-foreground",
        className,
      )}>
        {Icon && <Icon className="size-4 shrink-0 opacity-50" />}
        <p className="text-[13px] font-medium">{title}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center py-12 text-center", className)}>
      {Icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-xl bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      )}
      <p className="text-[13px] font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-[12px] text-muted-foreground leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
