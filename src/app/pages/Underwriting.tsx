import { Brain, CheckCircle2, Clipboard, Loader2, Printer, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { KPICard } from "../components/KPICard";
import { StatusBadge } from "../components/StatusBadge";
import { UNDERWRITING_RULES, type UnderwritingCaseStatus } from "../lib/underwriting/summary";
import {
  fetchUnderwritingSummaries,
  fetchUnderwritingSummary,
  type UnderwritingCaseSummary,
} from "../services/workflowApi";

function formatCurrency(amount: number | null | undefined) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDateTime(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusVariant(status: UnderwritingCaseStatus) {
  if (status === "Approved") return "success" as const;
  if (status === "Declined") return "danger" as const;
  if (status === "In Review") return "info" as const;
  return "warning" as const;
}

function getQuickDecisionVariant(value: UnderwritingCaseSummary["quickDecision"]["recommendation"]) {
  if (value === "Approve") return "success" as const;
  if (value === "Decline") return "danger" as const;
  return "warning" as const;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function buildClipboardSummary(summary: UnderwritingCaseSummary, status: UnderwritingCaseStatus) {
  const liquidityCoverageStatus =
    summary.qualification.liquidityCoverage.isEnough === null
      ? "Not enough data"
      : summary.qualification.liquidityCoverage.isEnough
        ? "Enough"
        : "Not enough";
  const lines = [
    `Loan ${summary.loanId} - ${summary.executive.propertyAddress}`,
    `Borrower: ${summary.executive.borrowerName} (${summary.executive.borrowerEntity})`,
    `Requested Amount: ${formatCurrency(summary.executive.requestedLoanAmount)}`,
    `Purpose/Product: ${summary.executive.purpose} / ${summary.executive.product}`,
    `Status: ${status}`,
    `Recommendation: ${summary.quickDecision.recommendation}`,
    `Top Reasons: ${summary.quickDecision.reasons.join("; ") || "N/A"}`,
    `Risk Count: ${summary.riskCounts.issues} Issues, ${summary.riskCounts.pending} Pending, ${summary.riskCounts.highRisk} High Risk`,
    `LTV: ${formatPercent(summary.qualification.ltv)}, LTC: ${formatPercent(summary.qualification.ltc)}`,
    `Credit Score: ${summary.qualification.creditScore ?? "—"} (${summary.qualification.creditSource})`,
    `Liquidity: ${formatCurrency(summary.qualification.liquidityAmount)} (${summary.qualification.liquiditySource})`,
    `Liquidity Coverage: ${liquidityCoverageStatus}`,
    `Liquidity Formula: ${summary.qualification.liquidityCoverage.formula}`,
  ];
  return lines.join("\n");
}

export function Underwriting() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLoanId = searchParams.get("loanId")?.trim() || "";
  const isSingleLoanView = false;
  const [summaries, setSummaries] = useState<UnderwritingCaseSummary[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [selectedSummary, setSelectedSummary] = useState<UnderwritingCaseSummary | null>(null);
  const [localStatusOverrides, setLocalStatusOverrides] = useState<Record<string, UnderwritingCaseStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const pendingCases = useMemo(
    () =>
      summaries.filter((caseItem) =>
        caseItem.workflowStatus === "UW for Review" ||
        caseItem.workflowStatus === "In-underwriting" ||
        caseItem.workflowStatus === "Under Review"
      ),
    [summaries]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const loaded = await fetchUnderwritingSummaries();
        if (!mounted) return;
        setSummaries(loaded);
        setError(null);
        const pendingFromLoaded = loaded.filter((caseItem) =>
          caseItem.workflowStatus === "UW for Review" ||
          caseItem.workflowStatus === "In-underwriting" ||
          caseItem.workflowStatus === "Under Review"
        );

        if (loaded.length === 0) {
          if (requestedLoanId) {
            setSelectedLoanId(requestedLoanId);
            setSelectedSummary(null);
          } else {
            setSelectedLoanId("");
            setSelectedSummary(null);
          }
          return;
        }

        if (requestedLoanId) {
          const match = loaded.find((item) => item.loanId === requestedLoanId);
          const alreadyTrackingRequested = selectedLoanId === requestedLoanId;
          setSelectedLoanId(requestedLoanId);
          if (match) {
            setSelectedSummary(match);
          } else if (!alreadyTrackingRequested) {
            setSelectedSummary(null);
          }
          return;
        }

        const defaultPool = pendingFromLoaded.length > 0 ? pendingFromLoaded : loaded;
        if (!selectedLoanId || !loaded.some((item) => item.loanId === selectedLoanId)) {
          setSelectedLoanId(defaultPool[0].loanId);
          setSelectedSummary(defaultPool[0]);
          return;
        }

        const localSelected = loaded.find((item) => item.loanId === selectedLoanId) || null;
        setSelectedSummary(localSelected);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load underwriting summaries.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 10000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [requestedLoanId, selectedLoanId]);

  useEffect(() => {
    let mounted = true;
    if (!selectedLoanId) return;

    const loadDetail = async () => {
      setIsDetailLoading(true);
      try {
        const detail = await fetchUnderwritingSummary(selectedLoanId);
        if (!mounted) return;
        setSelectedSummary(detail);
        setError(null);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load selected underwriting case.");
      } finally {
        if (mounted) setIsDetailLoading(false);
      }
    };

    void loadDetail();
    return () => {
      mounted = false;
    };
  }, [selectedLoanId]);

  const urgentCount = useMemo(
    () =>
      pendingCases.filter((caseItem) => {
        const value = caseItem.qualification.exitTimeline;
        if (!value || value === "Not provided") return false;
        const parsed = Date.parse(value);
        if (!Number.isFinite(parsed)) return false;
        const days = Math.ceil((parsed - Date.now()) / (24 * 60 * 60 * 1000));
        return days >= 0 && days <= UNDERWRITING_RULES.shortClosingTimelineDays;
      }).length,
    [pendingCases]
  );

  const avgConfidence = useMemo(() => {
    if (pendingCases.length === 0) return null;
    const total = pendingCases.reduce((sum, item) => sum + item.evaluatorAssessment.confidence, 0);
    return Math.round(total / pendingCases.length);
  }, [pendingCases]);

  const approvalSignal = useMemo(() => {
    if (pendingCases.length === 0) return null;
    const approveLike = pendingCases.filter((item) => item.quickDecision.recommendation === "Approve").length;
    return Math.round((approveLike / pendingCases.length) * 100);
  }, [pendingCases]);

  const effectiveStatus = selectedSummary
    ? localStatusOverrides[selectedSummary.loanId] || selectedSummary.executive.status
    : "Draft";

  const handleCopySummary = async () => {
    if (!selectedSummary) return;
    try {
      await navigator.clipboard.writeText(buildClipboardSummary(selectedSummary, effectiveStatus));
      setCopyMessage("Summary copied.");
    } catch {
      setCopyMessage("Copy failed. Please try again.");
    }
  };

  const handleToggleApproved = () => {
    if (!selectedSummary) return;
    setLocalStatusOverrides((previous) => {
      const current = previous[selectedSummary.loanId];
      if (current === "Approved") {
        const next = { ...previous };
        delete next[selectedSummary.loanId];
        return next;
      }
      return { ...previous, [selectedSummary.loanId]: "Approved" };
    });
  };

  const continuationLatest = readObject(selectedSummary?.borrowerPortal.continuation.latest);
  const continuationBorrowerProfile = readObject(continuationLatest?.borrowerProfile);
  const continuationReferral = readObject(continuationLatest?.referral);
  const continuationActiveLoans = Array.isArray(continuationLatest?.activeLoans)
    ? continuationLatest.activeLoans.map((loan) => readObject(loan)).filter(Boolean)
    : [];
  const continuationPastProjects = Array.isArray(continuationLatest?.pastProjects)
    ? continuationLatest.pastProjects.map((project) => readObject(project)).filter(Boolean)
    : [];
  const continuationLlcDocs = Array.isArray(continuationLatest?.llcDocs)
    ? continuationLatest.llcDocs.map((doc) => readObject(doc)).filter(Boolean)
    : [];
  const continuationOtherLenders = readStringArray(continuationLatest?.otherMortgageLenders);
  const conditionsLatest = readObject(selectedSummary?.borrowerPortal.conditions?.latest);
  const conditionsReferral = readObject(conditionsLatest?.referral);
  const conditionsProofOfLiquidityDocs = Array.isArray(conditionsLatest?.proofOfLiquidityDocs)
    ? conditionsLatest.proofOfLiquidityDocs.map((doc) => readObject(doc)).filter(Boolean)
    : [];
  const conditionsLlcDocs = Array.isArray(conditionsLatest?.llcDocs)
    ? conditionsLatest.llcDocs.map((doc) => readObject(doc)).filter(Boolean)
    : [];
  const conditionsPastProjects = Array.isArray(conditionsLatest?.pastProjects)
    ? conditionsLatest.pastProjects.map((project) => readObject(project)).filter(Boolean)
    : [];
  const handleShowAllCases = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("loanId");
    setSearchParams(nextParams);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-primary">Underwriting</h1>
        <p className="text-muted-foreground mt-1">Credit, risk, and decisioning workspace.</p>
        {isSingleLoanView ? (
          <button
            type="button"
            className="mt-3 rounded border border-border px-3 py-1.5 text-sm text-primary hover:bg-muted"
            onClick={handleShowAllCases}
          >
            View full underwriting queue
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
      ) : null}
      {copyMessage ? (
        <div className="rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">{copyMessage}</div>
      ) : null}

      {!isSingleLoanView ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KPICard
            title="Pending Review"
            value={String(pendingCases.length)}
            change={`${urgentCount} urgent`}
            changeType={urgentCount > 0 ? "negative" : "neutral"}
          />
          <KPICard
            title="Avg Evaluator Confidence"
            value={avgConfidence === null ? "N/A" : `${avgConfidence}%`}
            change={pendingCases.length ? "Rule-based + evaluator blend" : "No active cases"}
            changeType="neutral"
          />
          <KPICard
            title="Approval Signal"
            value={approvalSignal === null ? "N/A" : `${approvalSignal}%`}
            change={pendingCases.length ? "Cases with approve recommendation" : "No active cases"}
            changeType="positive"
          />
        </section>
      ) : null}

      <section className={`grid gap-6 ${isSingleLoanView ? "" : "xl:grid-cols-[1.2fr_2fr]"}`}>
        {!isSingleLoanView ? (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Pending Cases</h2>
            {isLoading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Loading underwriting cases...
              </p>
            ) : null}
            {!isLoading && pendingCases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No underwriting cases are pending review.</p>
            ) : null}
            {!isLoading && pendingCases.length > 0 ? (
              <div className="space-y-2">
                {pendingCases.map((item) => (
                  <button
                    key={item.loanId}
                    type="button"
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedSummary?.loanId === item.loanId
                        ? "border-primary bg-primary/5"
                        : "border-border bg-white hover:bg-muted/30"
                    }`}
                    onClick={() => setSelectedLoanId(item.loanId)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{item.loanId}</p>
                      <StatusBadge variant="info">{item.workflowStatus}</StatusBadge>
                    </div>
                    <p className="text-sm mt-1">{item.executive.propertyAddress}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.executive.borrowerName} • {formatCurrency(item.executive.requestedLoanAmount)}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-6">
          {selectedSummary ? (
            <>
              <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-primary">{selectedSummary.executive.propertyAddress}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedSummary.executive.borrowerName} • {selectedSummary.executive.borrowerEntity}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(selectedSummary.executive.requestedLoanAmount)} • {selectedSummary.executive.purpose} •{" "}
                      {selectedSummary.executive.product}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={getStatusVariant(effectiveStatus)}>{effectiveStatus}</StatusBadge>
                    {isDetailLoading ? <Loader2 size={14} className="animate-spin text-muted-foreground" /> : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted inline-flex items-center gap-2"
                    onClick={() => void handleCopySummary()}
                  >
                    <Clipboard size={14} />
                    Copy Summary
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted inline-flex items-center gap-2"
                    onClick={() => window.print()}
                  >
                    <Printer size={14} />
                    Print
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-success text-white px-3 py-2 text-sm hover:opacity-90 inline-flex items-center gap-2"
                    onClick={handleToggleApproved}
                  >
                    <CheckCircle2 size={14} />
                    {effectiveStatus === "Approved" ? "Unmark Approved" : "Mark as Approved"}
                  </button>
                </div>
              </section>

              <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-3">Qualification Snapshot</h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      label: "Credit Score",
                      value: selectedSummary.qualification.creditScore ?? "—",
                      sub: selectedSummary.qualification.creditSource,
                    },
                    {
                      label: "Experience",
                      value:
                        selectedSummary.qualification.flipsCompleted === null
                          ? "—"
                          : `${selectedSummary.qualification.flipsCompleted} projects`,
                      sub:
                        selectedSummary.qualification.yearsInvesting === null
                          ? "Years investing: —"
                          : `Years investing: ${selectedSummary.qualification.yearsInvesting}`,
                    },
                    {
                      label: "Liquidity",
                      value: formatCurrency(selectedSummary.qualification.liquidityAmount),
                      sub: selectedSummary.qualification.liquiditySource,
                    },
                    {
                      label: "Liquidity Coverage",
                      value:
                        selectedSummary.qualification.liquidityCoverage.isEnough === null
                          ? "—"
                          : selectedSummary.qualification.liquidityCoverage.isEnough
                            ? "Enough"
                            : "Not Enough",
                      sub: `Available ${formatCurrency(selectedSummary.qualification.liquidityCoverage.availableLiquidity)} • Required ${formatCurrency(selectedSummary.qualification.liquidityCoverage.requiredLiquidity)}`,
                    },
                    {
                      label: "DTI / DSCR",
                      value: `${formatPercent(selectedSummary.qualification.dti)} / ${formatPercent(selectedSummary.qualification.dscr)}`,
                      sub: "Shows — when not provided",
                    },
                    {
                      label: "LTV / LTC",
                      value: `${formatPercent(selectedSummary.qualification.ltv)} / ${formatPercent(selectedSummary.qualification.ltc)}`,
                      sub: "Computed from loan, ARV, purchase + rehab",
                    },
                    {
                      label: "Project Cost",
                      value: formatCurrency(selectedSummary.qualification.totalProjectCost),
                      sub: `Cash-to-close: ${formatCurrency(selectedSummary.qualification.borrowerCashToClose)}`,
                    },
                    {
                      label: "Exit Strategy",
                      value: selectedSummary.qualification.exitStrategy || "—",
                      sub: `Timeline: ${formatDate(selectedSummary.qualification.exitTimeline)}`,
                    },
                    {
                      label: "Existing Loans",
                      value: selectedSummary.qualification.openLoanCount ?? "—",
                      sub: selectedSummary.qualification.occupancyStrategy || "—",
                    },
                  ].map((card) => (
                    <div key={card.label} className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                      <p className="text-lg font-semibold mt-1">{card.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Liquidity Formula</p>
                  <p className="mt-1">{selectedSummary.qualification.liquidityCoverage.formula}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedSummary.qualification.liquidityCoverage.assumptionNote}
                  </p>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-lg font-semibold">Risk Flags</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedSummary.riskCounts.issues} Issues • {selectedSummary.riskCounts.pending} Pending •{" "}
                      {selectedSummary.riskCounts.highRisk} High Risk
                    </p>
                  </div>
                  {selectedSummary.riskFlags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No flags detected.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedSummary.riskFlags.map((flag) => (
                        <StatusBadge
                          key={flag.id}
                          variant={flag.severity === "high" ? "danger" : flag.state === "pending" ? "warning" : "info"}
                          className="max-w-full"
                        >
                          {flag.label}
                        </StatusBadge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-3">Quick Decision</h3>
                  <div className="mb-3">
                    <StatusBadge variant={getQuickDecisionVariant(selectedSummary.quickDecision.recommendation)}>
                      Recommendation: {selectedSummary.quickDecision.recommendation}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Top 3 reasons</p>
                  <ul className="text-sm space-y-1">
                    {selectedSummary.quickDecision.reasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mt-4 mb-1">Conditions to clear</p>
                  {selectedSummary.quickDecision.conditions.length > 0 ? (
                    <ul className="text-sm space-y-1">
                      {selectedSummary.quickDecision.conditions.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No additional conditions.</p>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-3">Record Search Status</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="py-2 pr-3">Check</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3">Note</th>
                          <th className="py-2 pr-0">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSummary.recordSearchStatus.map((item) => (
                          <tr key={item.id} className="border-b border-border">
                            <td className="py-2 pr-3 font-medium">{item.label}</td>
                            <td className="py-2 pr-3">
                              <StatusBadge
                                variant={
                                  item.status === "complete"
                                    ? "success"
                                    : item.status === "in_review"
                                      ? "info"
                                      : "warning"
                                }
                              >
                                {item.status}
                              </StatusBadge>
                            </td>
                            <td className="py-2 pr-3">{item.note}</td>
                            <td className="py-2 pr-0 text-muted-foreground">{formatDateTime(item.updatedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain size={18} className="text-accent" />
                    <h3 className="text-lg font-semibold">{selectedSummary.evaluatorAssessment.title}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-success" />
                      <span>
                        Evaluator recommendation: <strong>{selectedSummary.evaluatorAssessment.recommendation}</strong>
                      </span>
                    </div>
                    <div>Confidence: <strong>{selectedSummary.evaluatorAssessment.confidence}%</strong></div>
                    <div className="flex items-start gap-2">
                      <TriangleAlert size={16} className="text-warning mt-0.5" />
                      <span>{selectedSummary.evaluatorAssessment.reasons.join("; ") || "No evaluator reasons provided."}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Metrics: LTV {formatPercent(selectedSummary.evaluatorAssessment.metrics.ltv)} • LTC{" "}
                      {formatPercent(selectedSummary.evaluatorAssessment.metrics.ltc)} • Docs Score{" "}
                      {selectedSummary.evaluatorAssessment.metrics.docsScore}
                    </p>
                  </div>
                </div>

                <details className="rounded-lg border border-border bg-card p-6 shadow-sm" open>
                  <summary className="cursor-pointer text-lg font-semibold">Borrower Portal Details</summary>
                  <div className="mt-4 space-y-4 text-sm">
                    <details open className="rounded border border-border p-4">
                      <summary className="cursor-pointer font-semibold">New Loan Request</summary>
                      <div className="mt-3 grid gap-4 lg:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Borrower</p>
                          <p>{selectedSummary.borrowerPortal.newLoanRequest.borrower.fullName}</p>
                          <p>{selectedSummary.borrowerPortal.newLoanRequest.borrower.email}</p>
                          <p>{selectedSummary.borrowerPortal.newLoanRequest.borrower.entityName}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Property</p>
                          <p>{selectedSummary.borrowerPortal.newLoanRequest.property.address}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Loan Request</p>
                          <p>Type: {selectedSummary.borrowerPortal.newLoanRequest.loanRequest.type}</p>
                          <p>Amount: {formatCurrency(selectedSummary.borrowerPortal.newLoanRequest.loanRequest.amount)}</p>
                          <p>Purchase: {selectedSummary.borrowerPortal.newLoanRequest.loanRequest.purchasePrice || "—"}</p>
                          <p>Rehab: {selectedSummary.borrowerPortal.newLoanRequest.loanRequest.rehabBudget || "—"}</p>
                          <p>ARV: {selectedSummary.borrowerPortal.newLoanRequest.loanRequest.arv || "—"}</p>
                          <p>Exit: {selectedSummary.borrowerPortal.newLoanRequest.loanRequest.exitStrategy || "—"}</p>
                          <p>
                            Target Closing:{" "}
                            {formatDate(selectedSummary.borrowerPortal.newLoanRequest.loanRequest.targetClosingDate)}
                          </p>
                        </div>
                      </div>
                    </details>

                    <details open className="rounded border border-border p-4">
                      <summary className="cursor-pointer font-semibold">Continuation Form</summary>
                      {!selectedSummary.borrowerPortal.continuation.submitted || !continuationLatest ? (
                        <p className="mt-3 text-muted-foreground">Not submitted yet.</p>
                      ) : (
                        <div className="mt-3 space-y-4">
                          <p className="text-xs text-muted-foreground">
                            Latest submission: {formatDateTime(selectedSummary.borrowerPortal.continuation.latestSubmittedAt)}
                          </p>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Experience</p>
                              <p>Projects on file: {continuationPastProjects.length || selectedSummary.qualification.flipsCompleted || 0}</p>
                              <p>Other mortgage lenders: {continuationOtherLenders.join(", ") || "—"}</p>
                              <p>Other mortgage loan count: {readNumber(continuationLatest.otherMortgageLoansCount) ?? selectedSummary.qualification.rentalsOwned ?? "—"}</p>
                              <p>
                                Other lenders monthly interest total:{" "}
                                {formatCurrency(
                                  Number.isFinite(Number(continuationLatest.otherMortgageTotalMonthlyInterest))
                                    ? Number(continuationLatest.otherMortgageTotalMonthlyInterest)
                                    : null
                                )}
                              </p>
                              <p>Active loans shared: {continuationActiveLoans.length}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Rehab Plan</p>
                              <p>Bed/Bath: {readString(continuationLatest.bed) || "—"} / {readString(continuationLatest.bath) || "—"}</p>
                              <p>Closing company: {readString(continuationLatest.closingCompany) || "—"}</p>
                              <p>Closing agent: {readString(continuationLatest.closingAgentName) || "—"}</p>
                              <p>Closing agent email: {readString(continuationLatest.closingAgentEmail) || "—"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Income / Credit</p>
                              <p>Credit score: {selectedSummary.qualification.creditScore ?? "—"}</p>
                              <p>Liquidity amount: {formatCurrency(selectedSummary.qualification.liquidityAmount)}</p>
                              <p>DTI: {formatPercent(selectedSummary.qualification.dti)}</p>
                              <p>DSCR: {formatPercent(selectedSummary.qualification.dscr)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Docs + Referral</p>
                              <p>LLC docs submitted: {continuationLlcDocs.length}</p>
                              <p>Referral name: {readString(continuationReferral?.name) || "—"}</p>
                              <p>Referral email: {readString(continuationReferral?.email) || "—"}</p>
                              <p>Referral phone: {readString(continuationReferral?.phone) || "—"}</p>
                            </div>
                          </div>
                          {continuationBorrowerProfile ? (
                            <div className="rounded border border-border p-3">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Borrower Profile Snapshot</p>
                              <p>
                                {readString(continuationBorrowerProfile.firstName)}{" "}
                                {readString(continuationBorrowerProfile.middleName)}{" "}
                                {readString(continuationBorrowerProfile.lastName)}
                              </p>
                              <p>{readString(continuationBorrowerProfile.email)}</p>
                              <p>Entity: {readString(continuationBorrowerProfile.llcName) || "—"}</p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </details>

                    <details open className="rounded border border-border p-4">
                      <summary className="cursor-pointer font-semibold">Conditions Form</summary>
                      {!selectedSummary.borrowerPortal.conditions?.submitted || !conditionsLatest ? (
                        <p className="mt-3 text-muted-foreground">Not submitted yet.</p>
                      ) : (
                        <div className="mt-3 space-y-4">
                          <p className="text-xs text-muted-foreground">
                            Latest submission: {formatDateTime(selectedSummary.borrowerPortal.conditions.latestSubmittedAt)}
                          </p>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Credit + Liquidity</p>
                              <p>
                                Credit score:{" "}
                                {Number.isFinite(Number(conditionsLatest.creditScore))
                                  ? Number(conditionsLatest.creditScore)
                                  : "—"}
                              </p>
                              <p>
                                Liquidity amount:{" "}
                                {formatCurrency(
                                  Number.isFinite(Number(conditionsLatest.proofOfLiquidityAmount))
                                    ? Number(conditionsLatest.proofOfLiquidityAmount)
                                    : null
                                )}
                              </p>
                              <p>Liquidity docs uploaded: {conditionsProofOfLiquidityDocs.length}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Entity + Referral</p>
                              <p>LLC docs submitted: {conditionsLlcDocs.length}</p>
                              <p>Referral name: {readString(conditionsReferral?.name) || "—"}</p>
                              <p>Referral email: {readString(conditionsReferral?.email) || "—"}</p>
                              <p>Referral phone: {readString(conditionsReferral?.phone) || "—"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Experience + Loans</p>
                              <p>Past projects: {conditionsPastProjects.length}</p>
                              <p>
                                Other mortgage loans count:{" "}
                                {Number.isFinite(Number(conditionsLatest.otherMortgageLoansCount))
                                  ? Number(conditionsLatest.otherMortgageLoansCount)
                                  : "—"}
                              </p>
                              <p>
                                Other mortgage total amount:{" "}
                                {formatCurrency(
                                  Number.isFinite(Number(conditionsLatest.otherMortgageTotalAmount))
                                    ? Number(conditionsLatest.otherMortgageTotalAmount)
                                    : null
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </details>
                  </div>
                </details>

                <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-3">Links & Documents</h3>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Property Photos</p>
                      {selectedSummary.linksAndDocuments.photos.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedSummary.linksAndDocuments.photos.map((doc) => (
                            <a
                              key={doc.id}
                              href={doc.url || "#"}
                              className="rounded border border-border bg-white px-2 py-1 text-xs hover:bg-muted"
                              onClick={(event) => {
                                if (!doc.url) event.preventDefault();
                              }}
                            >
                              {doc.name}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No property photos linked.</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Uploaded Documents</p>
                      {selectedSummary.linksAndDocuments.documents.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedSummary.linksAndDocuments.documents.map((doc) => (
                            <a
                              key={doc.id}
                              href={doc.url || "#"}
                              className="rounded border border-border bg-white px-2 py-1 text-xs hover:bg-muted"
                              onClick={(event) => {
                                if (!doc.url) event.preventDefault();
                              }}
                            >
                              {doc.label}: {doc.name}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No documents linked.</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Past Projects</p>
                      {selectedSummary.linksAndDocuments.pastProjects.length > 0 ? (
                        <ul className="space-y-1">
                          {selectedSummary.linksAndDocuments.pastProjects.map((project) => (
                            <li key={project.propertyName}>
                              {project.propertyName} {project.photoLabel ? `(${project.photoLabel})` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">No past projects linked.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-3">Notes / Internal Comments</h3>
                  {selectedSummary.internalNotes.length > 0 ? (
                    <div className="space-y-2">
                      {selectedSummary.internalNotes.map((note) => (
                        <div key={note.id} className="rounded border border-border bg-muted/20 p-3 text-sm">
                          <p className="text-xs text-muted-foreground">
                            {note.source} • {formatDateTime(note.createdAt)}
                          </p>
                          <p className="mt-1">{note.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No internal notes yet.</p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm text-muted-foreground">
                {isSingleLoanView
                  ? `Loan ${requestedLoanId} is not available for underwriting details.`
                  : "Select a pending case to review underwriting details."}
              </p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
