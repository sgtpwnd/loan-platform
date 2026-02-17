import { differenceInDays, parseISO } from "date-fns";
import { Clock } from "lucide-react";

export function CountdownTimer({ expirationDate }: { expirationDate: string }) {
  const daysLeft = differenceInDays(parseISO(expirationDate), new Date());
  const expired = daysLeft <= 0;
  const isSoon = daysLeft <= 30;
  const color = expired ? "text-red-600" : isSoon ? "text-yellow-600" : "text-green-600";
  return (
    <div className={`flex items-center gap-1 text-sm ${color}`} role="status" aria-live="polite">
      <Clock size={16} />
      {expired ? "Expired" : `${daysLeft} days left`}
    </div>
  );
}
