import { format } from "date-fns";

export function formatDate(value: string | number | Date, mask = "MMM d, yyyy") {
  return format(typeof value === "string" ? new Date(value) : value, mask);
}

export function formatDateTime(value: string | number | Date, mask = "MMM d, h:mm a") {
  return format(typeof value === "string" ? new Date(value) : value, mask);
}

export function formatCurrency(amount: number | string) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}
