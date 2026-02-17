import { CheckCircle2, FileCheck2, ReceiptText } from "lucide-react";
import { KPICard } from "../../components/KPICard";
import { StatusBadge } from "../../components/StatusBadge";

const upcomingPayments = [
  { id: "LA-2024-1501", property: "123 Main St", amount: "$2,940", due: "Mar 1, 2026" },
  { id: "LA-2024-1502", property: "456 Oak Ave", amount: "$1,845", due: "Mar 1, 2026" },
];

const loanRows = [
  {
    id: "LA-2024-1501",
    property: "123 Main St",
    type: "Purchase",
    origination: "$450,000",
    balance: "$435,000",
    rate: "6.10%",
    status: "Current",
  },
  {
    id: "LA-2024-1502",
    property: "456 Oak Ave",
    type: "Refinance",
    origination: "$285,000",
    balance: "$272,555",
    rate: "5.85%",
    status: "Current",
  },
];

export function BorrowerDashboard() {
  return (
    <div className="space-y-6">
      <header id="overview">
        <h1 className="text-3xl font-bold text-primary">Welcome back, Michael</h1>
        <p className="text-muted-foreground mt-1">Track your loans, payments, and account updates.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Active Loans" value="2" change="No changes" changeType="neutral" />
        <KPICard title="Total Balance" value="$707,555" change="-$9,570 this month" changeType="positive" />
        <KPICard title="Next Payment" value="$4,785" change="Due in 19 days" changeType="neutral" />
        <KPICard title="Credit Score" value="742" change="+8 points" changeType="positive" />
      </section>

      <section id="payments" className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Upcoming Payments</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingPayments.map((payment) => (
              <div key={payment.id} className="rounded-lg border border-border p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">{payment.id}</p>
                <h3 className="font-semibold mt-1">{payment.property}</h3>
                <p className="text-2xl font-bold mt-3">{payment.amount}</p>
                <p className="text-sm text-muted-foreground">Due {payment.due}</p>
                <button className="mt-4 rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary/90 transition">Make Payment</button>
              </div>
            ))}
          </div>
        </div>

        <div id="activity" className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {[
              { icon: ReceiptText, text: "Payment Processed for LA-2024-1501", time: "Feb 1, 2026" },
              { icon: FileCheck2, text: "Document Uploaded: Insurance Policy", time: "Jan 28, 2026" },
              { icon: CheckCircle2, text: "Auto-pay confirmed for both loans", time: "Jan 22, 2026" },
              { icon: ReceiptText, text: "Payment Processed for LA-2024-1502", time: "Jan 1, 2026" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.text} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Icon size={15} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm">{item.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="loans" className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Active Loans</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-3 pr-4">Loan ID</th>
                <th className="py-3 pr-4">Property</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Original Amount</th>
                <th className="py-3 pr-4">Balance</th>
                <th className="py-3 pr-4">Rate</th>
                <th className="py-3 pr-0">Status</th>
              </tr>
            </thead>
            <tbody>
              {loanRows.map((row) => (
                <tr key={row.id} className="border-b border-border hover:bg-muted/30">
                  <td className="py-3 pr-4 font-medium">{row.id}</td>
                  <td className="py-3 pr-4">{row.property}</td>
                  <td className="py-3 pr-4">{row.type}</td>
                  <td className="py-3 pr-4">{row.origination}</td>
                  <td className="py-3 pr-4">{row.balance}</td>
                  <td className="py-3 pr-4">{row.rate}</td>
                  <td className="py-3 pr-0"><StatusBadge variant="success">{row.status}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
