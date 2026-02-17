type Item = { label: string; state: "pass" | "fail" | "pending" };

export default function ComplianceChecklist({ items }: { items: Item[] }) {
  return (
    <div className="divide-y divide-gray-200 border border-gray-200 rounded-xl">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-gray-800">{item.label}</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              item.state === "pass"
                ? "bg-green-100 text-green-700"
                : item.state === "fail"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {item.state === "pass" ? "Pass" : item.state === "fail" ? "Fail" : "Pending"}
          </span>
        </div>
      ))}
    </div>
  );
}
