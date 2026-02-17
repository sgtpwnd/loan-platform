interface KPICardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
}

export function KPICard({ title, value, change, changeType }: KPICardProps) {
  const changeColor = {
    positive: "text-[#10b981]",
    negative: "text-[#ef4444]",
    neutral: "text-muted-foreground",
  }[changeType];

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
      <h3 className="text-sm text-muted-foreground mb-2">{title}</h3>
      <div className="text-3xl font-bold mb-2">{value}</div>
      <div className={`text-sm ${changeColor}`}>{change}</div>
    </div>
  );
}
