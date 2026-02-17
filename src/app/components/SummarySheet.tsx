import { useEffect, useState } from "react";
import { FileText, Printer, X, Brain, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

interface SummarySheetProps {
  loanApplication: {
    id: string;
    status: string;
    submittedDate: string;
    borrower: {
      name: string;
      email: string;
      phone: string;
      yearsExperience: number;
      completedProjects: number;
    };
    property: {
      address: string;
      type: string;
      purchasePrice: number;
      rehabBudget: number;
      loanAmount: number;
      arv: number;
      assessorValue?: number | null;
      valuationBenchmarks?: {
        assessorValue?: number | null;
        zillowValue?: number | null;
        realtorComValue?: number | null;
        narprValue?: number | null;
        propelioMedianValue?: number | null;
        propelioHighValue?: number | null;
        propelioLowValue?: number | null;
        economicValue?: number | null;
        rentometerEstimate?: number | null;
        zillowRentEstimate?: number | null;
      };
      currentOwner?: string;
      lastSaleDate?: string | null;
      lastSalePrice?: number | null;
      targetClosing: string;
      photos: string[];
    };
    financial: {
      creditScore: number;
      ltv: number;
      ltvDesktop?: number | null;
      ltvEvaluator?: number | null;
      ltvBorrower?: number | null;
      closingCompany: string;
    };
    liquidity: {
      ratio: number;
      availableAssets: {
        checking: number;
        savings: number;
        investments: number;
        total: number;
      };
      assetTypeLabels: string[];
      proofDocuments: Array<{
        name: string;
        category: string;
        source: string;
        url: string | null;
      }>;
      sixMonthCosts: {
        monthlyInterest: number;
        existingLoansMonthlyInterest: number;
        closingCosts: number;
        serviceFees: number;
        documentPreparationFee: number;
        otherMortgageExposure: number;
        originationFee: number;
        prepaidInterest: number;
        total: number;
      };
    };
    conditions: {
      submitted: boolean;
      submittedAt: string;
      creditScore: number | null;
      proofOfLiquidityAmount: number | null;
      otherMortgageLoansCount: number | null;
      otherMortgageTotalAmount: number | null;
      referral: {
        name: string;
        email: string;
        phone: string;
      };
      llcDocuments: Array<{
        name: string;
        docType: string;
        url: string | null;
      }>;
      pastProjects: Array<{
        propertyAddress: string;
        photos: Array<{
          name: string;
          url: string | null;
        }>;
      }>;
    };
    titleAgentForm?: {
      sellerType?: "INDIVIDUAL" | "LLC";
      sellerName?: string;
      sellerLlcName?: string;
      hasAssignor: boolean;
      assignorName: string;
      assignorLlcName: string;
      assignmentFees: string;
    };
    riskFlags: {
      bankruptcy: { status: boolean; details: string };
      foreclosure: { status: boolean; details: string };
      fraud: { status: boolean; details: string };
      internalNegativeList: { status: boolean; details: string };
    };
    cmaReport?: {
      comparables: Array<unknown>;
    };
    aiRecommendation: {
      decision: string;
      confidence: number;
      reasoning: string;
      keyStrengths?: string[];
    };
    evaluatorAssessment: {
      evaluatorName: string;
      evaluatorTitle: string;
      recommendation: string;
      confidence: string;
      asIsValue: number;
      arv: number;
      ltv: number;
      ltvAfterRepairs: number;
      feedback: string;
    };
    referralSource: {
      name: string;
      contact: string;
      phone: string;
      relationship: string;
    };
    currentLenderLoans?: Array<{
      status: string;
      monthsRemaining?: number;
    }>;
  };
  liquidityStatus: {
    color: string;
    label: string;
    description: string;
  };
  onClose: () => void;
  onDecisionSelect?: (decision: "approve" | "more_info" | "decline", recipient?: "borrower" | "loan_officer" | "evaluator") => void;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatCurrencyOrNA(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? formatCurrency(value) : "Not provided";
}

function formatPercent(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}%` : "Not available";
}

function formatSellerName(loan: SummarySheetProps["loanApplication"]): string {
  const sellerType = loan.titleAgentForm?.sellerType;
  const sellerName = (loan.titleAgentForm?.sellerName || "").trim();
  const sellerLlcName = (loan.titleAgentForm?.sellerLlcName || "").trim();
  if (sellerType === "LLC") {
    return sellerLlcName || sellerName || "Not provided";
  }
  if (sellerType === "INDIVIDUAL") {
    return sellerName || "Not provided";
  }
  return sellerName || sellerLlcName || "Not provided";
}

function buildRiskFactors(loan: SummarySheetProps["loanApplication"]) {
  const factors: string[] = [];
  if (loan.financial.ltv >= 76) factors.push("LTV is 76% or above");
  if (loan.liquidity.ratio < 1) factors.push("Liquidity Ratio is below 1");
  if (loan.riskFlags.bankruptcy.status) factors.push("Has a bankruptcy record");
  if (loan.riskFlags.internalNegativeList.status) factors.push("Part of the Internal Watch list");
  if (loan.riskFlags.foreclosure.status) factors.push("Has a negative remark in Forecasa");
  const hasPastDue =
    loan.currentLenderLoans?.some((l) => String(l.status).toLowerCase().includes("past due")) ?? false;
  const hasPastMaturity =
    loan.currentLenderLoans?.some((l) => typeof l.monthsRemaining === "number" && l.monthsRemaining < 0) ?? false;
  if (hasPastDue) factors.push("Has past due in active loans");
  if (hasPastMaturity) factors.push("Active loan(s) past original maturity");
  return factors;
}

export function SummarySheet({
  loanApplication,
  liquidityStatus: _liquidityStatus,
  onClose,
  onDecisionSelect,
}: SummarySheetProps) {
  const [recipient, setRecipient] = useState<"borrower" | "loan_officer" | "evaluator">("borrower");
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const generatedOn = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const benchmarks = (loanApplication.property as any).valuationBenchmarks || {};
  const rentometerValue = benchmarks.rentometerEstimate ?? (loanApplication.property as any).rentometerEstimate;
  const zillowRentValue = benchmarks.zillowRentEstimate ?? (loanApplication.property as any).zillowRentEstimate;
  const riskFactors = buildRiskFactors(loanApplication);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Underwriting Summary Sheet"
    >
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .summary-sheet {
            max-height: none !important;
            overflow: visible !important;
          }
        }
      `}</style>

      <div
        className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-[#0d3b66] text-white p-4 rounded-t-lg flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold mb-0.5">Underwriting Summary Sheet</h2>
            <p className="text-white/80 text-[10px]">Application {loanApplication.id}</p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="summary-sheet p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto text-xs leading-snug">
          <section className="bg-gradient-to-r from-[#0d3b66]/10 to-[#0ea5a5]/10 border-l-4 border-[#0d3b66] p-3 rounded">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] text-[#6b7280]">Application Status</p>
                <p className="text-base font-bold text-[#0d3b66]">{loanApplication.status}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[#6b7280]">Submitted Date</p>
                <p className="font-semibold text-xs">{loanApplication.submittedDate}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[#e5e7eb] bg-gradient-to-r from-[#e8f3ff] via-white to-[#e8fff5] p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#0d3b66] text-white flex items-center justify-center">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#0d3b66] uppercase tracking-wide">AI-Powered Recommendation</p>
                <p className="text-[11px] text-[#6b7280]">Intelligent decision support</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-4 items-stretch">
              <div className="rounded-xl bg-white/90 border border-[#d1d5db] p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-semibold text-[#6b7280]">AI Decision</p>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-xl font-bold text-emerald-600 capitalize">
                  {loanApplication.aiRecommendation.decision || "Not set"}
                </p>
              </div>

              <div className="rounded-xl bg-white/90 border border-[#d1d5db] p-3">
                <p className="text-[11px] font-semibold text-[#6b7280] mb-1.5">Confidence Score</p>
                <p className="text-2xl font-bold text-[#0d3b66] leading-none">
                  {Math.round(Number(loanApplication.aiRecommendation.confidence) || 0)}%
                </p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-[#e5e7eb] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0d3b66]"
                    style={{ width: `${Math.min(100, Math.max(0, Math.round(Number(loanApplication.aiRecommendation.confidence) || 0)))}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => onDecisionSelect?.("approve")}
                  className="rounded-xl border border-emerald-500 bg-emerald-500/10 text-emerald-700 px-3 py-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-500/15 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve Loan
                </button>
                <button
                  type="button"
                  onClick={() => onDecisionSelect?.("more_info", recipient)}
                  className="rounded-xl border border-amber-500 bg-amber-500/10 text-amber-700 px-3 py-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-500/15 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <Clock3 className="w-3.5 h-3.5" />
                  Request More Info
                </button>
                <button
                  type="button"
                  onClick={() => onDecisionSelect?.("decline")}
                  className="rounded-xl border border-red-500 bg-red-500/10 text-red-700 px-3 py-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-red-500/15 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Decline Application
                </button>
                <div className="flex flex-col gap-1 text-xs text-[#374151]">
                  <label className="font-semibold text-[#0d3b66]">Send request to</label>
                  <select
                    className="rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0d3b66]/40"
                    value={recipient}
                    onChange={(e) =>
                      setRecipient(
                        (e.target.value as "borrower" | "loan_officer" | "evaluator") ?? "borrower"
                      )
                    }
                  >
                    <option value="borrower">Borrower</option>
                    <option value="loan_officer">Loan Officer</option>
                    <option value="evaluator">Evaluator</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base font-bold mb-3 flex items-center gap-2 text-[#0d3b66]">
              <FileText className="w-5 h-5" />
              High-Level Overview
            </h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-[#0d3b66]">Property &amp; Ownership</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Borrower", value: loanApplication.borrower.name },
                    { label: "Property Address", value: loanApplication.property.address },
                    { label: "Seller", value: formatSellerName(loanApplication) },
                    {
                      label: "Current Owner",
                      value: loanApplication.property.currentOwner || "Not provided",
                    },
                    {
                      label: "Last Sale Date",
                      value: loanApplication.property.lastSaleDate || "Not provided",
                    },
                    {
                      label: "Last Sale Price",
                      value: formatCurrencyOrNA(loanApplication.property.lastSalePrice),
                    },
                    {
                      label: "Target Closing Date",
                      value: loanApplication.property.targetClosing || "Not provided",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-border bg-white p-4 flex items-center justify-between"
                    >
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-semibold text-right">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-[#0d3b66]">Loan &amp; Valuation</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Total Loan Amount", value: formatCurrency(loanApplication.property.loanAmount) },
                    { label: "Purchase Price", value: formatCurrency(loanApplication.property.purchasePrice) },
                    { label: "Rehab Amount", value: formatCurrency(loanApplication.property.rehabBudget) },
                    { label: "ARV", value: formatCurrency(loanApplication.property.arv) },
                    { label: "LTV (Desktop)", value: formatPercent(loanApplication.financial.ltvDesktop) },
                    { label: "LTV (Evaluator ARV)", value: formatPercent(loanApplication.financial.ltvEvaluator) },
                    { label: "LTV (Borrower ARV)", value: formatPercent(loanApplication.financial.ltvBorrower) },
                    {
                      label: "Liquidity Ratio",
                      value:
                        typeof loanApplication.liquidity.ratio === "number"
                          ? `${loanApplication.liquidity.ratio.toFixed(2)}x`
                          : "Not available",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-border bg-white p-4 flex items-center justify-between"
                    >
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-semibold text-right">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-[#0d3b66]">Property Values</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-white p-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Assessor Value</p>
                    <p className="text-sm font-semibold text-right">
                      {formatCurrencyOrNA(benchmarks.assessorValue ?? (loanApplication.property as any).assessorValue)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-white p-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Zillow Value</p>
                    <p className="text-sm font-semibold text-right">
                      {formatCurrencyOrNA(benchmarks.zillowValue ?? (loanApplication.property as any).zillowValue)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-white p-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Realtor.com Value</p>
                    <p className="text-sm font-semibold text-right">
                      {formatCurrencyOrNA(benchmarks.realtorComValue ?? (loanApplication.property as any).realtorComValue)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-white p-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">NARRPR Value</p>
                    <p className="text-sm font-semibold text-right">
                      {formatCurrencyOrNA(benchmarks.narprValue ?? (loanApplication.property as any).narprValue)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-white p-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Propelio</div>
                    <div className="text-right text-sm font-semibold">
                      <div>{formatCurrencyOrNA(benchmarks.propelioHighValue)}</div>
                      <div className="text-xs text-muted-foreground">
                        Med {formatCurrencyOrNA(benchmarks.propelioMedianValue)} • Low {formatCurrencyOrNA(benchmarks.propelioLowValue)}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-white p-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Economic Value</p>
                    <p className="text-sm font-semibold text-right">
                      {formatCurrencyOrNA(benchmarks.economicValue ?? (loanApplication.property as any).economicValue)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-[#0d3b66]">Rents &amp; Documentation</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      label: "Rentometer Average Rent",
                      value: formatCurrencyOrNA(rentometerValue),
                    },
                    {
                      label: "Zillow Rent Estimate",
                      value: formatCurrencyOrNA(zillowRentValue),
                    },
                    {
                      label: "Comps Provided",
                      value: `${loanApplication.cmaReport?.comparables?.length ?? 0} comps`,
                    },
                    {
                      label: "Photos Uploaded",
                      value: `${loanApplication.property.photos?.length ?? 0} photos`,
                    },
                    {
                      label: "Assignment Fee",
                      value: loanApplication.titleAgentForm?.assignmentFees
                        ? formatCurrency(Number(loanApplication.titleAgentForm.assignmentFees) || 0)
                        : "Not provided",
                    },
                    {
                      label: "Assignor Name",
                      value: loanApplication.titleAgentForm?.hasAssignor
                        ? loanApplication.titleAgentForm.assignorName ||
                          loanApplication.titleAgentForm.assignorLlcName ||
                          "Not provided"
                        : "None",
                    },
                    {
                      label: "Active Loans",
                      value: `${loanApplication.currentLenderLoans?.length ?? 0} active${
                        loanApplication.currentLenderLoans?.length
                          ? ` (${Array.from(
                              new Set((loanApplication.currentLenderLoans || []).map((l) => l.status))
                            ).join(", ")})`
                          : ""
                      }`,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-border bg-white p-4 flex items-center justify-between"
                    >
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-semibold text-right">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-[#0d3b66]">Risk Flags</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      label: "Bankruptcy Status",
                      value: (
                        <StatusBadge variant={loanApplication.riskFlags.bankruptcy.status ? "danger" : "success"}>
                          {loanApplication.riskFlags.bankruptcy.status ? "Flagged" : "Clear"}
                        </StatusBadge>
                      ),
                    },
                    {
                      label: "Internal Watchlist",
                      value: (
                        <StatusBadge
                          variant={loanApplication.riskFlags.internalNegativeList.status ? "danger" : "success"}
                        >
                          {loanApplication.riskFlags.internalNegativeList.status ? "Flagged" : "Clear"}
                        </StatusBadge>
                      ),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-border bg-white p-4 flex items-center justify-between"
                    >
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <div className="text-right">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {riskFactors.length > 0 ? (
            <section>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[#0d3b66]">
                <FileText className="w-5 h-5" />
                Risk Factors
              </h3>
              <ul className="space-y-1 text-sm text-[#374151] list-disc list-inside bg-white border border-border rounded-lg p-4">
                {riskFactors.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {loanApplication.aiRecommendation.keyStrengths && loanApplication.aiRecommendation.keyStrengths.length > 0 ? (
            <section>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[#0d3b66]">
                <FileText className="w-5 h-5" />
                Key Strengths
              </h3>
              <ul className="space-y-1 text-sm text-[#374151] list-disc list-inside bg-white border border-border rounded-lg p-4">
                {loanApplication.aiRecommendation.keyStrengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="bg-muted/30 p-6 rounded-b-lg border-t border-border flex flex-wrap items-center justify-between gap-3 no-print">
          <p className="text-sm text-muted-foreground">Generated on {generatedOn}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-[#0d3b66] text-white px-6 py-2 rounded-lg hover:bg-[#0d3b66]/90 transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Summary
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border border-border px-6 py-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { SummarySheetProps };
