import { cn } from "@/lib/utils";

type SummaryMetricProps = {
  label: string;
  value: string;
  sub?: string;
  accent?: "default" | "primary" | "success" | "destructive" | "muted";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const accentMap = {
  default: { value: "text-foreground", sub: "text-muted-foreground", wrap: "" },
  primary: { value: "text-primary", sub: "text-primary/70", wrap: "bg-primary/5 border-primary/20" },
  success: { value: "text-success", sub: "text-success/70", wrap: "bg-success/5 border-success/20" },
  destructive: { value: "text-destructive", sub: "text-destructive/70", wrap: "bg-destructive/5 border-destructive/20" },
  muted: { value: "text-muted-foreground", sub: "text-muted-foreground/70", wrap: "bg-muted" },
};

const sizeMap = {
  sm: { label: "text-[9px]", value: "text-base", sub: "text-[10px]" },
  md: { label: "text-[10px]", value: "text-lg", sub: "text-[11px]" },
  lg: { label: "text-[10px]", value: "text-2xl", sub: "text-xs" },
};

export function SummaryMetric({
  label,
  value,
  sub,
  accent = "default",
  size = "md",
  className,
}: SummaryMetricProps) {
  const ac = accentMap[accent];
  const sz = sizeMap[size];

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl px-3 py-2.5 border border-transparent",
        ac.wrap,
        className,
      )}
    >
      <p className={cn("font-bold uppercase tracking-wider", sz.label, "text-muted-foreground")}>{label}</p>
      <p className={cn("font-extrabold leading-tight", sz.value, ac.value)}>{value}</p>
      {sub && <p className={cn("leading-tight", sz.sub, ac.sub)}>{sub}</p>}
    </div>
  );
}
