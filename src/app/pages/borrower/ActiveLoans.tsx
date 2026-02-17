import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { StatusBadge } from "../../components/StatusBadge";
import { fetchWorkflowApplications, type WorkflowApplication } from "../../services/workflowApi";

function isActiveLoan(application: WorkflowApplication) {
  const statusLabel = typeof application.status === "string" ? application.status.toLowerCase() : "";
  return (
    application.currentStageIndex >= 5 ||
    statusLabel.includes("active") ||
    (Array.isArray(application.history) && application.history.includes("FUNDING_COMPLETED"))
  );
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatDateTime(timestamp: number | null | undefined) {
  if (!Number.isFinite(Number(timestamp))) return "N/A";
  return new Date(Number(timestamp)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ActiveLoans() {
  const [applications, setApplications] = useState<WorkflowApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const loaded = await fetchWorkflowApplications();
        if (!mounted) return;
        setApplications(loaded);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load active loans.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const activeLoans = useMemo(
    () => applications.filter((application) => isActiveLoan(application)).sort((a, b) => b.lastEventAt - a.lastEventAt),
    [applications]
  );

  return (
    <div className="space-y-6">
      <header id="summary" className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">Active Loans</h1>
          <p className="text-muted-foreground mt-1">
            Closed and funded loans are tracked here and removed from My Applications.
          </p>
        </div>
        <Link to="/borrower/applications" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
          Back to My Applications
        </Link>
      </header>

      {error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading active loans...</p> : null}

      {!isLoading ? (
        <section id="funded" className="rounded-lg border border-border bg-card p-4 shadow-sm">
          {activeLoans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active loans yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-3 pr-4">Loan ID</th>
                    <th className="py-3 pr-4">Property</th>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Original Amount</th>
                    <th className="py-3 pr-4">Funded Date</th>
                    <th className="py-3 pr-0">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLoans.map((loan) => (
                    <tr key={loan.id} className="border-b border-border hover:bg-muted/30">
                      <td className="py-3 pr-4 font-medium">{loan.id}</td>
                      <td className="py-3 pr-4">{loan.property}</td>
                      <td className="py-3 pr-4">{loan.type}</td>
                      <td className="py-3 pr-4">{formatCurrency(loan.amount)}</td>
                      <td className="py-3 pr-4">{formatDateTime(loan.lastEventAt)}</td>
                      <td className="py-3 pr-0">
                        <StatusBadge variant="success">Active</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
