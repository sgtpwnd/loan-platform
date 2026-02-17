import { Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

type Variant = "info" | "success" | "warning" | "error";

const styles: Record<Variant, { icon: React.ElementType; classes: string }> = {
  info: { icon: Info, classes: "bg-blue-50 border-blue-200 text-blue-800" },
  success: { icon: CheckCircle2, classes: "bg-green-50 border-green-200 text-green-800" },
  warning: { icon: AlertTriangle, classes: "bg-yellow-50 border-yellow-200 text-yellow-800" },
  error: { icon: XCircle, classes: "bg-red-50 border-red-200 text-red-800" },
};

export function AlertBanner({ variant = "info", children }: { variant?: Variant; children: React.ReactNode }) {
  const Icon = styles[variant].icon;
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border px-4 py-3 text-sm", styles[variant].classes)}>
      <Icon size={16} />
      <div>{children}</div>
    </div>
  );
}
