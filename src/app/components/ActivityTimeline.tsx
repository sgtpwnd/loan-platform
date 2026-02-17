import { formatDateTime } from "../lib/format";

type Item = { id: string; type: "success" | "warning" | "error" | "info"; message: string; createdAt: string };

const colors = {
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
  info: "bg-blue-500",
};

export default function ActivityTimeline({ items }: { items: Item[] }) {
  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        <div key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={`h-3 w-3 rounded-full ${colors[item.type]}`} />
            {idx < items.length - 1 ? <span className="flex-1 w-px bg-gray-200" /> : null}
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-900">{item.message}</p>
            <p className="text-gray-500">{formatDateTime(item.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
