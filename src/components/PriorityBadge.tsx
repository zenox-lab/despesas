import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/shopping";

const config: Record<Priority, { label: string; className: string }> = {
  alta: { label: "Alta", className: "bg-destructive/10 text-destructive" },
  media: { label: "Média", className: "bg-muted text-muted-foreground" },
  baixa: { label: "Baixa", className: "bg-muted text-muted-foreground/70" },
};

type PriorityBadgeProps = {
  priority: Priority;
  className?: string;
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const { label, className: cls } = config[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
        cls,
        className,
      )}
    >
      {label}
    </span>
  );
}
