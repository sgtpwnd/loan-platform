import { Search } from "lucide-react";
import { KPICard } from "../components/KPICard";
import { StatusBadge } from "../components/StatusBadge";

const loans = [
  { id: "LA-2024-1501", borrower: "Michael Chen", property: "123 Main St", balance: "$435,000", payment: "$2,940", due: "Mar 1, 2026", status: "Current" },
  { id: "LA-2024-1502", borrower: "Michael Chen", property: "456 Oak Ave", balance: "$272,555", payment: "$1,845", due: "Mar 1, 2026", status: "Current" },
  { id: "LA-2024-1520", borrower: "Rachel Adams", property: "999 West Dr", balance: "$311,220", payment: "$2,110", due: "Feb 15, 2026", status: "30 Days Late" },
  { id: "LA-2024-1523", borrower: "Tom Ford", property: "18 Aspen Way", balance: "$189,900", payment: "$1,405", due: "Feb 8, 2026", status: "15 Days Late" },
  { id: "LA-2024-1527", borrower: "Lila Gomez", property: "44 Cedar Loop", balance: "$520,440", payment: "$3,155", due: "Mar 5, 2026", status: "Current" },
  { id: "LA-2024-1532", borrower: "Victor Khan", property: "72 Creek Lane", balance: "$260,300", payment: "$1,740", due: "Feb 9, 2026", status: "30 Days Late" },
];

export function LoanServicing() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-primary">Loan Servicing</h1>
        <p className="text-muted-foreground mt-1">Portfolio monitoring, collections, and payment operations.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Active Loans" value="127" change="+5 this month" changeType="positive" />
        <KPICard title="Total Portfolio" value="$45.2M" change="+3.2% QoQ" changeType="positive" />
        <KPICard title="Monthly Collections" value="$2.8M" change="98.4% collected" changeType="positive" />
        <KPICard title="Delinquency Rate" value="1.2%" change="-0.3% vs last month" changeType="positive" />
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-4 mb-6">
          <select className="rounded-lg border border-border bg-white px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none">
            <option>All Statuses</option>
            <option>Current</option>
            <option>15 Days Late</option>
            <option>30 Days Late</option>
          </select>
          <div className="lg:col-span-2 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-lg border border-border bg-white pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="Search borrower, loan ID, or property"
            />
          </div>
          <input type="date" className="rounded-lg border border-border bg-white px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none" />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-3 pr-4">Loan ID</th>
                <th className="py-3 pr-4">Borrower</th>
                <th className="py-3 pr-4">Property</th>
                <th className="py-3 pr-4">Balance</th>
                <th className="py-3 pr-4">Monthly Payment</th>
                <th className="py-3 pr-4">Next Due</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-0">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id} className="border-b border-border hover:bg-muted/30">
                  <td className="py-3 pr-4 font-medium">{loan.id}</td>
                  <td className="py-3 pr-4">{loan.borrower}</td>
                  <td className="py-3 pr-4">{loan.property}</td>
                  <td className="py-3 pr-4">{loan.balance}</td>
                  <td className="py-3 pr-4">{loan.payment}</td>
                  <td className="py-3 pr-4">{loan.due}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge variant={loan.status === "Current" ? "success" : "warning"}>{loan.status}</StatusBadge>
                  </td>
                  <td className="py-3 pr-0"><button className="text-primary hover:underline">Manage</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
