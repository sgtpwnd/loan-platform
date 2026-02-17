import { cn } from "../lib/utils";

type Variant =
  | "valid"
  | "expiring"
  | "default"
  | "force-placed"
  | "inactive"
  | "success"
  | "warning"
  | "danger"
  | "info";

const classes: Record<Variant, string> = {
  valid: "bg-green-100 text-green-700 border-green-200",
  expiring: "bg-yellow-100 text-yellow-700 border-yellow-200",
  default: "bg-red-100 text-red-700 border-red-200",
  "force-placed": "bg-purple-100 text-purple-700 border-purple-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  success: "bg-green-100 text-green-700 border-green-200",
  warning: "bg-yellow-100 text-yellow-700 border-yellow-200",
  danger: "bg-red-100 text-red-700 border-red-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
};

function normalizeVariant(value: string): Variant {
  const normalized = value.toLowerCase();
  if (classes[normalized as Variant]) return normalized as Variant;
  return "default";
}

export function StatusBadge({
  variant,
  children,
  className,
}: {
  variant: Variant | string;
  children: React.ReactNode;
  className?: string;
}) {
  const key = normalizeVariant(variant as string);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
        classes[key],
        className
      )}
    >
      {children}
    </span>
  );
}
