import { BriefcaseBusiness, Mail, MessageSquare, Phone } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge";

const documents = [
  { name: "Photo ID", status: "Verified" },
  { name: "W-2 Forms", status: "Verified" },
  { name: "Tax Returns", status: "Verified" },
  { name: "Bank Statements", status: "Pending" },
  { name: "Insurance Policy", status: "Missing" },
  { name: "Purchase Agreement", status: "Verified" },
];

export function BorrowerProfile() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-primary">Borrower Profile</h1>
        <p className="text-muted-foreground mt-1">Michael Chen - Comprehensive borrower relationship snapshot.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm lg:col-span-1">
          <h2 className="text-lg font-semibold mb-4">Profile Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Mail size={14} className="text-muted-foreground" /> michael.chen@email.com</div>
            <div className="flex items-center gap-2"><Phone size={14} className="text-muted-foreground" /> (512) 555-0142</div>
            <div className="flex items-center gap-2"><BriefcaseBusiness size={14} className="text-muted-foreground" /> Tech Solutions Inc, Senior Engineer</div>
            <div className="pt-2 border-t border-border">
              <p className="text-muted-foreground">Credit Score</p>
              <p className="text-2xl font-bold">742</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Properties & Loan Details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold">123 Main Street</h3>
              <p className="text-sm text-muted-foreground mt-1">Purchase 2023</p>
              <p className="text-sm mt-3">Loan: <strong>$450,000</strong></p>
              <p className="text-sm">Balance: <strong>$435,000</strong></p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold">456 Oak Avenue</h3>
              <p className="text-sm text-muted-foreground mt-1">Refinance 2021</p>
              <p className="text-sm mt-3">Loan: <strong>$285,000</strong></p>
              <p className="text-sm">Balance: <strong>$272,555</strong></p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Documents</h2>
          <div className="space-y-3">
            {documents.map((document) => (
              <div key={document.name} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                <span className="text-sm">{document.name}</span>
                <StatusBadge
                  variant={
                    document.status === "Verified"
                      ? "success"
                      : document.status === "Pending"
                        ? "warning"
                        : "danger"
                  }
                >
                  {document.status}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Communication History</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><MessageSquare size={14} /> Loan Application Follow-up</div>
              <p className="text-sm text-muted-foreground mt-2">Sarah Johnson requested updated bank statements on Feb 5, 2026.</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><MessageSquare size={14} /> Payment Confirmation</div>
              <p className="text-sm text-muted-foreground mt-2">Borrower confirmed February autopay posted successfully.</p>
            </div>
            <button className="rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary/90 transition">Open Full Thread</button>
          </div>
        </div>
      </section>
    </div>
  );
}
