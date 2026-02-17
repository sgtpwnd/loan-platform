import { Download, Eye, Search, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "../../components/StatusBadge";

const requiredDocs = [
  { name: "Current Pay Stub", status: "Complete" },
  { name: "W-2 Forms (Last 2 years)", status: "Complete" },
  { name: "Bank Statements", status: "Partial" },
  { name: "Photo ID", status: "Complete" },
  { name: "Tax Returns", status: "Complete" },
  { name: "Homeowners Insurance", status: "Missing" },
];

const uploadedDocs = [
  { name: "Paystub_Jan_2026.pdf", type: "PDF", category: "Income", loanId: "LA-2024-1501", date: "Jan 30, 2026", size: "1.2 MB", status: "Verified" },
  { name: "W2_2025.pdf", type: "PDF", category: "Income", loanId: "LA-2024-1501", date: "Jan 28, 2026", size: "940 KB", status: "Verified" },
  { name: "W2_2024.pdf", type: "PDF", category: "Income", loanId: "LA-2024-1501", date: "Jan 28, 2026", size: "915 KB", status: "Verified" },
  { name: "BankStatement_Dec.pdf", type: "PDF", category: "Assets", loanId: "LA-2024-1247", date: "Jan 25, 2026", size: "2.1 MB", status: "Pending" },
  { name: "PhotoID_Front.jpg", type: "JPG", category: "Identity", loanId: "LA-2024-1502", date: "Jan 16, 2026", size: "450 KB", status: "Verified" },
  { name: "TaxReturn_2025.pdf", type: "PDF", category: "Tax", loanId: "LA-2024-1502", date: "Jan 10, 2026", size: "1.8 MB", status: "Verified" },
];

export function MyDocuments() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">My Documents</h1>
          <p className="text-muted-foreground mt-1">Manage required and uploaded documents for all loans.</p>
        </div>
        <button
          className="rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary/90 transition"
          onClick={() => setIsModalOpen(true)}
        >
          Upload Document
        </button>
      </header>

      <section id="checklist" className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Required Documents Checklist</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {requiredDocs.map((doc) => (
            <div key={doc.name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm">{doc.name}</span>
              <StatusBadge variant={doc.status === "Complete" ? "success" : doc.status === "Partial" ? "warning" : "danger"}>
                {doc.status === "Complete" ? "✓" : doc.status === "Partial" ? "Partial" : "✗"}
              </StatusBadge>
            </div>
          ))}
        </div>
      </section>

      <section id="uploads" className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="w-full rounded-lg border border-border bg-white pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Search documents" />
          </div>
          <select className="rounded-lg border border-border bg-white px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none">
            <option>All Categories</option>
            <option>Income</option>
            <option>Identity</option>
            <option>Tax</option>
            <option>Assets</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Category</th>
                <th className="py-3 pr-4">Loan ID</th>
                <th className="py-3 pr-4">Upload Date</th>
                <th className="py-3 pr-4">Size</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-0">Actions</th>
              </tr>
            </thead>
            <tbody>
              {uploadedDocs.map((doc) => (
                <tr key={doc.name} className="border-b border-border hover:bg-muted/30">
                  <td className="py-3 pr-4 font-medium">{doc.name}</td>
                  <td className="py-3 pr-4">{doc.type}</td>
                  <td className="py-3 pr-4">{doc.category}</td>
                  <td className="py-3 pr-4">{doc.loanId}</td>
                  <td className="py-3 pr-4">{doc.date}</td>
                  <td className="py-3 pr-4">{doc.size}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge variant={doc.status === "Verified" ? "success" : "warning"}>{doc.status}</StatusBadge>
                  </td>
                  <td className="py-3 pr-0">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 rounded hover:bg-muted" title="View"><Eye size={15} /></button>
                      <button className="p-1.5 rounded hover:bg-muted" title="Download"><Download size={15} /></button>
                      <button className="p-1.5 rounded hover:bg-muted text-danger" title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Upload Document</h2>
            <div className="rounded-lg border-2 border-dashed border-border p-8 text-center bg-muted/30">
              <Upload className="mx-auto text-primary" size={24} />
              <p className="mt-2 text-sm">Drag and drop file here or click to browse</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <label>
                <span className="text-sm font-medium mb-2 block">Document Type</span>
                <select className="w-full rounded-lg border border-border bg-white px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none">
                  <option>Pay Stub</option>
                  <option>W-2</option>
                  <option>Bank Statement</option>
                  <option>Insurance</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-medium mb-2 block">Loan</span>
                <select className="w-full rounded-lg border border-border bg-white px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none">
                  <option>LA-2024-1501</option>
                  <option>LA-2024-1502</option>
                  <option>LA-2024-1247</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary/90">Upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
