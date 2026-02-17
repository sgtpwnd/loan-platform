import { useState } from "react";
import { KPICard } from "../../components/KPICard";
import { StatusBadge } from "../../components/StatusBadge";

type PaymentModalData = {
  loanId: string;
  amount: string;
};

const upcoming = [
  { id: "LA-2024-1501", property: "123 Main St", amount: "$2,940", due: "Mar 1, 2026" },
  { id: "LA-2024-1502", property: "456 Oak Ave", amount: "$1,845", due: "Mar 1, 2026" },
];

const history = [
  { date: "Feb 1, 2026", id: "LA-2024-1501", property: "123 Main St", total: "$2,940", principal: "$1,250", interest: "$1,625", escrow: "$65", status: "Paid" },
  { date: "Feb 1, 2026", id: "LA-2024-1502", property: "456 Oak Ave", total: "$1,845", principal: "$778", interest: "$1,022", escrow: "$45", status: "Paid" },
  { date: "Jan 1, 2026", id: "LA-2024-1501", property: "123 Main St", total: "$2,940", principal: "$1,240", interest: "$1,635", escrow: "$65", status: "Paid" },
  { date: "Jan 1, 2026", id: "LA-2024-1502", property: "456 Oak Ave", total: "$1,845", principal: "$770", interest: "$1,030", escrow: "$45", status: "Paid" },
  { date: "Dec 1, 2025", id: "LA-2024-1501", property: "123 Main St", total: "$2,940", principal: "$1,230", interest: "$1,645", escrow: "$65", status: "Paid" },
];

export function PaymentPortal() {
  const [modalData, setModalData] = useState<PaymentModalData | null>(null);

  return (
    <div className="space-y-6">
      <header id="overview">
        <h1 className="text-3xl font-bold text-primary">Payment Portal</h1>
        <p className="text-muted-foreground mt-1">Manage monthly obligations, payment history, and auto-pay settings.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Next Payment Due" value="$4,785" change="Due Mar 1, 2026" changeType="neutral" />
        <KPICard title="Year to Date Paid" value="$9,570" change="2 months in 2026" changeType="neutral" />
        <KPICard title="Principal Paid YTD" value="$4,056" change="+15.2% vs last year" changeType="positive" />
        <KPICard title="Auto-Pay Active" value="Yes" change="Both loans enrolled" changeType="positive" />
      </section>

      <section id="upcoming" className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Upcoming Payments</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {upcoming.map((item) => (
            <div key={item.id} className="rounded-lg border border-border p-4 bg-muted/30">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{item.id}</p>
                <StatusBadge variant="success">Auto-Pay</StatusBadge>
              </div>
              <h3 className="font-semibold mt-2">{item.property}</h3>
              <p className="text-2xl font-bold mt-3">{item.amount}</p>
              <p className="text-sm text-muted-foreground">Due {item.due}</p>
              <button
                className="mt-4 rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary/90"
                onClick={() => setModalData({ loanId: item.id, amount: item.amount.replace("$", "").replace(",", "") })}
              >
                Make Payment
              </button>
            </div>
          ))}
        </div>
      </section>

      <section id="history" className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Payment History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-3 pr-4">Date</th>
                <th className="py-3 pr-4">Loan ID</th>
                <th className="py-3 pr-4">Property</th>
                <th className="py-3 pr-4">Total</th>
                <th className="py-3 pr-4">Principal</th>
                <th className="py-3 pr-4">Interest</th>
                <th className="py-3 pr-4">Escrow</th>
                <th className="py-3 pr-0">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={`${row.date}-${row.id}`} className="border-b border-border hover:bg-muted/30">
                  <td className="py-3 pr-4">{row.date}</td>
                  <td className="py-3 pr-4 font-medium">{row.id}</td>
                  <td className="py-3 pr-4">{row.property}</td>
                  <td className="py-3 pr-4">{row.total}</td>
                  <td className="py-3 pr-4">{row.principal}</td>
                  <td className="py-3 pr-4">{row.interest}</td>
                  <td className="py-3 pr-4">{row.escrow}</td>
                  <td className="py-3 pr-0"><StatusBadge variant="success">{row.status}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modalData && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Make Payment</h2>
            <p className="text-sm text-muted-foreground mt-1">Submit a one-time payment for your selected loan.</p>

            <div className="grid gap-4 md:grid-cols-2 mt-5">
              <label>
                <span className="text-sm font-medium mb-2 block">Loan ID</span>
                <input value={modalData.loanId} readOnly className="w-full rounded-lg border border-border bg-muted px-3 py-2.5" />
              </label>
              <label>
                <span className="text-sm font-medium mb-2 block">Amount</span>
                <input defaultValue={modalData.amount} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none" />
              </label>
              <label>
                <span className="text-sm font-medium mb-2 block">Payment Date</span>
                <input type="date" className="w-full rounded-lg border border-border bg-white px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none" />
              </label>
              <label>
                <span className="text-sm font-medium mb-2 block">Payment Method</span>
                <select className="w-full rounded-lg border border-border bg-white px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none">
                  <option>Chase Checking ••••1234</option>
                  <option>Wells Fargo Savings ••••5678</option>
                </select>
              </label>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4 mt-4 text-sm">
              <h3 className="font-semibold mb-2">Payment Summary</h3>
              <div className="space-y-1">
                <p className="flex justify-between"><span>Principal</span><span>$1,250</span></p>
                <p className="flex justify-between"><span>Interest</span><span>$1,625</span></p>
                <p className="flex justify-between"><span>Escrow</span><span>$65</span></p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted" onClick={() => setModalData(null)}>
                Cancel
              </button>
              <button className="rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary/90">Confirm Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
