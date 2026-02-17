import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertCircle, Bell, CheckCircle2, Loader2, ShieldAlert, ShieldCheck, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency } from "../lib/format";
import { fetchLenderPipeline } from "../services/workflowApi";
import { getLoans } from "../lib/api";

type PipelineRow = {
  loanId: string;
  borrower: string;
  property: string;
  amount: number;
  statusLabel: string;
  stage: string;
  ltvLabel?: string;
};

export default function Dashboard() {
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [insuranceLoans, setInsuranceLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [pl, insurance] = await Promise.all([
          fetchLenderPipeline().catch(() => []),
          getLoans().catch(() => ({ loans: [] })),
        ]);
        if (!mounted) return;
        setPipeline(pl || []);
        setInsuranceLoans((insurance as any).loans || []);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const total = pipeline.length;
    const underwriting = pipeline.filter((p) => /under/i.test(p.statusLabel)).length;
    const closing = pipeline.filter((p) => /clear to close|closing/i.test(p.statusLabel) || /Close/i.test(p.stage)).length;
    const funded = pipeline.filter((p) => /fund/i.test(p.statusLabel)).length;
    const exceptions = insuranceLoans.filter((l) =>
      ["expiring", "default", "force-placed"].includes(l.insurance?.status)
    ).length;
    const tasks =
      pipeline.filter((p: any) => (p.valuationInput?.missingFields?.length || 0) > 0).length +
      exceptions;
    return { total, underwriting, closing, funded, exceptions, tasks };
  }, [pipeline, insuranceLoans]);

  const topPipeline = pipeline.slice(0, 5);

  const insuranceIssues = insuranceLoans
    .filter((l) => ["expiring", "default", "force-placed"].includes(l.insurance?.status))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-sky-900 text-white p-6 shadow">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.08em] text-sky-200">Lender Command</p>
          <h1 className="text-2xl font-semibold">Portfolio overview & risk signals</h1>
          <p className="text-sm text-slate-100/80">
            High-level health across origination, underwriting, closing, servicing, and insurance exceptions.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Pipeline" value={metrics.total} icon={<TrendingUp className="text-sky-600" size={18} />} />
        <MetricCard
          label="In Underwriting"
          value={metrics.underwriting}
          icon={<ShieldCheck className="text-amber-600" size={18} />}
        />
        <MetricCard
          label="Clearing to Close"
          value={metrics.closing}
          icon={<CheckCircle2 className="text-emerald-600" size={18} />}
        />
        <MetricCard label="Funded" value={metrics.funded} icon={<CheckCircle2 className="text-teal-600" size={18} />} />
        <MetricCard
          label="Insurance Exceptions"
          value={metrics.exceptions}
          icon={<ShieldAlert className="text-red-600" size={18} />}
        />
        <MetricCard label="Tasks Due" value={metrics.tasks} icon={<Bell className="text-indigo-600" size={18} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active Pipeline</CardTitle>
            <Link to="/underwriting" className="text-sm text-blue-600">
              View all
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600 py-6">
                <Loader2 className="animate-spin" size={16} />
                Loading pipeline...
              </div>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Loan ID</Th>
                    <Th>Borrower</Th>
                    <Th>Property</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>LTV</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {topPipeline.map((row) => (
                    <Tr key={row.loanId}>
                      <Td className="font-medium">{row.loanId}</Td>
                      <Td>{row.borrower}</Td>
                      <Td>{row.property}</Td>
                      <Td>{formatCurrency(row.amount)}</Td>
                      <Td>
                        <StatusBadge variant={mapStatusVariant(row.statusLabel)}>{row.statusLabel}</StatusBadge>
                      </Td>
                      <Td>{row.ltvLabel}</Td>
                    </Tr>
                  ))}
                  {!topPipeline.length ? (
                    <Tr>
                      <Td colSpan={6} className="text-center text-gray-500">
                        No active loans in pipeline.
                      </Td>
                    </Tr>
                  ) : null}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insurance Exceptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insuranceIssues.map((l) => (
              <div key={l.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{l.property?.address || "Property"}</p>
                    <p className="text-xs text-gray-500">{l.borrower?.name}</p>
                  </div>
                  <StatusBadge variant={mapInsuranceVariant(l.insurance?.status)}>{l.insurance?.status}</StatusBadge>
                </div>
                <p className="text-xs text-gray-600 mt-2">Expires {l.insurance?.expirationDate?.slice(0, 10) || "-"}</p>
              </div>
            ))}
            {!insuranceIssues.length ? (
              <p className="text-sm text-gray-500">No exceptions right now.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.map((n) => (
            <div key={n.title} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
              <BadgeDot variant={n.variant} />
              <div>
                <p className="font-medium text-gray-900">{n.title}</p>
                <p className="text-sm text-gray-600">{n.body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const notifications: Array<{ title: string; body: string; variant: "info" | "warning" | "danger" }> = [
  { title: "Tasks pending", body: "Review underwriting inputs and clear remaining conditions.", variant: "info" },
  { title: "Insurance", body: "3 policies need renewal or force-placement review.", variant: "warning" },
  { title: "Pipeline health", body: "Loans older than 30 days in underwriting require escalation.", variant: "danger" },
];

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">{icon}</div>
      </CardContent>
    </Card>
  );
}

function mapStatusVariant(status: string) {
  const s = status.toLowerCase();
  if (s.includes("fund")) return "success";
  if (s.includes("under")) return "warning";
  if (s.includes("review")) return "info";
  if (s.includes("clear")) return "success";
  if (s.includes("default")) return "default";
  return "inactive";
}

function mapInsuranceVariant(status: string) {
  if (status === "expiring") return "expiring";
  if (status === "default") return "default";
  if (status === "force-placed") return "force-placed";
  if (status === "valid") return "valid";
  return "inactive";
}

function BadgeDot({ variant }: { variant: "info" | "warning" | "danger" }) {
  const color =
    variant === "info" ? "bg-blue-500" : variant === "warning" ? "bg-amber-500" : "bg-red-500";
  return <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}
