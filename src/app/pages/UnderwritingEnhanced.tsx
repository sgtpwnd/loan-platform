import { StatusBadge } from "../components/StatusBadge";
import {
  AlertTriangle,
  Award,
  Brain,
  Building,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Eye,
  FileText,
  Hammer,
  Home,
  ImageIcon,
  MessageSquare,
  Shield,
  Star,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { SummarySheet } from "../components/SummarySheet";
import { UNDERWRITING_RULES } from "../lib/underwriting/summary";
import {
  fetchLenderEvaluatorInput,
  fetchTitleAgentForm,
  fetchUnderwritingSettings,
  fetchUnderwritingSummaries,
  fetchUnderwritingSummary,
  updatePreApprovalDecision,
  sendLenderPipelineBorrowerMessage,
  addLenderPipelineComment,
  type LenderEvaluatorInputSnapshot,
  type TitleAgentFormData,
  type UnderwritingCaseSummary,
  type UnderwritingSettings,
} from "../services/workflowApi";

type LoanApplication = {
  id: string;
  status: string;
  submittedDate: string;
  borrower: {
    name: string;
    email: string;
    phone: string;
    yearsExperience: number;
    completedProjects: number;
    llcForLoan: string;
    llcDocumentsPreviewUrl: string | null;
  };
  referralSource: {
    name: string;
    contact: string;
    phone: string;
    relationship: string;
  };
  property: {
    address: string;
    type: string;
    purchasePrice: number;
    loanAmount: number;
    rehabBudget: number;
    arv: number;
    valuationBenchmarks: {
      assessorValue: number | null;
      zillowValue: number | null;
      realtorComValue: number | null;
      narprValue: number | null;
      propelioMedianValue: number | null;
      propelioHighValue: number | null;
      propelioLowValue: number | null;
      economicValue: number | null;
      rentometerEstimate: number | null;
      zillowRentEstimate: number | null;
    };
    targetClosing: string;
    closingCompany: string;
    photos: string[];
    purchaseContract: {
      name: string;
      url: string | null;
    } | null;
    scopeOfWork: {
      name: string;
      url: string | null;
    } | null;
  };
  financial: {
    creditScore: number;
    ltv: number;
    ltvDesktop: number | null;
    ltvEvaluator: number | null;
    ltvBorrower: number | null;
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
    desktopAppraisalValue: number | null;
    desktopAppraisalDocs: Array<{
      name: string;
      url: string | null;
    }>;
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
    allUploadedDocuments: Array<{
      id: string;
      category: string;
      label: string;
      name: string;
      source: string;
      url: string | null;
    }>;
  };
  titleAgentForm?: {
    sellerType: "INDIVIDUAL" | "LLC";
    sellerName: string;
    sellerLlcName: string;
    sellerMembers: string[];
    hasAssignor: boolean;
    assignorType: "INDIVIDUAL" | "LLC";
    assignorName: string;
    assignorLlcName: string;
    assignorMembers: string[];
    assignmentFees: string;
    purchaseAgreements: Array<{ name: string; url: string | null }>;
    assignmentAgreements: Array<{ name: string; url: string | null }>;
    updatedAt: string;
  };
  riskFlags: {
    bankruptcy: { status: boolean; details: string };
    foreclosure: { status: boolean; details: string };
    fraud: { status: boolean; details: string };
    internalNegativeList: { status: boolean; details: string };
  };
  aiRecommendation: {
    decision: string;
    confidence: number;
    reasoning: string;
    keyStrengths: string[];
    minorConcerns: string[];
  };
  evaluatorAssessment: {
    evaluatorName: string;
    evaluatorTitle: string;
    evaluationDate: string;
    recommendation: string;
    confidence: string;
    asIsValue: number;
    arv: number;
    ltv: number;
    ltvAfterRepairs: number;
    riskLevel: string;
    feedback: string;
    keyFindings: string[];
    concerns: string[];
  };
  cmaReport: {
    propertyAddress: string;
    neighborhood: string;
    reportDate: string;
    preparedBy: string;
    reportId: string;
    fileName: string;
    preparedDate: string;
    fileSize: string;
    numberOfComps: number;
    thumbnail: string;
    summary: {
      avgSalePrice: number;
      avgPricePerSqFt: number;
      daysOnMarket: number;
      subjectPropertySqFt: number;
    };
    comparables: Array<{
      address: string;
      distance: number;
      salePrice: number;
      pricePerSqFt: number;
      beds: number;
      baths: number;
      sqFt: number;
      soldDate: string;
    }>;
  };
  currentLenderLoans: Array<{
    propertyAddress: string;
    loanAmount: number;
    status: string;
    monthsRemaining: number;
    monthlyPayment: number;
    lastPaymentDate: string;
    nextPaymentDate: string;
    targetCompletionDate?: string;
    estimatedClosingDate?: string;
    notes: Array<{
      date: string;
      author: string;
      content: string;
    }>;
  }>;
};

type EvaluatorInputSnapshot = LenderEvaluatorInputSnapshot;
type NavItem = { id: string; label: string };

const sampleLoanApplication: LoanApplication = {
  id: "LA-2024-1247",
  status: "Under Review",
  submittedDate: "Feb 10, 2026",
  borrower: {
    name: "Michael Chen",
    email: "michael.chen@email.com",
    phone: "(512) 555-0123",
    yearsExperience: 8,
    completedProjects: 14,
    llcForLoan: "MC Capital Ventures LLC",
    llcDocumentsPreviewUrl: null,
  },
  referralSource: {
    name: "Austin Realty Group",
    contact: "Jennifer Martinez",
    phone: "(512) 555-0199",
    relationship: "Real Estate Agent",
  },
  property: {
    address: "789 Maple Drive, Austin, TX 78704",
    type: "Single Family Residence",
    purchasePrice: 450000,
    loanAmount: 337500,
    rehabBudget: 75000,
    arv: 550000,
    valuationBenchmarks: {
      assessorValue: 532000,
      zillowValue: 558000,
      realtorComValue: 551000,
      narprValue: 548500,
      propelioMedianValue: 555000,
      propelioHighValue: 572000,
      propelioLowValue: 538000,
      economicValue: 546000,
      rentometerEstimate: 3650,
      zillowRentEstimate: 3725,
    },
    targetClosing: "Apr 15, 2026",
    closingCompany: "Prime Closing Services",
    photos: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600",
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1600",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600",
    ],
    purchaseContract: null,
    scopeOfWork: null,
  },
    financial: {
      creditScore: 742,
      ltv: 75,
      ltvDesktop: 67,
      ltvEvaluator: 75,
      ltvBorrower: 75,
      closingCompany: "Prime Closing Services",
    },
  liquidity: {
    ratio: 5.31,
    availableAssets: {
      checking: 28500,
      savings: 45200,
      investments: 52000,
      total: 125700,
    },
    assetTypeLabels: ["Bank statements / Checking accounts"],
    proofDocuments: [
      {
        name: "bank-statement-jan-2026.pdf",
        category: "Bank statements / Checking accounts",
        source: "Conditions Form",
        url: null,
      },
    ],
    sixMonthCosts: {
      monthlyInterest: 1898,
      existingLoansMonthlyInterest: 0,
      closingCosts: 6000,
      serviceFees: 950,
      documentPreparationFee: 250,
      otherMortgageExposure: 2000,
      originationFee: 16875,
      prepaidInterest: 0,
      total: 37463,
    },
  },
  conditions: {
    submitted: true,
    submittedAt: "Feb 14, 2026",
    creditScore: 742,
    proofOfLiquidityAmount: 125700,
    otherMortgageLoansCount: 2,
    otherMortgageTotalAmount: 180000,
    desktopAppraisalValue: 250000,
    desktopAppraisalDocs: [{ name: "desktop-appraisal.pdf", url: null }],
    referral: {
      name: "Jennifer Martinez",
      email: "j.martinez@austinrealty.com",
      phone: "(512) 555-0199",
    },
    llcDocuments: [
      { name: "ein.pdf", docType: "EIN", url: null },
      { name: "certificate-of-good-standing.pdf", docType: "Certificate Of Good Standing", url: null },
    ],
    pastProjects: [
      {
        propertyAddress: "210 Barton Creek, Austin, TX",
        photos: [{ name: "Barton-Creek.jpg", url: null }],
      },
    ],
    allUploadedDocuments: [
      {
        id: "sample-doc-1",
        category: "Loan Request - Purchase Contract",
        label: "Purchase Contract",
        name: "purchase-contract.pdf",
        source: "New Loan Request",
        url: null,
      },
      {
        id: "sample-doc-2",
        category: "Conditions - Proof of Liquidity",
        label: "Conditions - Proof of Liquidity",
        name: "bank-statement-jan-2026.pdf",
        source: "Conditions Form",
        url: null,
      },
    ],
  },
  riskFlags: {
    bankruptcy: { status: false, details: "No bankruptcy records found" },
    foreclosure: { status: false, details: "No foreclosure records identified" },
    fraud: { status: false, details: "No fraud screening alerts" },
    internalNegativeList: { status: false, details: "Not found on internal negative list" },
  },
  aiRecommendation: {
    decision: "Approve",
    confidence: 92,
    reasoning:
      "Borrower profile demonstrates strong repayment ability with excellent credit, conservative leverage, and robust liquidity coverage relative to projected six-month obligations. Risk checks returned clean results and prior portfolio behavior is consistent with performing accounts.",
    keyStrengths: [
      "Excellent credit score (742)",
      "Strong liquidity ratio (5.31x)",
      "Conservative LTV at 75%",
      "Clean compliance screenings",
      "Strong historical payment behavior with our portfolio",
    ],
    minorConcerns: ["Monitor timeline against seasonal contractor demand near closing window."],
  },
  evaluatorAssessment: {
    evaluatorName: "Andrea Lopez",
    evaluatorTitle: "Senior Property Evaluator",
    evaluationDate: "Feb 11, 2026",
    recommendation: "Approved",
    confidence: "High",
    asIsValue: 485000,
    arv: 550000,
    ltv: 75,
    ltvAfterRepairs: 61,
    riskLevel: "Low",
    feedback:
      "Subject asset sits in a stable submarket with healthy turnover and buyer demand. Renovation scope is aligned with neighborhood comp standards and expected execution timeline. Proposed leverage and sponsor liquidity profile support near-term refinance or resale exit optionality.",
    keyFindings: [
      "Renovation scope supports projected ARV based on comparable finishes.",
      "Neighborhood absorption remains favorable for median listing periods.",
      "Sponsor execution history aligns with current business plan.",
      "Underwritten LTV remains within policy tolerance.",
    ],
    concerns: ["Track permitting progress weekly until construction kickoff."],
  },
  cmaReport: {
    propertyAddress: "789 Maple Drive, Austin, TX 78704",
    neighborhood: "South Lamar",
    reportDate: "Feb 11, 2026",
    preparedBy: "Valuation Desk",
    reportId: "CMA-2026-0412",
    fileName: "CMA_789_Maple_Drive.pdf",
    preparedDate: "Feb 11, 2026",
    fileSize: "2.8 MB",
    numberOfComps: 5,
    thumbnail:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900",
    summary: {
      avgSalePrice: 559000,
      avgPricePerSqFt: 322,
      daysOnMarket: 24,
      subjectPropertySqFt: 1720,
    },
    comparables: [
      {
        address: "751 Ridgeview Ln, Austin, TX",
        distance: 0.31,
        salePrice: 562000,
        pricePerSqFt: 326,
        beds: 3,
        baths: 2,
        sqFt: 1724,
        soldDate: "Jan 27, 2026",
      },
      {
        address: "805 Garden Oaks Ave, Austin, TX",
        distance: 0.42,
        salePrice: 548000,
        pricePerSqFt: 318,
        beds: 3,
        baths: 2,
        sqFt: 1722,
        soldDate: "Jan 19, 2026",
      },
      {
        address: "692 Barton Heights Dr, Austin, TX",
        distance: 0.48,
        salePrice: 571000,
        pricePerSqFt: 329,
        beds: 4,
        baths: 3,
        sqFt: 1735,
        soldDate: "Dec 22, 2025",
      },
      {
        address: "710 Bluebonnet St, Austin, TX",
        distance: 0.53,
        salePrice: 552000,
        pricePerSqFt: 320,
        beds: 3,
        baths: 2,
        sqFt: 1725,
        soldDate: "Dec 11, 2025",
      },
      {
        address: "834 Willow Crest Way, Austin, TX",
        distance: 0.61,
        salePrice: 566000,
        pricePerSqFt: 325,
        beds: 3,
        baths: 2,
        sqFt: 1740,
        soldDate: "Nov 30, 2025",
      },
    ],
  },
  currentLenderLoans: [
    {
      propertyAddress: "123 Main Street, Austin, TX",
      loanAmount: 435000,
      status: "Rehab in progress",
      monthsRemaining: 7,
      monthlyPayment: 2940,
      lastPaymentDate: "Jan 30, 2026",
      nextPaymentDate: "Feb 28, 2026",
      targetCompletionDate: "Mar 22, 2026",
      notes: [
        {
          date: "Feb 02, 2026",
          author: "Portfolio Ops",
          content: "Rehab draw #2 approved after framing and electrical walkthrough.",
        },
        {
          date: "Jan 26, 2026",
          author: "Asset Manager",
          content: "Borrower confirmed contractor timeline and requested mid-March progress inspection.",
        },
      ],
    },
    {
      propertyAddress: "456 Oak Avenue, Austin, TX",
      loanAmount: 285000,
      status: "Construction in progress",
      monthsRemaining: 6,
      monthlyPayment: 1985,
      lastPaymentDate: "Jan 28, 2026",
      nextPaymentDate: "Feb 27, 2026",
      targetCompletionDate: "Apr 18, 2026",
      notes: [
        {
          date: "Feb 01, 2026",
          author: "Servicing",
          content: "Construction milestone packet received; permit close-out expected in early April.",
        },
      ],
    },
    {
      propertyAddress: "908 Elm Terrace, Austin, TX",
      loanAmount: 310000,
      status: "Refinance in process",
      monthsRemaining: 5,
      monthlyPayment: 2210,
      lastPaymentDate: "Feb 03, 2026",
      nextPaymentDate: "Mar 03, 2026",
      estimatedClosingDate: "Mar 14, 2026",
      notes: [
        {
          date: "Feb 05, 2026",
          author: "Capital Markets",
          content: "Rate lock completed with external lender and title file is in final review.",
        },
        {
          date: "Feb 04, 2026",
          author: "Servicing",
          content: "Borrower requested payoff quote update tied to projected March refinance close.",
        },
      ],
    },
  ],
};

function formatCurrency(value: number) {
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function calculateLiquidityStatus(
  ratio: number,
  thresholds: { acceptableLiquidityRatio: number; excellentLiquidityRatio: number }
) {
  if (ratio >= thresholds.excellentLiquidityRatio) return { variant: "success" as const, label: "Excellent", icon: CheckCircle2 };
  if (ratio >= thresholds.acceptableLiquidityRatio) return { variant: "warning" as const, label: "Adequate", icon: AlertTriangle };
  return { variant: "danger" as const, label: "Insufficient", icon: XCircle };
}

function buildRiskFactors(loan: LoanApplication) {
  const factors: string[] = [];
  if (loan.financial.ltv >= 76) factors.push("LTV is 76% or above");
  if (loan.liquidity.ratio < 1) factors.push("Liquidity Ratio is below 1");
  if (loan.riskFlags.bankruptcy.status) factors.push("Has a bankruptcy record");
  if (loan.riskFlags.internalNegativeList.status) factors.push("Part of the Internal Watch list");
  if (loan.riskFlags.foreclosure.status) factors.push("Has a negative remark in Forecasa");

  const hasPastDueLoan =
    loan.currentLenderLoans?.some((l) => String(l.status).toLowerCase().includes("past due")) ?? false;
  const hasPastMaturity =
    loan.currentLenderLoans?.some((l) => typeof l.monthsRemaining === "number" && l.monthsRemaining < 0) ?? false;
  if (hasPastDueLoan) factors.push("Has past due in active loans");
  if (hasPastMaturity) factors.push("Active loan(s) past original maturity");

  return factors;
}

function getExistingLoanStatusVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("refinanc")) return "info" as const;
  if (normalized.includes("rehab") || normalized.includes("construction")) return "warning" as const;
  return "success" as const;
}

function getExistingLoanMilestone(loan: LoanApplication["currentLenderLoans"][number]) {
  const normalized = loan.status.toLowerCase();
  if (normalized.includes("refinanc")) {
    return { label: "Estimated Closing Date", value: loan.estimatedClosingDate || "Not provided" };
  }
  if (normalized.includes("rehab") || normalized.includes("construction")) {
    return { label: "Target Completion Date", value: loan.targetCompletionDate || "Not provided" };
  }
  return null;
}

function OverviewItem({
  icon,
  label,
  value,
  valueClassName = "text-[#0d3b66]",
  subtitle,
  action,
  rightContent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  subtitle?: string;
  action?: {
    href: string;
    label: string;
  };
  rightContent?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg p-5 border border-[#e5e7eb] shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#6b7280]">
          {icon}
          {label}
        </div>
        {action ? (
          <a
            href={action.href}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-[#0d3b66] hover:underline"
          >
            {action.label}
          </a>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-xl font-bold ${valueClassName}`}>{value}</p>
        {rightContent}
      </div>
      {subtitle ? <p className="text-sm text-[#6b7280] mt-1">{subtitle}</p> : null}
    </div>
  );
}

function HeaderChip({ children }: { children: ReactNode }) {
  return (
    <div className="w-16 h-10 rounded-lg bg-[#0d3b66] flex items-center justify-center text-white">
      {children}
    </div>
  );
}

const DEFAULT_PROPERTY_PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="44" fill="#6b7280">No property photo uploaded</text></svg>'
)}`;

const PENDING_UNDERWRITING_STATUSES = new Set(["UW for Review", "In-underwriting", "Under Review"]);

const DEFAULT_UNDERWRITING_SETTINGS: UnderwritingSettings = {
  maxLtv: UNDERWRITING_RULES.maxLtv,
  maxLtc: UNDERWRITING_RULES.maxLtc,
  minCreditScore: UNDERWRITING_RULES.minCreditScore,
  minLiquidityToLoanRatio: UNDERWRITING_RULES.minLiquidityToLoanRatio,
  acceptableLiquidityRatio: UNDERWRITING_RULES.acceptableLiquidityRatio,
  excellentLiquidityRatio: UNDERWRITING_RULES.excellentLiquidityRatio,
  maxOtherMortgageLoans: UNDERWRITING_RULES.maxOtherMortgageLoans,
  liquidityMonths: UNDERWRITING_RULES.liquidityMonths,
  assumedAnnualInterestRate: UNDERWRITING_RULES.assumedAnnualInterestRate,
  prepaidInterestAnnualRate: UNDERWRITING_RULES.prepaidInterestAnnualRate,
  perDiemDayCountBasis: UNDERWRITING_RULES.perDiemDayCountBasis,
  monthlyServiceFee: UNDERWRITING_RULES.monthlyServiceFee,
  documentPreparationFee: UNDERWRITING_RULES.documentPreparationFee,
  closingCostEstimate: UNDERWRITING_RULES.closingCostEstimate,
  originationFeePercent: UNDERWRITING_RULES.originationFeePercent,
  estimatedOtherLenderMonthlyPaymentFactor: UNDERWRITING_RULES.estimatedOtherLenderMonthlyPaymentFactor,
  estimatedOtherLenderLoanFactor: UNDERWRITING_RULES.estimatedOtherLenderLoanFactor,
  shortClosingTimelineDays: UNDERWRITING_RULES.shortClosingTimelineDays,
  declineCreditScore: UNDERWRITING_RULES.declineCreditScore,
  declineLtv: UNDERWRITING_RULES.declineLtv,
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const normalized = value.replace(/[^0-9.-]/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readNumericFromKeys(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) return null;
  for (const key of keys) {
    const value = toNumber(source[key]);
    if (value !== null) return value;
  }
  return null;
}

function parseCurrencyAmount(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/[^0-9.-]/g, "");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePercentToNumber(value: string | number | null | undefined): number | null {
  const parsed = toNumber(value);
  return parsed !== null ? parsed : null;
}

function formatDisplayDateFromTimestamp(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not provided";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "Not provided";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function formatOptionalCurrency(value: number | null | undefined, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not provided";
  return `${formatCurrency(value)}${suffix}`;
}

function formatOptionalDate(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "Not provided";
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "Not provided";
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function calculateDaysToFirstDayOfFollowingMonth(value: string | null | undefined) {
  if (!value) return 0;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let baseDate: Date | null = null;
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    if (Number.isFinite(year) && Number.isFinite(monthIndex) && Number.isFinite(day)) {
      baseDate = new Date(Date.UTC(year, monthIndex, day));
    }
  } else {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      const parsedDate = new Date(parsed);
      baseDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()));
    }
  }
  if (!baseDate) return 0;
  const firstDayOfFollowingMonth = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1));
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((firstDayOfFollowingMonth.getTime() - baseDate.getTime()) / dayMs));
}

function calculateDaysUntilDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(parsed);
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.ceil((targetDate.getTime() - today.getTime()) / dayMs);
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function extractProofOfLiquidityCategory(label: string) {
  const normalized = label
    .replace(/^conditions\s*-\s*/i, "")
    .replace(/^proof of liquidity\s*-\s*/i, "")
    .replace(/^conditions\s*-\s*proof of liquidity\s*-\s*/i, "")
    .trim();
  return normalized || "Proof of Liquidity";
}

function extractLlcDocTypeFromLabel(label: string) {
  const normalized = label
    .replace(/^conditions\s*-\s*llc document\s*-\s*/i, "")
    .replace(/^llc document\s*-\s*/i, "")
    .replace(/^conditions\s*-\s*llc document\s*/i, "")
    .replace(/^llc document\s*/i, "")
    .trim();
  return normalized || "LLC Document";
}

function formatDocumentSourceLabel(source: string) {
  const normalized = source.trim().toLowerCase();
  if (normalized === "new_loan_request") return "New Loan Request";
  if (normalized === "continuation_form") return "Conditions / Continuation";
  if (normalized === "borrower_profile") return "Borrower Profile";
  if (normalized === "internal") return "Internal";
  return "Borrower Portal";
}

function classifyUploadedDocumentCategory(label: string, source: string) {
  const normalizedLabel = label.trim().toLowerCase();
  const normalizedSource = source.trim().toLowerCase();

  if (normalizedLabel.includes("conditions") && normalizedLabel.includes("proof of liquidity")) {
    return "Conditions - Proof of Liquidity";
  }
  if (normalizedLabel.includes("conditions") && normalizedLabel.includes("llc document")) {
    return "Conditions - LLC Documents";
  }
  if (normalizedLabel.includes("conditions") && normalizedLabel.includes("past project")) {
    return "Conditions - Past Projects";
  }
  if (normalizedLabel.includes("purchase contract")) {
    return "Loan Request - Purchase Contract";
  }
  if (normalizedLabel.includes("scope of work")) {
    return "Loan Request - Scope of Work";
  }
  if (normalizedLabel.includes("comp") || normalizedLabel.includes("cma")) {
    return "Loan Request - COMPS / CMA";
  }
  if (normalizedLabel.includes("property photo")) {
    return "Loan Request - Property Photos";
  }
  if (normalizedLabel.includes("llc document")) {
    return "Continuation - LLC Documents";
  }
  if (normalizedLabel.includes("past project")) {
    return "Continuation - Past Projects";
  }
  if (normalizedSource === "new loan request") {
    return "Loan Request - Other";
  }
  if (normalizedSource === "conditions / continuation") {
    return "Conditions / Continuation - Other";
  }
  if (normalizedSource === "borrower profile") {
    return "Borrower Profile - Other";
  }
  if (normalizedSource === "internal") {
    return "Internal";
  }
  return "Other";
}

function isLikelyImage(url: string, name: string, label: string) {
  if (url.startsWith("data:image/")) return true;
  const sample = `${url} ${name} ${label}`.toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(sample) || sample.includes("photo") || sample.includes("image");
}

function extractPhotoUrls(summary: UnderwritingCaseSummary) {
  const urls: string[] = [];
  summary.linksAndDocuments.photos.forEach((photo) => {
    if (photo.url && isLikelyImage(photo.url, photo.name, photo.label)) {
      urls.push(photo.url);
    }
  });
  summary.linksAndDocuments.pastProjects.forEach((project) => {
    if (project.photoUrl && isLikelyImage(project.photoUrl, project.photoLabel, project.propertyName)) {
      urls.push(project.photoUrl);
    }
  });
  const unique = Array.from(new Set(urls));
  return unique.length > 0 ? unique : [DEFAULT_PROPERTY_PHOTO];
}

function buildRiskCheck(
  summary: UnderwritingCaseSummary,
  keywords: string[],
  defaultDetail: string
): { status: boolean; details: string } {
  const match = summary.riskFlags.find((flag) => {
    const source = `${flag.label} ${flag.detail}`.toLowerCase();
    return keywords.some((keyword) => source.includes(keyword));
  });
  if (!match) return { status: false, details: defaultDetail };
  return {
    status: match.state !== "info",
    details: match.detail || match.label || defaultDetail,
  };
}

function getStatusBadgeVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("approve")) return "success" as const;
  if (normalized.includes("declin")) return "danger" as const;
  if (normalized.includes("review")) return "info" as const;
  return "warning" as const;
}

function calculateMonthsRemaining(dateValue: string) {
  if (!dateValue) return 0;
  const parsed = Date.parse(dateValue);
  if (!Number.isFinite(parsed)) return 0;
  const deltaMs = parsed - Date.now();
  if (deltaMs <= 0) return 0;
  return Math.max(0, Math.ceil(deltaMs / (1000 * 60 * 60 * 24 * 30)));
}

function mapUnderwritingSummaryToLoanApplication(
  summary: UnderwritingCaseSummary,
  settings: UnderwritingSettings = DEFAULT_UNDERWRITING_SETTINGS,
  evaluatorInput?: EvaluatorInputSnapshot | null,
  titleAgentFormOverride?: TitleAgentFormData | null
): LoanApplication {
  const evaluatorValues = evaluatorInput?.values || null;
  const hasEvaluatorInput =
    evaluatorInput?.isComplete &&
    evaluatorValues &&
    Object.values(evaluatorValues).some((value) => readString(value).trim().length > 0);
  const evaluatorAsIsValue = toNumber(evaluatorValues?.asIsValue);
  const evaluatorArv = toNumber(evaluatorValues?.arv);
  const evaluatorCurrentLtv = parsePercentToNumber(evaluatorValues?.currentLtv);
  const evaluatorLtvAfterRepairs = parsePercentToNumber(evaluatorValues?.ltvAfterRepairs);
  const evaluatorRecommendation = readString(evaluatorValues?.recommendation) || null;
  const evaluatorConfidenceRaw = readString(evaluatorValues?.confidence);
  const evaluatorConfidence = evaluatorConfidenceRaw || null;
  const evaluatorRiskLevelInput = readString(evaluatorValues?.riskLevel) || null;
  const evaluatorProfessionalAssessment = readString(evaluatorValues?.professionalAssessment) || "";
  const evaluatorKeyFindings = [
    evaluatorValues?.keyFindingLtv ? `LTV: ${evaluatorValues.keyFindingLtv}` : null,
    evaluatorValues?.keyFindingApplication ? `Application: ${evaluatorValues.keyFindingApplication}` : null,
    evaluatorValues?.keyFindingScore ? `Score: ${evaluatorValues.keyFindingScore}` : null,
  ].filter(Boolean) as string[];
  const evaluatorCmaAvgSalePrice = toNumber(evaluatorValues?.cmaAvgSalePrice);
  const evaluatorCmaPricePerSqFt = toNumber(evaluatorValues?.cmaPricePerSqFt);
  const evaluatorCmaDaysOnMarket = toNumber(evaluatorValues?.cmaDaysOnMarket);
  const evaluatorCmaSubjectSqFt = toNumber(evaluatorValues?.cmaSubjectSqFt);
  const continuationLatest = readObject(summary.borrowerPortal.continuation.latest);
  const continuationBorrowerProfile = readObject(continuationLatest?.borrowerProfile);
  const continuationReferral = readObject(continuationLatest?.referral);
  const continuationActiveLoans = Array.isArray(continuationLatest?.activeLoans)
    ? continuationLatest.activeLoans
        .map((loan) => readObject(loan))
        .filter((loan): loan is Record<string, unknown> => Boolean(loan))
    : [];
  const continuationPastProjects = Array.isArray(continuationLatest?.pastProjects)
    ? continuationLatest.pastProjects
        .map((project) => readObject(project))
        .filter((project): project is Record<string, unknown> => Boolean(project))
    : [];

  const conditionsLatest = readObject(summary.borrowerPortal.conditions?.latest);
  const conditionsReferral = readObject(conditionsLatest?.referral);
  const conditionsPastProjects = Array.isArray(conditionsLatest?.pastProjects)
    ? conditionsLatest.pastProjects
        .map((project) => readObject(project))
        .filter((project): project is Record<string, unknown> => Boolean(project))
    : [];
  const conditionsLlcDocs = Array.isArray(conditionsLatest?.llcDocs)
    ? conditionsLatest.llcDocs
        .map((doc) => readObject(doc))
        .filter((doc): doc is Record<string, unknown> => Boolean(doc))
    : [];
  const conditionsProofDocs = Array.isArray(conditionsLatest?.proofOfLiquidityDocs)
    ? conditionsLatest.proofOfLiquidityDocs
        .map((doc) => readObject(doc))
        .filter((doc): doc is Record<string, unknown> => Boolean(doc))
    : [];
  const conditionsDesktopAppraisalDocs = Array.isArray(conditionsLatest?.desktopAppraisalDocs)
    ? conditionsLatest.desktopAppraisalDocs
        .map((doc) => readObject(doc))
        .filter((doc): doc is Record<string, unknown> => Boolean(doc))
    : [];
  const linkedProofDocs = summary.linksAndDocuments.documents.filter((doc) =>
    /proof of liquidity/i.test(`${doc.label} ${doc.name}`)
  );
  const linkedDesktopAppraisalDocs = summary.linksAndDocuments.documents.filter((doc) =>
    /desktop appraisal/i.test(`${doc.label} ${doc.name}`)
  );
  const linkedLlcDocs = summary.linksAndDocuments.documents.filter((doc) => /llc document/i.test(`${doc.label} ${doc.name}`));
  const linkedPastProjectPhotos = summary.linksAndDocuments.documents.filter((doc) =>
    /past project photo/i.test(`${doc.label} ${doc.name}`)
  );
  const titleAgentForm = summary.titleAgentForm || null;
  const allUploadedDocumentsMap = new Map<
    string,
    {
      id: string;
      category: string;
      label: string;
      name: string;
      source: string;
      url: string | null;
    }
  >();

  const appendUploadedDocument = (document: {
    id?: string;
    label?: string;
    name?: string;
    source?: string;
    url?: string | null;
  }) => {
    const name = readString(document.name).trim();
    const label = readString(document.label).trim() || "Uploaded Document";
    const source = formatDocumentSourceLabel(readString(document.source));
    const category = classifyUploadedDocumentCategory(label, source);
    const url = document.url && typeof document.url === "string" ? document.url : null;
    const key = url || `${source}|${label}|${name}`;
    if (!key || allUploadedDocumentsMap.has(key)) return;
    allUploadedDocumentsMap.set(key, {
      id: readString(document.id) || `uploaded-doc-${allUploadedDocumentsMap.size + 1}`,
      category,
      label,
      name: name || label,
      source,
      url,
    });
  };

  summary.linksAndDocuments.documents.forEach((doc) => {
    appendUploadedDocument(doc);
  });
  summary.linksAndDocuments.photos.forEach((photo) => {
    appendUploadedDocument(photo);
  });
  summary.linksAndDocuments.pastProjects.forEach((project, index) => {
    appendUploadedDocument({
      id: `past-project-${index + 1}`,
      label: project.propertyName ? `Past Project Photo - ${project.propertyName}` : "Past Project Photo",
      name: project.photoLabel || `past-project-photo-${index + 1}`,
      source: "continuation_form",
      url: project.photoUrl || null,
    });
  });
  const allUploadedDocuments = Array.from(allUploadedDocumentsMap.values()).sort(
    (left, right) =>
      left.category.localeCompare(right.category) ||
      left.source.localeCompare(right.source) ||
      left.label.localeCompare(right.label) ||
      left.name.localeCompare(right.name)
  );

  const proofOfLiquidityDocuments =
    conditionsProofDocs.length > 0
      ? conditionsProofDocs.map((doc, index) => {
          const categoryParts = [readString(doc.category), readString(doc.subcategory)].filter(Boolean);
          const linkedDoc = linkedProofDocs[index];
          return {
            name: readString(doc.name) || linkedDoc?.name || `proof-of-liquidity-${index + 1}.pdf`,
            category:
              categoryParts.length > 0
                ? categoryParts.map(formatEnumLabel).join(" / ")
                : extractProofOfLiquidityCategory(linkedDoc?.label || ""),
            source: "Conditions Form",
            url: linkedDoc?.url || null,
          };
        })
      : linkedProofDocs.map((doc) => ({
          name: doc.name || "proof-of-liquidity.pdf",
          category: extractProofOfLiquidityCategory(doc.label || ""),
          source: /conditions/i.test(doc.label) ? "Conditions Form" : "Borrower Portal",
          url: doc.url || null,
        }));

  const desktopAppraisalDocuments =
    conditionsDesktopAppraisalDocs.length > 0
      ? conditionsDesktopAppraisalDocs.map((doc, index) => {
          const linkedDoc = linkedDesktopAppraisalDocs[index];
          return {
            name: readString(doc.name) || linkedDoc?.name || `desktop-appraisal-${index + 1}.pdf`,
            url: linkedDoc?.url || null,
          };
        })
      : linkedDesktopAppraisalDocs.map((doc, index) => ({
          name: doc.name || `desktop-appraisal-${index + 1}.pdf`,
          url: doc.url || null,
        }));

  const conditionLlcDocuments =
    conditionsLlcDocs.length > 0
      ? conditionsLlcDocs.map((doc, index) => {
          const linkedDoc = linkedLlcDocs[index];
          const rawType = readString(doc.docType);
          return {
            name: readString(doc.name) || linkedDoc?.name || `llc-document-${index + 1}.pdf`,
            docType: rawType ? formatEnumLabel(rawType) : extractLlcDocTypeFromLabel(linkedDoc?.label || ""),
            url: linkedDoc?.url || null,
          };
        })
      : linkedLlcDocs.map((doc, index) => ({
          name: doc.name || `llc-document-${index + 1}.pdf`,
          docType: extractLlcDocTypeFromLabel(doc.label || ""),
          url: doc.url || null,
        }));

  let conditionsPastProjectPhotoCursor = 0;
  const conditionPastProjectsDetailed =
    conditionsPastProjects.length > 0
      ? conditionsPastProjects.map((project, index) => {
          const projectPhotos = Array.isArray(project.photos)
            ? project.photos.map((photo) => readObject(photo)).filter((photo): photo is Record<string, unknown> => Boolean(photo))
            : [];
          return {
            propertyAddress: readString(project.propertyAddress) || `Project ${index + 1}`,
            photos: projectPhotos.map((photo, photoIndex) => {
              const linkedDoc = linkedPastProjectPhotos[conditionsPastProjectPhotoCursor++];
              return {
                name: readString(photo.name) || linkedDoc?.name || `project-${index + 1}-photo-${photoIndex + 1}.jpg`,
                url: linkedDoc?.url || null,
              };
            }),
          };
        })
      : linkedPastProjectPhotos.length > 0
        ? [
            {
              propertyAddress: "Past Project",
              photos: linkedPastProjectPhotos.map((doc) => ({
                name: doc.name || "project-photo.jpg",
                url: doc.url || null,
              })),
            },
          ]
        : [];

  const propertyRequest = summary.borrowerPortal.newLoanRequest.loanRequest;
  const propertyRequestRecord = readObject(propertyRequest);
  const purchaseDetailsLO = readObject((summary as any).purchaseDetails);
  const valuationCurrentOwner = readString(purchaseDetailsLO?.currentOwner) || readString(propertyRequestRecord?.currentOwner);
  const valuationLastSaleDate = readString(purchaseDetailsLO?.lastSaleDate) || readString(propertyRequestRecord?.lastSaleDate);
  const valuationLastSalePrice =
    readNumericFromKeys(purchaseDetailsLO || {}, ["lastSalePrice", "last_sale_price"]) ??
    readNumericFromKeys(propertyRequestRecord, ["lastSalePrice", "last_sale_price"]);
  const purchasePrice = parseCurrencyAmount(propertyRequest.purchasePrice);
  const rehabBudget = parseCurrencyAmount(propertyRequest.rehabBudget);
  const arv = parseCurrencyAmount(propertyRequest.arv);
  const assessorValue = readNumericFromKeys(propertyRequestRecord, ["assessorValue", "assessor", "assessor_value"]);
  const zillowValue = readNumericFromKeys(propertyRequestRecord, ["zillowValue", "zillow_value"]);
  const realtorComValue = readNumericFromKeys(propertyRequestRecord, [
    "realtorComValue",
    "realtorValue",
    "realtor_dot_com_value",
  ]);
  const narprValue = readNumericFromKeys(propertyRequestRecord, ["narprValue", "narrprValue", "narpr_value", "narrpr_value"]);
  const propelioMedianValue = readNumericFromKeys(propertyRequestRecord, ["propelioMedianValue", "propelio_median_value"]);
  const propelioHighValue = readNumericFromKeys(propertyRequestRecord, ["propelioHighValue", "propelio_high_value"]);
  const propelioLowValue = readNumericFromKeys(propertyRequestRecord, ["propelioLowValue", "propelio_low_value"]);
  const economicValue = readNumericFromKeys(propertyRequestRecord, ["economicValue", "economic_value"]);
  const rentometerEstimate = readNumericFromKeys(propertyRequestRecord, ["rentometerEstimate", "rentometer_estimate"]);
  const zillowRentEstimate = readNumericFromKeys(propertyRequestRecord, ["zillowRentEstimate", "zillow_rent_estimate"]);
  const requestedLoanAmount = toNumber(summary.executive.requestedLoanAmount) ?? toNumber(propertyRequest.amount) ?? 0;
  const liquidityMonths = settings.liquidityMonths;
  const assumedAnnualInterestRate = settings.assumedAnnualInterestRate;
  const prepaidInterestAnnualRate = settings.prepaidInterestAnnualRate;
  const perDiemDayCountBasis = settings.perDiemDayCountBasis > 0 ? settings.perDiemDayCountBasis : 360;

  const coverageRecord = summary.qualification.liquidityCoverage as Record<string, unknown>;
  const monthlyInterestSixMonth = toNumber(coverageRecord.monthlyInterestSixMonth);
  const existingLoansMonthlyPaymentTotal = continuationActiveLoans.reduce((sum, loan) => {
    const payment = toNumber(loan.monthlyPayment);
    return payment && payment > 0 ? sum + payment : sum;
  }, 0);
  const conditionsOtherMortgageTotalAmount = toNumber(conditionsLatest?.otherMortgageTotalAmount);
  const conditionsDesktopAppraisalValue = toNumber(conditionsLatest?.desktopAppraisalValue);
  const existingLoansExposure =
    toNumber(coverageRecord.withUsExposure) ?? existingLoansMonthlyPaymentTotal * liquidityMonths;
  const totalOtherLoansExposure = toNumber(coverageRecord.otherLoansMonthlyPaymentsSixMonth) ?? 0;
  const otherMortgageExposure =
    toNumber(coverageRecord.estimatedOtherLenderExposure) ??
    (conditionsOtherMortgageTotalAmount && conditionsOtherMortgageTotalAmount > 0
      ? conditionsOtherMortgageTotalAmount * liquidityMonths
      : Math.max(totalOtherLoansExposure - existingLoansExposure, 0));
  const closingCostEstimate = toNumber(coverageRecord.closingCostEstimate) ?? settings.closingCostEstimate;
  const serviceFee =
    toNumber(coverageRecord.serviceFeesSixMonth) ??
    toNumber(coverageRecord.serviceFee) ??
    settings.monthlyServiceFee;
  const documentPreparationFee =
    toNumber(coverageRecord.documentPreparationFee) ?? settings.documentPreparationFee;
  const originationFee =
    toNumber(coverageRecord.originationFee) ??
    (requestedLoanAmount > 0 ? (requestedLoanAmount / 100) * settings.originationFeePercent : 0);
  const prepaidInterestDays =
    toNumber(coverageRecord.prepaidInterestDays) ??
    calculateDaysToFirstDayOfFollowingMonth(propertyRequest.targetClosingDate);
  const prepaidInterestPerDiem =
    toNumber(coverageRecord.prepaidInterestPerDiem) ??
    (requestedLoanAmount > 0
      ? ((requestedLoanAmount / 100) * (prepaidInterestAnnualRate * 100)) / perDiemDayCountBasis
      : 0);
  const prepaidInterest = toNumber(coverageRecord.prepaidInterest) ?? prepaidInterestPerDiem * prepaidInterestDays;
  const requiredLiquidity =
    summary.qualification.liquidityCoverage.requiredLiquidity ??
    (monthlyInterestSixMonth ?? (requestedLoanAmount * assumedAnnualInterestRate) / 12 * liquidityMonths) +
      closingCostEstimate +
      serviceFee +
      documentPreparationFee +
      existingLoansExposure +
      otherMortgageExposure +
      originationFee +
      prepaidInterest;
  const monthlyInterest =
    monthlyInterestSixMonth !== null
      ? monthlyInterestSixMonth / liquidityMonths
      : (requestedLoanAmount * assumedAnnualInterestRate) / 12;
  const existingLoansMonthlyInterest = existingLoansExposure / liquidityMonths;
  const continuationLiquidityAmount = toNumber(continuationLatest?.proofOfLiquidityAmount);
  const conditionsLiquidityAmount = toNumber(conditionsLatest?.proofOfLiquidityAmount);
  const conditionsCreditScore = toNumber(conditionsLatest?.creditScore);
  const mergedCreditScore = conditionsCreditScore ?? summary.qualification.creditScore ?? 0;
  const conditionsOtherMortgageLoansCount = toNumber(conditionsLatest?.otherMortgageLoansCount);
  const conditionsSubmittedAtTimestamp =
    summary.borrowerPortal.conditions?.latestSubmittedAt ??
    toNumber(conditionsLatest?.updatedAt) ??
    toNumber(conditionsLatest?.submittedAt);
  const conditionsSubmittedAt = formatDisplayDateFromTimestamp(conditionsSubmittedAtTimestamp);
  const assetTypeLabels = Array.from(
    new Set(proofOfLiquidityDocuments.map((doc) => doc.category).filter((label) => typeof label === "string" && label.trim()))
  );
  const availableLiquidity =
    conditionsLiquidityAmount ??
    continuationLiquidityAmount ??
    summary.qualification.liquidityCoverage.availableLiquidity ??
    summary.qualification.liquidityAmount ??
    0;
  const primaryAssetType = (assetTypeLabels[0] || "").toLowerCase();
  const mapsToSavings = primaryAssetType.includes("savings") || primaryAssetType.includes("money market");
  const mapsToInvestments =
    primaryAssetType.includes("brokerage") ||
    primaryAssetType.includes("investment") ||
    primaryAssetType.includes("stocks") ||
    primaryAssetType.includes("etf") ||
    primaryAssetType.includes("mutual") ||
    primaryAssetType.includes("retirement") ||
    primaryAssetType.includes("401") ||
    primaryAssetType.includes("ira") ||
    primaryAssetType.includes("bond") ||
    primaryAssetType.includes("crypto") ||
    primaryAssetType.includes("bitcoin") ||
    primaryAssetType.includes("ethereum") ||
    primaryAssetType.includes("stablecoin") ||
    primaryAssetType.includes("line of credit") ||
    primaryAssetType.includes("heloc") ||
    primaryAssetType.includes("margin") ||
    primaryAssetType.includes("cash value life insurance");
  const assetChecking = mapsToSavings || mapsToInvestments ? 0 : availableLiquidity;
  const assetSavings = mapsToSavings ? availableLiquidity : 0;
  const assetInvestments = mapsToInvestments ? availableLiquidity : 0;
  const liquidityRatio = requiredLiquidity > 0 ? availableLiquidity / requiredLiquidity : 0;

  const referralName = readString(conditionsReferral?.name) || readString(continuationReferral?.name);
  const referralEmail = readString(conditionsReferral?.email) || readString(continuationReferral?.email);
  const referralPhone = readString(conditionsReferral?.phone) || readString(continuationReferral?.phone);
  const llcForLoan =
    readString(continuationLatest?.llcName) ||
    readString(summary.executive.borrowerEntity) ||
    readString(summary.borrowerPortal.newLoanRequest.borrower.entityName) ||
    "Not provided";
  const llcDocumentsPreviewUrl =
    (typeof summary.linksAndDocuments.llcDocumentsViewerUrl === "string" &&
    summary.linksAndDocuments.llcDocumentsViewerUrl.trim()
      ? summary.linksAndDocuments.llcDocumentsViewerUrl
      : null) || linkedLlcDocs.find((doc) => typeof doc.url === "string" && doc.url.trim())?.url || null;

  const profilePhone =
    readString(continuationBorrowerProfile?.mobilePhone) ||
    readString(continuationBorrowerProfile?.homePhone) ||
    readString(continuationBorrowerProfile?.workPhone);

  const completedProjects =
    summary.qualification.flipsCompleted ?? continuationPastProjects.length ?? conditionsPastProjects.length ?? 0;
  const yearsExperience = summary.qualification.yearsInvesting ?? 0;
  const ltvPercent = (summary.qualification.ltv ?? 0) * 100;
  const ltcRatio =
    typeof summary.qualification.ltc === "number"
      ? summary.qualification.ltc
      : purchasePrice + rehabBudget > 0
        ? requestedLoanAmount / (purchasePrice + rehabBudget)
        : null;
  const ltcPercent = typeof ltcRatio === "number" && Number.isFinite(ltcRatio) ? ltcRatio * 100 : null;
  const daysToTargetClosing = calculateDaysUntilDate(propertyRequest.targetClosingDate);
  const ltvAfterRepairs = arv > 0 ? (requestedLoanAmount / arv) * 100 : ltvPercent;
  const desktopAppraisalValue = typeof conditionsDesktopAppraisalValue === "number" ? conditionsDesktopAppraisalValue : null;
  const borrowerArv = arv || 0;
  const borrowerArvValue = borrowerArv > 0 ? borrowerArv : null;
  // LTV (Desktop) uses only the desktop appraisal value; leave blank if not provided.
  const desktopValue = desktopAppraisalValue ?? null;
  const ltvDesktop = desktopValue && desktopValue > 0 ? (requestedLoanAmount / desktopValue) * 100 : null;
  const evaluatorArvValue = evaluatorArv ?? null;
  const ltvEvaluator = evaluatorArvValue && evaluatorArvValue > 0 ? (requestedLoanAmount / evaluatorArvValue) * 100 : null;
  const ltvBorrower = borrowerArvValue ? (requestedLoanAmount / borrowerArvValue) * 100 : null;
  const ltvEvaluatorOrBorrower = ltvEvaluator ?? ltvBorrower ?? ltvPercent;
  const evaluatorRiskLevel =
    summary.riskCounts.highRisk > 0 ? "High" : summary.riskCounts.issues > 0 ? "Moderate" : "Low";

  const photoUrls = extractPhotoUrls(summary);
  const purchaseContractDocument = summary.linksAndDocuments.documents.find((doc) =>
    `${doc.label} ${doc.name}`.toLowerCase().includes("purchase contract")
  );
  const scopeOfWorkDocument = summary.linksAndDocuments.documents.find((doc) =>
    `${doc.label} ${doc.name}`.toLowerCase().includes("scope of work")
  );
  const compDocument = summary.linksAndDocuments.documents.find((doc) =>
    `${doc.label} ${doc.name}`.toLowerCase().match(/\b(cma|comp|comparables?)\b/)
  );
  const titleFormSource = titleAgentFormOverride || titleAgentForm || null;
  const titleAgentDisplay = titleFormSource
    ? {
        sellerType: titleFormSource.sellerType === "LLC" ? ("LLC" as const) : ("INDIVIDUAL" as const),
        sellerName: readString(titleFormSource.sellerName),
        sellerLlcName: readString(titleFormSource.sellerLlcName),
        sellerMembers: Array.isArray(titleFormSource.sellerMembers)
          ? titleFormSource.sellerMembers.map((m) => readString(m)).filter(Boolean)
          : [],
        hasAssignor: Boolean(titleFormSource.hasAssignor),
        assignorType: titleFormSource.assignorType === "LLC" ? ("LLC" as const) : ("INDIVIDUAL" as const),
        assignorName: readString(titleFormSource.assignorName),
        assignorLlcName: readString(titleFormSource.assignorLlcName),
        assignorMembers: Array.isArray(titleFormSource.assignorMembers)
          ? titleFormSource.assignorMembers.map((m) => readString(m)).filter(Boolean)
          : [],
        assignmentFees: readString(titleFormSource.assignmentFees),
        purchaseAgreements: Array.isArray(titleFormSource.purchaseAgreements)
          ? titleFormSource.purchaseAgreements.map((doc, index) => ({
              name: doc.name || `purchase-agreement-${index + 1}.pdf`,
              url: doc.dataUrl || null,
            }))
          : [],
        assignmentAgreements: Array.isArray(titleFormSource.assignmentAgreements)
          ? titleFormSource.assignmentAgreements.map((doc, index) => ({
              name: doc.name || `assignment-agreement-${index + 1}.pdf`,
              url: doc.dataUrl || null,
            }))
          : [],
        updatedAt: formatDisplayDateFromTimestamp(titleFormSource.updatedAt),
      }
    : undefined;

  const currentLenderLoans: LoanApplication["currentLenderLoans"] = continuationActiveLoans.map((loan, index) => {
    const loanId = readString(loan.loanId);
    const status = readString(loan.status) || "In progress";
    const payoffDate = readString(loan.payoffDate);
    const expectedCompletionDate = readString(loan.expectedCompletionDate);
    const note = readString(loan.notes);

    return {
      propertyAddress: loanId ? `Loan ${loanId}` : `Existing Loan ${index + 1}`,
      loanAmount: 0,
      status,
      monthsRemaining: calculateMonthsRemaining(payoffDate || expectedCompletionDate),
      monthlyPayment: toNumber(loan.monthlyPayment) ?? 0,
      lastPaymentDate: "Not provided",
      nextPaymentDate: payoffDate ? formatDisplayDate(payoffDate) : "Not provided",
      targetCompletionDate: expectedCompletionDate ? formatDisplayDate(expectedCompletionDate) : undefined,
      estimatedClosingDate: payoffDate ? formatDisplayDate(payoffDate) : undefined,
      notes: note
        ? [
            {
              date: formatDisplayDateFromTimestamp(summary.lastEventAt),
              author: "Borrower Submission",
              content: note,
            },
          ]
        : [],
    };
  });

  const riskChecks = {
    bankruptcy: buildRiskCheck(summary, ["bankruptcy"], "No bankruptcy records found."),
    foreclosure: buildRiskCheck(summary, ["foreclosure"], "No foreclosure records found."),
    fraud: buildRiskCheck(summary, ["fraud"], "No fraud screening alerts."),
    internalNegativeList: buildRiskCheck(summary, ["internal", "negative list"], "No internal negative-list flags."),
  };

  const computedStrengths: string[] = [];
  const computedConcerns: string[] = [];
  const maxLtvPercent = settings.maxLtv * 100;
  const maxLtcPercent = settings.maxLtc * 100;

  if (mergedCreditScore > 0) {
    if (mergedCreditScore >= settings.minCreditScore) {
      computedStrengths.push(
        `Credit score ${Math.round(mergedCreditScore)} meets minimum threshold (${Math.round(settings.minCreditScore)})`
      );
    } else {
      computedConcerns.push(
        `Credit score ${Math.round(mergedCreditScore)} is below minimum threshold (${Math.round(settings.minCreditScore)})`
      );
    }
  }

  if (typeof summary.qualification.ltv === "number") {
    if (summary.qualification.ltv <= settings.maxLtv) {
      computedStrengths.push(`LTV ${ltvPercent.toFixed(1)}% is within policy limit (${maxLtvPercent.toFixed(1)}%)`);
    } else {
      computedConcerns.push(`LTV ${ltvPercent.toFixed(1)}% exceeds policy limit (${maxLtvPercent.toFixed(1)}%)`);
    }
  }

  if (typeof ltcPercent === "number") {
    if (ltcRatio !== null && ltcRatio <= settings.maxLtc) {
      computedStrengths.push(`LTC ${ltcPercent.toFixed(1)}% is within policy limit (${maxLtcPercent.toFixed(1)}%)`);
    } else {
      computedConcerns.push(`LTC ${ltcPercent.toFixed(1)}% exceeds policy limit (${maxLtcPercent.toFixed(1)}%)`);
    }
  }

  if (requiredLiquidity > 0) {
    if (liquidityRatio >= settings.acceptableLiquidityRatio) {
      computedStrengths.push(
        `Liquidity ratio ${liquidityRatio.toFixed(2)}x meets policy`
      );
    } else {
      const liquidityGap = Math.max(requiredLiquidity - availableLiquidity, 0);
      computedConcerns.push(
        `Liquidity coverage is ${liquidityRatio.toFixed(2)}x; short ${formatCurrency(liquidityGap)} versus required reserves`
      );
    }
  }

  if (summary.riskCounts.highRisk === 0) {
    computedStrengths.push("No high-risk record search flags");
  } else {
    computedConcerns.push(`${summary.riskCounts.highRisk} high-risk record search flag(s) require review`);
  }

  if (summary.riskCounts.pending > 0) {
    computedConcerns.push(`${summary.riskCounts.pending} pending record search item(s)`);
  }

  if (typeof daysToTargetClosing === "number") {
    if (daysToTargetClosing < 0) {
      computedConcerns.push(`Target closing date passed ${Math.abs(daysToTargetClosing)} day(s) ago`);
    } else if (daysToTargetClosing <= settings.shortClosingTimelineDays) {
      computedConcerns.push(`Short closing timeline (${daysToTargetClosing} day(s) to target close)`);
    } else {
      computedStrengths.push(`Closing timeline has ${daysToTargetClosing} day(s) to target close`);
    }
  }

  const aiKeyStrengths = Array.from(new Set(computedStrengths)).slice(0, 5);
  const aiMinorConcerns = Array.from(new Set(computedConcerns)).slice(0, 5);
  const fallbackKeyStrengths = summary.evaluatorAssessment.reasons.length
    ? summary.evaluatorAssessment.reasons
    : summary.quickDecision.reasons;
  const creditScoreValue = mergedCreditScore > 0 ? mergedCreditScore : null;
  const creditBelowDeclineThreshold =
    creditScoreValue !== null && creditScoreValue < settings.declineCreditScore;
  const ltvRatio = typeof summary.qualification.ltv === "number" ? summary.qualification.ltv : null;
  const ltvAboveDeclineThreshold = ltvRatio !== null && ltvRatio > settings.declineLtv;
  const highRiskCount = summary.riskCounts.highRisk;
  const criticalSignals = [
    creditBelowDeclineThreshold,
    ltvAboveDeclineThreshold,
    highRiskCount > 0,
  ].filter(Boolean).length;
  const warningSignals = aiMinorConcerns.length;
  const positiveSignals = aiKeyStrengths.length;
  const hasAnyComputedSignal =
    creditScoreValue !== null ||
    ltvRatio !== null ||
    typeof ltcPercent === "number" ||
    requiredLiquidity > 0 ||
    summary.riskCounts.issues > 0 ||
    summary.riskCounts.pending > 0 ||
    daysToTargetClosing !== null;

  let computedDecision: "Approve" | "Conditional" | "Decline";
  if (criticalSignals > 0) {
    computedDecision = "Decline";
  } else if (warningSignals > 0 || summary.riskCounts.issues > 0) {
    computedDecision = "Conditional";
  } else {
    computedDecision = "Approve";
  }

  let computedConfidence = 70 + positiveSignals * 6 - warningSignals * 5 - criticalSignals * 14;
  if (computedDecision === "Approve") computedConfidence = Math.max(computedConfidence, 78);
  if (computedDecision === "Decline") computedConfidence = Math.min(computedConfidence, 60);
  computedConfidence = Math.max(35, Math.min(98, Math.round(computedConfidence)));

  const analysisSegments: string[] = [];
  if (creditScoreValue !== null) {
    analysisSegments.push(
      `Credit score ${Math.round(creditScoreValue)} (minimum ${Math.round(settings.minCreditScore)}, decline threshold ${Math.round(settings.declineCreditScore)}).`
    );
  }
  if (typeof ltvPercent === "number") {
    analysisSegments.push(
      `LTV ${ltvPercent.toFixed(1)}% (policy max ${(settings.maxLtv * 100).toFixed(1)}%, decline threshold ${(settings.declineLtv * 100).toFixed(1)}%).`
    );
  }
  if (typeof ltcPercent === "number") {
    analysisSegments.push(`LTC ${ltcPercent.toFixed(1)}% (policy max ${(settings.maxLtc * 100).toFixed(1)}%).`);
  }
  if (requiredLiquidity > 0) {
    analysisSegments.push(
      `Liquidity ${formatCurrency(availableLiquidity)} vs required ${formatCurrency(requiredLiquidity)} (${liquidityRatio.toFixed(2)}x coverage).`
    );
  }
  analysisSegments.push(
    `Record search flags: ${summary.riskCounts.highRisk} high-risk, ${summary.riskCounts.issues} issue(s), ${summary.riskCounts.pending} pending.`
  );
  if (typeof daysToTargetClosing === "number") {
    if (daysToTargetClosing >= 0) {
      analysisSegments.push(
        `Target closing is in ${daysToTargetClosing} day(s) (short timeline threshold: ${settings.shortClosingTimelineDays} days).`
      );
    } else {
      analysisSegments.push(`Target closing is ${Math.abs(daysToTargetClosing)} day(s) past due.`);
    }
  }

  const computedReasoning = `Recommendation: ${computedDecision}. ${analysisSegments.join(" ")}`.trim();
  const aiDecision = hasAnyComputedSignal ? computedDecision : summary.quickDecision.recommendation;
  const aiConfidence = hasAnyComputedSignal ? computedConfidence : summary.evaluatorAssessment.confidence;
  const aiReasoning =
    hasAnyComputedSignal && analysisSegments.length > 0
      ? computedReasoning
      : summary.combinedNarrative || summary.evaluatorAssessment.notes.join(" ");

  return {
    id: summary.loanId,
    status: summary.executive.status || summary.workflowStatus,
    submittedDate: formatDisplayDateFromTimestamp(summary.createdAt),
    borrower: {
      name: summary.executive.borrowerName || summary.borrowerPortal.newLoanRequest.borrower.fullName || "Unknown Borrower",
      email: summary.executive.borrowerEmail || summary.borrowerPortal.newLoanRequest.borrower.email || "Not provided",
      phone: profilePhone || "Not provided",
      yearsExperience,
      completedProjects,
      llcForLoan,
      llcDocumentsPreviewUrl,
    },
    referralSource: {
      name: referralName || "Not provided",
      contact: referralName || "Not provided",
      phone: referralPhone || "Not provided",
      relationship: referralEmail ? `Email: ${referralEmail}` : "Not provided",
    },
    property: {
      address: summary.executive.propertyAddress || summary.borrowerPortal.newLoanRequest.property.address || "Not provided",
      type: propertyRequest.type || summary.executive.purpose || "Not provided",
      purchasePrice,
      loanAmount: requestedLoanAmount,
      rehabBudget,
      arv,
      assessorValue,
      currentOwner: valuationCurrentOwner || "Not provided",
      lastSaleDate: valuationLastSaleDate || null,
      lastSalePrice: valuationLastSalePrice,
      valuationBenchmarks: {
        assessorValue,
        zillowValue,
        realtorComValue,
        narprValue,
        propelioMedianValue,
        propelioHighValue,
        propelioLowValue,
        economicValue,
        rentometerEstimate,
        zillowRentEstimate,
      },
      targetClosing: formatDisplayDate(propertyRequest.targetClosingDate),
      closingCompany: readString(continuationLatest?.closingCompany) || "Not provided",
      photos: photoUrls,
      purchaseContract: purchaseContractDocument
        ? {
            name: purchaseContractDocument.name || "Purchase Contract",
            url: purchaseContractDocument.url || null,
          }
        : null,
      scopeOfWork: scopeOfWorkDocument
        ? {
            name: scopeOfWorkDocument.name || "Scope of Work",
            url: scopeOfWorkDocument.url || null,
          }
        : null,
    } as any,
    financial: {
      creditScore: mergedCreditScore,
      ltv: ltvEvaluatorOrBorrower ?? ltvPercent,
      ltvDesktop,
      ltvEvaluator: ltvEvaluator ?? ltvEvaluatorOrBorrower ?? ltvPercent,
      ltvBorrower,
      closingCompany: readString(continuationLatest?.closingCompany) || "Not provided",
    },
    liquidity: {
      ratio: liquidityRatio,
      availableAssets: {
        checking: assetChecking,
        savings: assetSavings,
        investments: assetInvestments,
        total: availableLiquidity,
      },
      assetTypeLabels,
      proofDocuments: proofOfLiquidityDocuments,
      sixMonthCosts: {
        monthlyInterest,
        existingLoansMonthlyInterest,
        closingCosts: closingCostEstimate,
        serviceFees: serviceFee,
        documentPreparationFee,
        otherMortgageExposure,
        originationFee,
        prepaidInterest,
        total: requiredLiquidity,
      },
    },
    conditions: {
      submitted: Boolean(summary.borrowerPortal.conditions?.submitted),
      submittedAt: conditionsSubmittedAt,
      creditScore: conditionsCreditScore,
      proofOfLiquidityAmount: conditionsLiquidityAmount,
      otherMortgageLoansCount: conditionsOtherMortgageLoansCount,
      otherMortgageTotalAmount: conditionsOtherMortgageTotalAmount,
      desktopAppraisalValue: conditionsDesktopAppraisalValue,
      desktopAppraisalDocs: desktopAppraisalDocuments,
      referral: {
        name: readString(conditionsReferral?.name),
        email: readString(conditionsReferral?.email),
        phone: readString(conditionsReferral?.phone),
      },
      llcDocuments: conditionLlcDocuments,
      pastProjects: conditionPastProjectsDetailed,
      allUploadedDocuments,
    },
    titleAgentForm: titleAgentDisplay,
    riskFlags: riskChecks,
    aiRecommendation: {
      decision: aiDecision,
      confidence: aiConfidence,
      reasoning: aiReasoning,
      keyStrengths: aiKeyStrengths.length > 0 ? aiKeyStrengths : fallbackKeyStrengths,
      minorConcerns: aiMinorConcerns,
    },
    evaluatorAssessment: {
      evaluatorName: hasEvaluatorInput ? "Evaluator" : "Underwriting Engine",
      evaluatorTitle: hasEvaluatorInput ? "Property Evaluator" : summary.evaluatorAssessment.title || "Automated Assessment",
      evaluationDate: formatDisplayDateFromTimestamp(summary.lastEventAt),
      recommendation: hasEvaluatorInput
        ? evaluatorRecommendation || summary.evaluatorAssessment.recommendation
        : summary.evaluatorAssessment.recommendation,
      confidence: hasEvaluatorInput
        ? evaluatorConfidence || `${summary.evaluatorAssessment.confidence}%`
        : `${summary.evaluatorAssessment.confidence}%`,
      asIsValue: (evaluatorAsIsValue ?? null) || purchasePrice || requestedLoanAmount,
      arv: (evaluatorArv ?? null) || arv || requestedLoanAmount,
      ltv: evaluatorCurrentLtv ?? ltvPercent,
      ltvAfterRepairs: evaluatorLtvAfterRepairs ?? ltvAfterRepairs,
      riskLevel: evaluatorRiskLevelInput || evaluatorRiskLevel || summary.evaluatorAssessment.recommendation || "Moderate",
      feedback: hasEvaluatorInput
        ? evaluatorProfessionalAssessment || summary.evaluatorAssessment.notes.join(" ") || summary.combinedNarrative
        : summary.evaluatorAssessment.notes.join(" ") || summary.combinedNarrative,
      keyFindings:
        hasEvaluatorInput && evaluatorKeyFindings.length > 0
          ? evaluatorKeyFindings
          : summary.evaluatorAssessment.reasons,
      concerns: summary.quickDecision.conditions,
    },
    cmaReport: {
      propertyAddress: summary.executive.propertyAddress || "Not provided",
      neighborhood: "Not provided",
      reportDate: formatDisplayDateFromTimestamp(summary.lastEventAt),
      preparedBy: hasEvaluatorInput ? "Evaluator" : summary.evaluatorAssessment.title || "Underwriting",
      reportId: `${summary.loanId}-CMA`,
      fileName: compDocument?.name || "Not uploaded",
      preparedDate: formatDisplayDateFromTimestamp(summary.lastEventAt),
      fileSize: "Not provided",
      numberOfComps: summary.linksAndDocuments.documents.filter((doc) =>
        `${doc.label} ${doc.name}`.toLowerCase().match(/\b(comp|comparables?)\b/)
      ).length,
      thumbnail: photoUrls[0] || DEFAULT_PROPERTY_PHOTO,
      summary: {
        avgSalePrice: (evaluatorCmaAvgSalePrice ?? null) || arv || 0,
        avgPricePerSqFt: evaluatorCmaPricePerSqFt ?? 0,
        daysOnMarket: evaluatorCmaDaysOnMarket ?? 0,
        subjectPropertySqFt: evaluatorCmaSubjectSqFt ?? 0,
      },
      comparables: [],
    },
    currentLenderLoans,
  };
}

export function UnderwritingEnhanced() {
  const [searchParams] = useSearchParams();
  const requestedLoanId = searchParams.get("loanId")?.trim() || "";
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [isPhotosCollapsed, setIsPhotosCollapsed] = useState(true);
  const [riskCollapsed, setRiskCollapsed] = useState(true);
  const [isEvaluatorCollapsed, setIsEvaluatorCollapsed] = useState(true);
  const [isLiquidityCollapsed, setIsLiquidityCollapsed] = useState(true);
  const [showCmaReport, setShowCmaReport] = useState(false);
  const [summaryDecisionLoading, setSummaryDecisionLoading] = useState<"approve" | "decline" | "more_info" | null>(null);
  const [expandedLoanNotes, setExpandedLoanNotes] = useState<Record<number, boolean>>({});
  const [showSummarySheet, setShowSummarySheet] = useState(false);
  const [isConditionsExpanded, setIsConditionsExpanded] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [riskSubTab, setRiskSubTab] = useState<"bankruptcy" | "foreclosure" | "internalNegativeList">("bankruptcy");
  const [titleAgentTab, setTitleAgentTab] = useState<"seller" | "assignor" | "documents">("seller");
  const [loanApplicationData, setLoanApplicationData] = useState<LoanApplication | null>(sampleLoanApplication);
  const [underwritingSettings, setUnderwritingSettings] = useState<UnderwritingSettings>(DEFAULT_UNDERWRITING_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navItems: NavItem[] = [
    { id: "overview", label: "Overview" },
    { id: "risk-compliance", label: "Risk & Compliance" },
    { id: "evaluator", label: "Evaluator Assessment" },
    { id: "ai-recommendation", label: "AI Recommendation" },
    { id: "liquidity", label: "Liquidity Analysis" },
    { id: "conditions", label: "Conditions" },
    { id: "photos", label: "Property Photos" },
    { id: "existing-loans", label: "Existing Loans" },
  ];

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const settingsPromise = fetchUnderwritingSettings().catch(() => null);
        let summary: UnderwritingCaseSummary | null = null;
        let evaluatorInput: LenderEvaluatorInputSnapshot | null = null;
        let titleAgentForm: TitleAgentFormData | null = null;
        if (requestedLoanId) {
          summary = await fetchUnderwritingSummary(requestedLoanId);
          evaluatorInput = await fetchLenderEvaluatorInput(requestedLoanId).catch(() => null);
          titleAgentForm = await fetchTitleAgentForm(requestedLoanId).catch(() => null);
        } else {
          const summaries = await fetchUnderwritingSummaries();
          const next =
            summaries.find((item) => PENDING_UNDERWRITING_STATUSES.has(item.workflowStatus)) || summaries[0] || null;
          if (next) {
            summary = await fetchUnderwritingSummary(next.loanId).catch(() => next);
            evaluatorInput = await fetchLenderEvaluatorInput(next.loanId).catch(() => null);
            titleAgentForm = await fetchTitleAgentForm(next.loanId).catch(() => null);
          }
        }
        const settings = (await settingsPromise) || DEFAULT_UNDERWRITING_SETTINGS;

        if (!mounted) return;
        setUnderwritingSettings(settings);
        setLoanApplicationData(
          summary ? mapUnderwritingSummaryToLoanApplication(summary, settings, evaluatorInput, titleAgentForm) : null
        );
        setError(null);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load underwriting data.");
        setLoanApplicationData(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    setIsLoading(true);
    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 10000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [requestedLoanId]);

  useEffect(() => {
    setSelectedPhoto(0);
    setExpandedLoanNotes({});
    setShowSummarySheet(false);
    setIsPhotoViewerOpen(false);
    setIsConditionsExpanded(false);
  }, [loanApplicationData?.id]);

  const photoCount = loanApplicationData?.property.photos.length ?? 0;

  const showPreviousPhoto = () => {
    if (photoCount <= 1) return;
    setSelectedPhoto((previous) => (previous - 1 + photoCount) % photoCount);
  };

  const showNextPhoto = () => {
    if (photoCount <= 1) return;
    setSelectedPhoto((previous) => (previous + 1) % photoCount);
  };

  useEffect(() => {
    if (!isPhotoViewerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsPhotoViewerOpen(false);
      if (event.key === "ArrowLeft") showPreviousPhoto();
      if (event.key === "ArrowRight") showNextPhoto();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPhotoViewerOpen, photoCount]);

  if (isLoading) {
    return (
      <div className="-m-8 p-8 bg-[#f9fafb]">
        <div className="max-w-[1400px] mx-auto">
          <section className="rounded-lg border border-[#e5e7eb] bg-white p-6 shadow-sm text-[#6b7280]">
            Loading underwriting data...
          </section>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="-m-8 p-8 bg-[#f9fafb]">
        <div className="max-w-[1400px] mx-auto">
          <section className="rounded-lg border border-[#ef4444]/40 bg-[#fee2e2] p-6 text-[#991b1b]">
            {error}
          </section>
        </div>
      </div>
    );
  }

  if (!loanApplicationData) {
    return (
      <div className="-m-8 p-8 bg-[#f9fafb]">
        <div className="max-w-[1400px] mx-auto">
          <section className="rounded-lg border border-[#e5e7eb] bg-white p-6 shadow-sm text-[#6b7280]">
            {requestedLoanId
              ? `No underwriting summary found for loan ${requestedLoanId}.`
              : "No underwriting cases are currently available."}
          </section>
        </div>
      </div>
    );
  }

  const loanApplication = loanApplicationData;
  const titleAgent = loanApplication.titleAgentForm;

  const liquidityStatus = calculateLiquidityStatus(loanApplication.liquidity.ratio, {
    acceptableLiquidityRatio: underwritingSettings.acceptableLiquidityRatio,
    excellentLiquidityRatio: underwritingSettings.excellentLiquidityRatio,
  });
  const LiquidityStatusIcon = liquidityStatus.icon;
  const derivedRiskFactors = buildRiskFactors(loanApplication);

  const toggleLoanNotes = (index: number) => {
    setExpandedLoanNotes((previous) => ({ ...previous, [index]: !previous[index] }));
  };

  const projectedMonthlyInterest = loanApplication.liquidity.sixMonthCosts.monthlyInterest;
  const projectedExistingLoansMonthlyInterest = loanApplication.liquidity.sixMonthCosts.existingLoansMonthlyInterest;
  const projectedDocumentPreparationFee = loanApplication.liquidity.sixMonthCosts.documentPreparationFee;
  const projectedOriginationFee = loanApplication.liquidity.sixMonthCosts.originationFee;
  const projectedPrepaidInterest = loanApplication.liquidity.sixMonthCosts.prepaidInterest;
  const comparableLimit = 3;
  const displayedComparables = loanApplication.cmaReport.comparables.slice(0, comparableLimit);
  const hiddenComparableCount = Math.max(loanApplication.cmaReport.comparables.length - displayedComparables.length, 0);
  const handleScrollTo = (id: string) => {
    const targetSection = id === "title-agent-report" ? "risk-compliance" : id;
    setActiveSectionId(targetSection);
    const targetId = id === "title-agent-report" ? "title-agent-report" : id;
    const element = document.getElementById(targetId);
    if (!element) return;
    const offset = 12;
    const top = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const handleSummaryDecision = async (
    decision: "approve" | "more_info" | "decline",
    recipient: "borrower" | "loan_officer" | "evaluator" = "borrower"
  ) => {
    if (!loanApplication || summaryDecisionLoading) return;
    const mapping = decision === "approve" ? "PRE_APPROVE" : decision === "decline" ? "DECLINE" : "REQUEST_INFO";
    setSummaryDecisionLoading(decision);
    try {
      if (decision === "more_info") {
        const message =
          window.prompt(
            "Add a message to send with the request",
            "Please provide the missing documents so we can complete underwriting."
          ) || "";
        const trimmed = message.trim();
        if (!trimmed) {
          window.alert("A comment/message is required for Request More Info.");
          return;
        }
        await updatePreApprovalDecision(loanApplication.id, mapping, trimmed);
        if (recipient === "borrower") {
          await sendLenderPipelineBorrowerMessage(
            loanApplication.id,
            trimmed,
            "Additional information requested"
          );
        } else {
          const label = recipient === "loan_officer" ? "Loan Officer" : "Evaluator";
          await addLenderPipelineComment(loanApplication.id, `[To ${label}] ${trimmed}`);
        }
      } else {
        await updatePreApprovalDecision(loanApplication.id, mapping);
      }

      setLoanApplicationData((prev) =>
        prev
          ? {
              ...prev,
              status:
                decision === "approve"
                  ? "Approved"
                  : decision === "decline"
                    ? "Declined"
                    : "Additional Info Requested",
            }
          : prev
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to update decision.");
    } finally {
      setSummaryDecisionLoading(null);
    }
  };

  const clearFocus = () => setActiveSectionId(null);
  const sectionVisible = (id: string) => {
    if (!activeSectionId) return true;
    if (activeSectionId === id) return true;
    if (id === "risk-compliance" && activeSectionId === "title-agent-report") return true;
    if (id === "title-agent-report" && activeSectionId === "risk-compliance") return true;
    return false;
  };

  return (
    <div className="-m-8 p-8 bg-[#f9fafb]">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <header className="bg-[#0d3b66] text-white shadow-lg rounded-lg relative z-40">
          <div className="px-6 py-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Underwriting &amp; Decisioning</h1>
              <p className="text-white/80 text-sm mt-1">Comprehensive loan application review</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setShowSummarySheet(true)}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-white/20"
              >
                <Eye className="w-4 h-4" />
                View Summary Sheet
              </button>
            </div>
          </div>
          <div className="px-6 pb-4">
            <div className="flex flex-wrap items-center gap-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleScrollTo(item.id)}
                className="text-[11px] md:text-xs font-semibold text-white px-2.5 md:px-3 py-1.5 rounded-full border border-white/20 bg-gradient-to-br from-white/15 to-white/5 hover:from-white/25 hover:to-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 transition transform hover:-translate-y-0.5"
              >
                {item.label}
              </button>
            ))}
            {activeSectionId ? (
              <button
                type="button"
                onClick={clearFocus}
                className="text-[11px] md:text-xs font-semibold text-white px-2.5 md:px-3 py-1.5 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition"
              >
                Show all
              </button>
            ) : null}
            </div>
          </div>
        </header>

        {activeSectionId ? (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20"
            aria-hidden="true"
            onClick={clearFocus}
          />
        ) : null}

        {sectionVisible("ai-recommendation") ? (
          <section
            id="ai-recommendation"
            className="rounded-lg border-2 border-[#0d3b66] bg-gradient-to-r from-[#0d3b66]/10 via-[#0ea5a5]/5 to-[#0d3b66]/10 p-6 shadow-lg relative z-30"
          >
            <div className="flex items-center gap-3 mb-6">
              <HeaderChip>
                <Brain className="w-6 h-6" />
              </HeaderChip>
              <div>
                <h3 className="text-lg font-semibold">AI-Powered Recommendation</h3>
                <p className="text-sm text-[#6b7280]">Intelligent decision support</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="rounded-lg border-2 border-[#10b981] bg-gradient-to-r from-[#10b981]/10 to-[#10b981]/5 p-5">
                <div className="w-10 h-10 rounded-full bg-[#10b981]/20 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-[#10b981]" />
                </div>
                <p className="text-sm font-semibold text-[#6b7280]">AI Decision</p>
                <p className="text-2xl font-bold text-[#10b981]">{loanApplication.aiRecommendation.decision}</p>
              </div>

              <div className="rounded-lg border border-[#0d3b66]/30 bg-white p-5">
                <p className="text-sm font-semibold text-[#6b7280] mb-2">Confidence Score</p>
                <p className="text-4xl font-bold text-[#0d3b66]">{loanApplication.aiRecommendation.confidence}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                  <div
                    className="bg-[#0d3b66] h-2 rounded-full"
                    style={{ width: `${loanApplication.aiRecommendation.confidence}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleSummaryDecision("approve")}
                  disabled={summaryDecisionLoading === "approve"}
                  className="w-full bg-[#10b981] text-white py-3 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {summaryDecisionLoading === "approve" ? "Approving..." : "Approve Loan"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSummaryDecision("more_info")}
                  disabled={summaryDecisionLoading === "more_info"}
                  className="w-full bg-[#f59e0b] text-white py-3 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Clock className="w-5 h-5" />
                  {summaryDecisionLoading === "more_info" ? "Requesting..." : "Request More Info"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSummaryDecision("decline")}
                  disabled={summaryDecisionLoading === "decline"}
                  className="w-full border-2 border-[#ef4444] text-[#ef4444] py-3 rounded-lg hover:bg-[#ef4444] hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  {summaryDecisionLoading === "decline" ? "Declining..." : "Decline Application"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-[#10b981]" />
                  <h4 className="font-semibold">Key Strengths</h4>
                </div>
                <ul className="space-y-2">
                  {loanApplication.aiRecommendation.keyStrengths.map((item) => (
                    <li key={item} className="text-sm flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#10b981] mt-1.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {loanApplication.aiRecommendation.minorConcerns.length > 0 ? (
                <div className="rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
                    <h4 className="font-semibold">Minor Concerns</h4>
                  </div>
                  <ul className="space-y-2">
                    {loanApplication.aiRecommendation.minorConcerns.map((item) => (
                      <li key={item} className="text-sm flex items-start gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#f59e0b] mt-1.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 p-4 flex items-center justify-center">
                  <p className="text-sm font-semibold text-[#10b981]">No minor concerns flagged</p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {sectionVisible("overview") ? (
          <section id="overview" className="bg-white rounded-lg p-6 shadow-sm border border-[#e5e7eb] relative z-30">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="w-5 h-5 text-[#0d3b66]" />
              <h2 className="text-lg font-semibold">Underwriting Overview</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-white shadow-sm p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white bg-[#0d3b66] inline-flex px-2 py-1 rounded shadow-sm">
                  Borrower & Referral
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <OverviewItem
                    icon={<User className="w-5 h-5 text-[#0d3b66]" />}
                    label="Borrower"
                    value={
                      loanApplication.borrower.llcForLoan && loanApplication.borrower.llcForLoan !== "Not provided"
                        ? `${loanApplication.borrower.name} • ${loanApplication.borrower.llcForLoan}`
                        : loanApplication.borrower.name
                    }
                    subtitle={`${loanApplication.borrower.yearsExperience} yrs exp • ${loanApplication.borrower.completedProjects} projects`}
                    action={
                      loanApplication.borrower.llcDocumentsPreviewUrl
                        ? { href: loanApplication.borrower.llcDocumentsPreviewUrl, label: "Preview LLC Docs" }
                        : undefined
                    }
                  />
                  <OverviewItem
                    icon={<Users className="w-5 h-5 text-[#0ea5a5]" />}
                    label="Referral Source"
                    value={loanApplication.referralSource.name}
                    subtitle={
                      [
                        loanApplication.referralSource.relationship !== "Not provided"
                          ? loanApplication.referralSource.relationship
                          : null,
                        loanApplication.referralSource.phone !== "Not provided"
                          ? `Phone: ${loanApplication.referralSource.phone}`
                          : null,
                      ]
                        .filter((value): value is string => Boolean(value))
                        .join(" • ") || "Not provided"
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-white shadow-sm p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white bg-[#0ea5a5] inline-flex px-2 py-1 rounded shadow-sm">
                  Property Snapshot
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <OverviewItem
                    icon={<Home className="w-5 h-5 text-[#0ea5a5]" />}
                    label="Subject Property"
                    value={loanApplication.property.address}
                    valueClassName="text-[#0ea5a5]"
                    rightContent={
                      <div className="flex flex-col items-end gap-1 text-right">
                        <StatusBadge variant={getStatusBadgeVariant(loanApplication.status)}>
                          {loanApplication.status}
                        </StatusBadge>
                        <div className="leading-tight">
                          <p className="text-xs text-[#6b7280]">Application ID</p>
                          <p className="font-mono text-sm font-semibold text-[#0d3b66]">{loanApplication.id}</p>
                        </div>
                      </div>
                    }
                  />
                  <OverviewItem
                    icon={<Calendar className="w-5 h-5 text-[#0ea5a5]" />}
                    label="Target Closing"
                    value={loanApplication.property.targetClosing}
                    valueClassName="text-[#0ea5a5]"
                  />
                  <OverviewItem
                    icon={<Building className="w-5 h-5 text-[#0ea5a5]" />}
                    label="Closing Company"
                    value={loanApplication.property.closingCompany}
                    valueClassName="text-[#0ea5a5]"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-white shadow-sm p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white bg-[#10b981] inline-flex px-2 py-1 rounded shadow-sm">
                  Loan & Costs
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <OverviewItem
                    icon={<DollarSign className="w-5 h-5 text-[#0d3b66]" />}
                    label="Loan Amount"
                    value={formatCurrency(loanApplication.property.loanAmount)}
                  />
                  <OverviewItem
                    icon={<Home className="w-5 h-5 text-[#6b7280]" />}
                    label="Purchase Price"
                    value={formatCurrency(loanApplication.property.purchasePrice)}
                    valueClassName="text-foreground"
                    action={
                      loanApplication.property.purchaseContract?.url
                        ? { href: loanApplication.property.purchaseContract.url, label: "Preview Contract" }
                        : undefined
                    }
                  />
                  <OverviewItem
                    icon={<Hammer className="w-5 h-5 text-[#f59e0b]" />}
                    label="Rehab Budget"
                    value={formatCurrency(loanApplication.property.rehabBudget)}
                    valueClassName="text-[#f59e0b]"
                    action={
                      loanApplication.property.scopeOfWork?.url
                        ? { href: loanApplication.property.scopeOfWork.url, label: "Preview Scope" }
                        : undefined
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-white shadow-sm p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white bg-[#2563eb] inline-flex px-2 py-1 rounded shadow-sm">
                  Leverage & Liquidity
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <OverviewItem
                    icon={<TrendingUp className="w-5 h-5 text-[#10b981]" />}
                    label="ARV"
                    value={formatCurrency(loanApplication.property.arv)}
                    valueClassName="text-[#10b981]"
                  />
                  <OverviewItem
                    icon={<DollarSign className="w-5 h-5 text-[#0d3b66]" />}
                    label="Liquidity Ratio"
                    value={`${loanApplication.liquidity.ratio.toFixed(2)}x`}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <OverviewItem
                    icon={<TrendingDown className="w-5 h-5 text-[#0d3b66]" />}
                    label="LTV (Desktop)"
                    value={
                      loanApplication.financial.ltvDesktop !== undefined && loanApplication.financial.ltvDesktop !== null
                        ? `${loanApplication.financial.ltvDesktop.toFixed(1)}%`
                        : ""
                    }
                  />
                  <OverviewItem
                    icon={<TrendingDown className="w-5 h-5 text-[#0d3b66]" />}
                    label="LTV (Evaluator ARV)"
                    value={
                      loanApplication.financial.ltvEvaluator !== undefined && loanApplication.financial.ltvEvaluator !== null
                        ? `${loanApplication.financial.ltvEvaluator.toFixed(1)}%`
                        : ""
                    }
                  />
                  <OverviewItem
                    icon={<TrendingDown className="w-5 h-5 text-[#0d3b66]" />}
                    label="LTV (Borrower ARV)"
                    value={
                      loanApplication.financial.ltvBorrower !== undefined && loanApplication.financial.ltvBorrower !== null
                        ? `${loanApplication.financial.ltvBorrower.toFixed(1)}%`
                        : ""
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-white shadow-sm p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white bg-[#9333ea] inline-flex px-2 py-1 rounded shadow-sm">
                  Valuation Benchmarks
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <OverviewItem
                    icon={<DollarSign className="w-5 h-5 text-[#0d3b66]" />}
                    label="Assessor Value"
                    value={formatOptionalCurrency(loanApplication.property.valuationBenchmarks.assessorValue)}
                  />
                  <OverviewItem
                    icon={<DollarSign className="w-5 h-5 text-[#0d3b66]" />}
                    label="Zillow Value"
                    value={formatOptionalCurrency(loanApplication.property.valuationBenchmarks.zillowValue)}
                  />
                  <OverviewItem
                    icon={<DollarSign className="w-5 h-5 text-[#0d3b66]" />}
                    label="Realtor.com Value"
                    value={formatOptionalCurrency(loanApplication.property.valuationBenchmarks.realtorComValue)}
                  />
                  <OverviewItem
                    icon={<DollarSign className="w-5 h-5 text-[#0d3b66]" />}
                    label="NARRPR Value"
                    value={formatOptionalCurrency(loanApplication.property.valuationBenchmarks.narprValue)}
                  />
                  <OverviewItem
                    icon={<DollarSign className="w-5 h-5 text-[#0d3b66]" />}
                    label="Economic Value"
                    value={formatOptionalCurrency(loanApplication.property.valuationBenchmarks.economicValue)}
                  />
                </div>
                <div className="grid grid-cols-1">
                  <div className="bg-white rounded-lg p-5 border border-[#e5e7eb] shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#6b7280] mb-2">
                      <DollarSign className="w-5 h-5 text-[#0d3b66]" />
                      Propelio (High / Median / Low)
                    </div>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-[#6b7280]">High: </span>
                        <span className="font-semibold text-[#0d3b66]">
                          {formatOptionalCurrency(loanApplication.property.valuationBenchmarks.propelioHighValue)}
                        </span>
                      </p>
                      <p>
                        <span className="text-[#6b7280]">Median: </span>
                        <span className="font-semibold text-[#0d3b66]">
                          {formatOptionalCurrency(loanApplication.property.valuationBenchmarks.propelioMedianValue)}
                        </span>
                      </p>
                      <p>
                        <span className="text-[#6b7280]">Low: </span>
                        <span className="font-semibold text-[#0d3b66]">
                          {formatOptionalCurrency(loanApplication.property.valuationBenchmarks.propelioLowValue)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-white shadow-sm p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white bg-[#f59e0b] inline-flex px-2 py-1 rounded shadow-sm">
                  Rent Estimates
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <OverviewItem
                    icon={<Home className="w-5 h-5 text-[#0ea5a5]" />}
                    label="Rentometer Estimate"
                    value={formatOptionalCurrency(loanApplication.property.valuationBenchmarks.rentometerEstimate, "/mo")}
                    valueClassName="text-[#0ea5a5]"
                  />
                  <OverviewItem
                    icon={<Home className="w-5 h-5 text-[#0ea5a5]" />}
                    label="Zillow Rent Estimate"
                    value={formatOptionalCurrency(loanApplication.property.valuationBenchmarks.zillowRentEstimate, "/mo")}
                    valueClassName="text-[#0ea5a5]"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-white shadow-sm p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white bg-[#ef4444] inline-flex px-2 py-1 rounded shadow-sm">
                  Ownership History
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <OverviewItem
                    icon={<Building className="w-5 h-5 text-[#0d3b66]" />}
                    label="Current Owner"
                    value={(loanApplication.property as any).currentOwner || "Not provided"}
                  />
                  <OverviewItem
                    icon={<User className="w-5 h-5 text-[#0d3b66]" />}
                    label="Seller"
                    value={
                      titleAgent
                        ? titleAgent.sellerType === "LLC"
                          ? titleAgent.sellerLlcName || titleAgent.sellerName || "Not provided"
                          : titleAgent.sellerName || "Not provided"
                        : "Not provided"
                    }
                  />
                  <OverviewItem
                    icon={<Calendar className="w-5 h-5 text-[#0d3b66]" />}
                    label="Last Sale Date"
                    value={formatOptionalDate((loanApplication.property as any).lastSaleDate)}
                  />
                  <OverviewItem
                    icon={<DollarSign className="w-5 h-5 text-[#0d3b66]" />}
                    label="Last Sale Price"
                    value={formatOptionalCurrency(toNumber((loanApplication.property as any).lastSalePrice))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[#e5e7eb]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg p-5 border border-[#e5e7eb] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-[#10b981]" />
                  <StatusBadge variant="success">Excellent</StatusBadge>
                </div>
                <p className="text-2xl font-bold">{loanApplication.financial.creditScore}</p>
                <p className="text-xs text-[#6b7280]">Credit Score</p>
              </div>

              <div className="bg-white rounded-lg p-5 border border-[#e5e7eb] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <TrendingDown className="w-5 h-5 text-[#0d3b66]" />
                  <StatusBadge variant="success">Low Risk</StatusBadge>
                </div>
                <p className="text-2xl font-bold text-[#0d3b66]">{loanApplication.financial.ltv}%</p>
                <p className="text-xs text-[#6b7280]">LTV</p>
              </div>

              <div className="bg-white rounded-lg p-5 border border-[#e5e7eb] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <LiquidityStatusIcon
                    className={`w-5 h-5 ${
                      liquidityStatus.variant === "success"
                        ? "text-[#10b981]"
                        : liquidityStatus.variant === "warning"
                          ? "text-[#f59e0b]"
                          : "text-[#ef4444]"
                    }`}
                  />
                  <StatusBadge variant={liquidityStatus.variant}>{liquidityStatus.label}</StatusBadge>
                </div>
                <p className="text-2xl font-bold">{loanApplication.liquidity.ratio.toFixed(2)}x</p>
                <p className="text-xs text-[#6b7280]">Liquidity Ratio</p>
              </div>

              <div className="bg-white rounded-lg p-5 border border-[#e5e7eb] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Brain className="w-5 h-5 text-[#3b82f6]" />
                  <StatusBadge variant="info">Model</StatusBadge>
                </div>
                <p className="text-2xl font-bold text-[#3b82f6]">{loanApplication.aiRecommendation.confidence}%</p>
                <p className="text-xs text-[#6b7280]">AI Confidence</p>
              </div>

              <div className="bg-white rounded-lg p-5 border border-[#e5e7eb] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Shield className="w-5 h-5 text-[#0d3b66]" />
                  <StatusBadge variant="success">Current</StatusBadge>
                </div>
                <p className="text-2xl font-bold text-[#0d3b66]">{loanApplication.currentLenderLoans.length}</p>
                <p className="text-xs text-[#6b7280]">Our Loans</p>
              </div>
            </div>
          </div>
          </section>
        ) : null}

        {(sectionVisible("risk-compliance") || sectionVisible("evaluator")) ? (
          <section className={`grid grid-cols-1 ${activeSectionId ? "lg:grid-cols-1" : "lg:grid-cols-2"} gap-6`}>
          {sectionVisible("risk-compliance") ? (
            <div
              id="risk-compliance"
              className={`rounded-lg border-2 border-[#0d3b66] bg-gradient-to-r from-[#0d3b66]/10 via-[#0ea5a5]/5 to-[#0d3b66]/10 p-6 shadow-lg ${
                activeSectionId === "risk-compliance" || activeSectionId === "title-agent-report" ? "relative z-30" : ""
              }`}
            >
            <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 mb-4">
              <HeaderChip>
                <Shield className="w-6 h-6" />
              </HeaderChip>
              <div>
                <h3 className="text-lg font-semibold">Risk &amp; Compliance Checks</h3>
                <p className="text-sm text-[#6b7280]">Automated screening results</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRiskCollapsed((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#0d3b66]/30 bg-white px-3 py-2 text-sm font-medium text-[#0d3b66] hover:bg-[#0d3b66]/5"
            >
              {riskCollapsed ? "Expand" : "Collapse"}
              {riskCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            </div>
            {!riskCollapsed && (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    { id: "bankruptcy" as const, label: "Bankruptcy" },
                    { id: "foreclosure" as const, label: "Foreclosure" },
                    { id: "internalNegativeList" as const, label: "Internal List" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRiskSubTab(tab.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
                        riskSubTab === tab.id
                          ? "bg-[#0d3b66] text-white border-[#0d3b66]"
                          : "bg-white/10 text-[#0d3b66] border-[#0d3b66]/30"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {derivedRiskFactors.length > 0 ? (
                    <div className="rounded-lg border border-[#0d3b66]/30 bg-white p-4">
                      <p className="text-sm font-semibold text-[#0d3b66] mb-2">Key Risk Factors</p>
                      <ul className="space-y-1 text-sm text-[#374151] list-disc list-inside">
                        {derivedRiskFactors.map((risk) => (
                          <li key={risk}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {(() => {
                    const selected =
                      riskSubTab === "bankruptcy"
                        ? { label: "Bankruptcy", value: loanApplication.riskFlags.bankruptcy }
                        : riskSubTab === "foreclosure"
                          ? { label: "Foreclosure", value: loanApplication.riskFlags.foreclosure }
                          : { label: "Internal List", value: loanApplication.riskFlags.internalNegativeList };
                    const hasFlag = selected.value.status;
                    return (
                      <div
                        key={selected.label}
                        className={`rounded-lg border-2 p-4 bg-white ${hasFlag ? "border-[#ef4444]" : "border-[#10b981]"}`}
                      >
                        <div className="flex items-center gap-3">
                          {hasFlag ? (
                            <XCircle className="w-6 h-6 text-[#ef4444]" />
                          ) : (
                            <CheckCircle2 className="w-6 h-6 text-[#10b981]" />
                          )}
                          <div>
                            <p className="font-semibold">{selected.label}</p>
                            <p className="text-sm text-[#6b7280]">{selected.value.details}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {titleAgent ? (
                    <div id="title-agent-report" className="rounded-lg border-2 border-[#0ea5a5]/50 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-[#0ea5a5]" />
                          <p className="font-semibold">Title Agent Report</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "seller" as const, label: "Seller" },
                            { id: "assignor" as const, label: "Assignor" },
                            { id: "documents" as const, label: "Documents" },
                          ].map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setTitleAgentTab(tab.id)}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
                                titleAgentTab === tab.id
                                  ? "bg-[#0ea5a5] text-white border-[#0ea5a5]"
                                  : "bg-white text-[#0ea5a5] border-[#0ea5a5]/40"
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {titleAgentTab === "seller" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <p>
                            <span className="text-[#6b7280]">Seller Type: </span>
                            <span className="font-semibold">{titleAgent.sellerType === "LLC" ? "LLC" : "Individual"}</span>
                          </p>
                          <p>
                            <span className="text-[#6b7280]">Seller Name: </span>
                            <span className="font-semibold">{titleAgent.sellerName || "Not provided"}</span>
                          </p>
                          {titleAgent.sellerType === "LLC" ? (
                            <>
                              <p>
                                <span className="text-[#6b7280]">Seller LLC: </span>
                                <span className="font-semibold">{titleAgent.sellerLlcName || "Not provided"}</span>
                              </p>
                              <p>
                                <span className="text-[#6b7280]">Members: </span>
                                <span className="font-semibold">
                                  {titleAgent.sellerMembers.length ? titleAgent.sellerMembers.join(", ") : "Not provided"}
                                </span>
                              </p>
                            </>
                          ) : null}
                          <p className="md:col-span-2">
                            <span className="text-[#6b7280]">Updated: </span>
                            <span className="font-semibold">{titleAgent.updatedAt || "Not provided"}</span>
                          </p>
                        </div>
                      ) : null}

                      {titleAgentTab === "assignor" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <p>
                            <span className="text-[#6b7280]">Assignor: </span>
                            <span className="font-semibold">
                              {titleAgent.hasAssignor
                                ? titleAgent.assignorType === "LLC"
                                  ? `LLC (${titleAgent.assignorName || "Not provided"})`
                                  : titleAgent.assignorName || "Not provided"
                                : "None"}
                            </span>
                          </p>
                          {titleAgent.hasAssignor && titleAgent.assignorType === "LLC" ? (
                            <>
                              <p>
                                <span className="text-[#6b7280]">Assignor LLC: </span>
                                <span className="font-semibold">{titleAgent.assignorLlcName || "Not provided"}</span>
                              </p>
                              <p>
                                <span className="text-[#6b7280]">Assignor Members: </span>
                                <span className="font-semibold">
                                  {titleAgent.assignorMembers.length ? titleAgent.assignorMembers.join(", ") : "Not provided"}
                                </span>
                              </p>
                            </>
                          ) : null}
                          {titleAgent.hasAssignor ? (
                            <p>
                              <span className="text-[#6b7280]">Assignment Fees: </span>
                              <span className="font-semibold">
                                {titleAgent.assignmentFees ? formatCurrency(Number(titleAgent.assignmentFees) || 0) : "Not provided"}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {titleAgentTab === "documents" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="font-semibold mb-1">Purchase Agreement(s)</p>
                            <ul className="space-y-1">
                              {titleAgent.purchaseAgreements.length === 0 ? (
                                <li className="text-[#6b7280]">None uploaded</li>
                              ) : (
                                titleAgent.purchaseAgreements.map((doc) => (
                                  <li key={doc.name} className="flex items-center gap-2">
                                    <span className="truncate">{doc.name}</span>
                                    {doc.url ? (
                                      <a
                                        className="text-xs rounded border border-primary/40 px-2 py-1 text-primary hover:bg-primary/10"
                                        href={doc.url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Preview
                                      </a>
                                    ) : null}
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                          <div>
                            <p className="font-semibold mb-1">Assignment Agreement(s)</p>
                            <ul className="space-y-1">
                              {titleAgent.assignmentAgreements.length === 0 ? (
                                <li className="text-[#6b7280]">None uploaded</li>
                              ) : (
                                titleAgent.assignmentAgreements.map((doc) => (
                                  <li key={doc.name} className="flex items-center gap-2">
                                    <span className="truncate">{doc.name}</span>
                                    {doc.url ? (
                                      <a
                                        className="text-xs rounded border border-primary/40 px-2 py-1 text-primary hover:bg-primary/10"
                                        href={doc.url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Preview
                                      </a>
                                    ) : null}
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : null}

        {sectionVisible("evaluator") ? (
  <div
    id="evaluator"
    className={`rounded-lg border-2 border-[#0ea5a5] bg-gradient-to-r from-[#0ea5a5]/10 via-[#0d3b66]/5 to-[#0ea5a5]/10 p-6 shadow-lg ${
      activeSectionId === "evaluator" ? "relative z-30" : ""
    }`}
  >
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <div className="w-16 h-10 rounded-lg bg-[#0ea5a5] flex items-center justify-center text-white">
          <Award className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Evaluator&apos;s Assessment</h3>
          <p className="text-sm text-[#6b7280]">
            {loanApplication.evaluatorAssessment.evaluatorName} • {loanApplication.evaluatorAssessment.evaluatorTitle}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsEvaluatorCollapsed((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#0ea5a5]/40 bg-white px-3 py-2 text-sm font-medium text-[#0ea5a5] hover:bg-[#0ea5a5]/5"
        >
          {isEvaluatorCollapsed ? "Expand" : "Collapse"}
          {isEvaluatorCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge variant="success">{loanApplication.evaluatorAssessment.recommendation}</StatusBadge>
          <StatusBadge variant="info">{loanApplication.evaluatorAssessment.confidence} confidence</StatusBadge>
        </div>
      </div>
    </div>

    {!isEvaluatorCollapsed ? (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-lg p-4 border border-[#0ea5a5]/20">
            <p className="text-xs font-semibold text-[#6b7280]">As-Is Value</p>
            <p className="text-xl font-bold text-[#0d3b66]">{formatCurrency(loanApplication.evaluatorAssessment.asIsValue)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-[#0ea5a5]/20">
            <p className="text-xs font-semibold text-[#6b7280]">ARV</p>
            <p className="text-xl font-bold text-[#10b981]">{formatCurrency(loanApplication.evaluatorAssessment.arv)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-[#0ea5a5]/20">
            <p className="text-xs font-semibold text-[#6b7280]">Current LTV</p>
            <p className="text-xl font-bold text-[#0d3b66]">{formatPercent(loanApplication.evaluatorAssessment.ltv)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-[#0ea5a5]/20">
            <p className="text-xs font-semibold text-[#6b7280]">LTV After Repairs</p>
            <p className="text-xl font-bold text-[#10b981]">
              {formatPercent(loanApplication.evaluatorAssessment.ltvAfterRepairs)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-[#0ea5a5]" />
            <p className="font-semibold">Professional Assessment</p>
          </div>
          <p className="text-xs text-[#6b7280] leading-relaxed">{loanApplication.evaluatorAssessment.feedback}</p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#e5e7eb]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span className="text-xs font-semibold text-[#6b7280]">Risk level: {loanApplication.evaluatorAssessment.riskLevel}</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#0ea5a5]">
              <Star className="w-4 h-4" />
              Recommended
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-[#10b981]" />
            <p className="font-semibold">Key Findings</p>
          </div>
          <ul className="space-y-2">
            {loanApplication.evaluatorAssessment.keyFindings.map((finding) => (
              <li key={finding} className="flex items-start gap-2 text-sm">
                <span className="w-2 h-2 mt-1.5 rounded-full bg-[#10b981]" />
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-4 border-t border-[#0ea5a5]/20">
          <button
            type="button"
            className="w-full flex items-center justify-between text-left"
            onClick={() => setShowCmaReport((previous) => !previous)}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0ea5a5]" />
              <p className="font-semibold">Comparative Market Analysis (CMA)</p>
            </div>
            {showCmaReport ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {showCmaReport ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border border-[#e5e7eb]">
                  <p className="text-xs font-semibold text-[#6b7280]">Avg Sale Price</p>
                  <p className="font-bold">{formatCurrency(loanApplication.cmaReport.summary.avgSalePrice)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-[#e5e7eb]">
                  <p className="text-xs font-semibold text-[#6b7280]">Price / Sq Ft</p>
                  <p className="font-bold">{formatCurrency(loanApplication.cmaReport.summary.avgPricePerSqFt)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-[#e5e7eb]">
                  <p className="text-xs font-semibold text-[#6b7280]">Days on Market</p>
                  <p className="font-bold">{loanApplication.cmaReport.summary.daysOnMarket} days</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-[#e5e7eb]">
                  <p className="text-xs font-semibold text-[#6b7280]">Subject Sq Ft</p>
                  <p className="font-bold">{loanApplication.cmaReport.summary.subjectPropertySqFt.toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-3">
                {loanApplication.cmaReport.comparables
                  .slice(0, hiddenComparableCount === 0 ? undefined : comparableLimit)
                  .map((comp, compIndex) => (
                    <div key={compIndex} className="rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-sm">Comparable #{compIndex + 1}</p>
                          <p className="text-xs text-[#6b7280]">{comp.address}</p>
                        </div>
                        <p className="text-sm font-semibold text-[#10b981]">{formatCurrency(comp.salePrice)}</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-[#374151]">
                        <p>
                          <span className="text-[#6b7280]">Beds: </span>
                          <span className="font-semibold">{comp.beds}</span>
                        </p>
                        <p>
                          <span className="text-[#6b7280]">Baths: </span>
                          <span className="font-semibold">{comp.baths}</span>
                        </p>
                        <p>
                          <span className="text-[#6b7280]">Sq Ft: </span>
                          <span className="font-semibold">{comp.sqFt.toLocaleString()}</span>
                        </p>
                        <p>
                          <span className="text-[#6b7280]">$ / Sq Ft: </span>
                          <span className="font-semibold">{formatCurrency(comp.pricePerSqFt)}</span>
                        </p>
                        <p className="md:col-span-2">
                          <span className="text-[#6b7280]">Sold: </span>
                          <span className="font-semibold">{comp.soldDate}</span>
                        </p>
                      </div>
                    </div>
                  ))}
              </div>

              {hiddenComparableCount > 0 ? (
                <p className="text-sm text-[#6b7280]">+{hiddenComparableCount} more comparables</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </>
    ) : null}
  </div>
) : null}

        </section>
      ) : null}

{sectionVisible("liquidity") ? (
  <section
    id="liquidity"
    className="rounded-lg border-2 border-[#0ea5a5] bg-gradient-to-r from-[#0ea5a5]/10 via-[#0d3b66]/5 to-[#0ea5a5]/10 p-6 shadow-lg relative z-30"
  >
    <div className="flex items-center gap-3 mb-6">
      <div className="w-16 h-10 rounded-lg bg-[#0ea5a5] flex items-center justify-center text-white">
        <DollarSign className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Liquidity Analysis</h3>
        <p className="text-sm text-[#6b7280]">Assets vs. 6-month costs</p>
      </div>
      <button
        type="button"
        onClick={() => setIsLiquidityCollapsed((prev) => !prev)}
        className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#0ea5a5]/40 bg-white px-3 py-2 text-sm font-medium text-[#0ea5a5] hover:bg-[#0ea5a5]/5"
      >
        {isLiquidityCollapsed ? "Expand" : "Collapse"}
        {isLiquidityCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>
    </div>

    {!isLiquidityCollapsed ? (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg p-5 border border-[#e5e7eb] shadow-sm">
            <h4 className="text-sm font-semibold text-[#6b7280] mb-3">Available Assets</h4>
            <p className="text-xs text-[#6b7280] mb-3">
              Asset type from Conditions:{" "}
              {loanApplication.liquidity.assetTypeLabels.length > 0
                ? loanApplication.liquidity.assetTypeLabels.join(", ")
                : "Not specified"}
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6b7280]">Checking</span>
                <span className="font-medium">{formatCurrency(loanApplication.liquidity.availableAssets.checking)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b7280]">Savings</span>
                <span className="font-medium">{formatCurrency(loanApplication.liquidity.availableAssets.savings)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b7280]">Investments</span>
                <span className="font-medium">{formatCurrency(loanApplication.liquidity.availableAssets.investments)}</span>
              </div>
              <div className="pt-3 border-t border-[#e5e7eb] flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-[#0ea5a5]">{formatCurrency(loanApplication.liquidity.availableAssets.total)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 border border-[#e5e7eb] shadow-sm">
            <h4 className="text-sm font-semibold text-[#6b7280] mb-3">6-Month Costs</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6b7280]">Monthly Interest (×6)</span>
                <span className="font-medium">{formatCurrency(projectedMonthlyInterest * 6)}</span>
              </div>
              {projectedExistingLoansMonthlyInterest > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Existing Loans Monthly Interest (×6)</span>
                  <span className="font-medium">{formatCurrency(projectedExistingLoansMonthlyInterest * 6)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-[#6b7280]">Closing Costs</span>
                <span className="font-medium">{formatCurrency(loanApplication.liquidity.sixMonthCosts.closingCosts)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b7280]">Service Fee</span>
                <span className="font-medium">{formatCurrency(loanApplication.liquidity.sixMonthCosts.serviceFees)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b7280]">Document Preparation Fee</span>
                <span className="font-medium">{formatCurrency(projectedDocumentPreparationFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b7280]">Other Mortgage Exposure (×6)</span>
                <span className="font-medium">
                  {formatCurrency(loanApplication.liquidity.sixMonthCosts.otherMortgageExposure)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b7280]">Origination Fee</span>
                <span className="font-medium">{formatCurrency(projectedOriginationFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b7280]">Prepaid Interest</span>
                <span className="font-medium">{formatCurrency(projectedPrepaidInterest)}</span>
              </div>
              <div className="pt-3 border-t border-[#e5e7eb] flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-[#ef4444]">{formatCurrency(loanApplication.liquidity.sixMonthCosts.total)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border-2 border-[#0ea5a5] bg-gradient-to-r from-[#0ea5a5]/10 to-[#0d3b66]/10 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#6b7280]">Liquidity Ratio</p>
            <p className="text-3xl font-bold text-[#0ea5a5]">{loanApplication.liquidity.ratio.toFixed(2)}x</p>
          </div>
          <div className="text-right">
            <StatusBadge variant={liquidityStatus.variant}>{liquidityStatus.label}</StatusBadge>
            <p className="text-sm text-[#6b7280] mt-2">Coverage strength vs projected obligations</p>
          </div>
        </div>

        <div className="mt-4 bg-white rounded-lg p-5 border border-[#e5e7eb] shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="text-sm font-semibold text-[#6b7280]">Proof of Liquidity (Conditions Form)</h4>
            <StatusBadge variant={loanApplication.liquidity.proofDocuments.length > 0 ? "success" : "warning"}>
              {loanApplication.liquidity.proofDocuments.length} file(s)
            </StatusBadge>
          </div>
          {loanApplication.liquidity.proofDocuments.length > 0 ? (
            <div className="space-y-2">
              {loanApplication.liquidity.proofDocuments.map((doc, index) => (
                <div key={`${doc.name}-${index}`} className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm">
                  <p className="font-medium text-[#111827]">{doc.category || "Proof of Liquidity"}</p>
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#0d3b66] hover:underline break-all"
                    >
                      {doc.name}
                    </a>
                  ) : (
                    <p className="text-[#374151] break-all">{doc.name}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#6b7280]">No proof-of-liquidity documents submitted from Conditions yet.</p>
          )}
        </div>
      </>
    ) : null}
  </section>
) : null}
{sectionVisible("conditions") ? (
          <section
            id="conditions"
            className="rounded-lg border-2 border-[#0d3b66] bg-gradient-to-r from-[#0d3b66]/10 via-[#0ea5a5]/5 to-[#0d3b66]/10 p-6 shadow-lg relative z-30"
          >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <HeaderChip>
                <FileText className="w-6 h-6" />
              </HeaderChip>
              <div>
                <h3 className="text-lg font-semibold">Conditions Submission</h3>
                <p className="text-sm text-[#6b7280]">Borrower portal conditions data for this loan</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsConditionsExpanded((previous) => !previous)}
              aria-expanded={isConditionsExpanded}
              aria-controls="conditions-submission-content"
              className="inline-flex items-center gap-2 rounded-lg border border-[#0d3b66]/30 bg-white px-3 py-2 text-sm font-medium text-[#0d3b66] hover:bg-[#0d3b66]/5"
            >
              {isConditionsExpanded ? "Collapse" : "Expand"}
              {isConditionsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {isConditionsExpanded ? (
            !loanApplication.conditions.submitted ? (
              <div id="conditions-submission-content" className="rounded-lg border border-[#e5e7eb] bg-white p-5 text-sm text-[#6b7280]">
                Conditions form has not been submitted for this loan yet.
              </div>
            ) : (
              <div id="conditions-submission-content" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                  <p className="text-xs text-[#6b7280]">Submitted</p>
                  <p className="text-lg font-semibold">
                    <StatusBadge variant="success">Yes</StatusBadge>
                  </p>
                </div>
                <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                  <p className="text-xs text-[#6b7280]">Submitted Date</p>
                  <p className="text-lg font-semibold">{loanApplication.conditions.submittedAt}</p>
                </div>
                <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                  <p className="text-xs text-[#6b7280]">Conditions Credit Score</p>
                  <p className="text-lg font-semibold">
                    {loanApplication.conditions.creditScore !== null ? loanApplication.conditions.creditScore : "Not provided"}
                  </p>
                </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                <p className="text-xs text-[#6b7280]">Conditions Liquidity Amount</p>
                <p className="text-lg font-semibold">
                  {loanApplication.conditions.proofOfLiquidityAmount !== null
                    ? formatCurrency(loanApplication.conditions.proofOfLiquidityAmount)
                    : "Not provided"}
                </p>
              </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                <p className="text-xs text-[#6b7280]">Desktop Appraisal Value</p>
                <p className="text-lg font-semibold">
                  {loanApplication.conditions.desktopAppraisalValue !== null
                    ? formatCurrency(loanApplication.conditions.desktopAppraisalValue)
                    : "Not provided"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                <p className="text-xs text-[#6b7280]">Other Mortgage Loans Count</p>
                  <p className="text-lg font-semibold">
                    {loanApplication.conditions.otherMortgageLoansCount !== null
                      ? loanApplication.conditions.otherMortgageLoansCount
                      : "Not provided"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                  <p className="text-xs text-[#6b7280]">Other Mortgage Total Amount</p>
                  <p className="text-lg font-semibold">
                    {loanApplication.conditions.otherMortgageTotalAmount !== null
                      ? formatCurrency(loanApplication.conditions.otherMortgageTotalAmount)
                      : "Not provided"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                <p className="text-sm font-semibold text-[#6b7280] mb-2">Referral Information</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <p><span className="text-[#6b7280]">Name: </span>{loanApplication.conditions.referral.name || "Not provided"}</p>
                  <p><span className="text-[#6b7280]">Email: </span>{loanApplication.conditions.referral.email || "Not provided"}</p>
                  <p><span className="text-[#6b7280]">Phone: </span>{loanApplication.conditions.referral.phone || "Not provided"}</p>
                </div>
              </div>

              <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                <p className="text-sm font-semibold text-[#6b7280] mb-2">Desktop Appraisal Documents</p>
                {loanApplication.conditions.desktopAppraisalDocs.length > 0 ? (
                  <div className="space-y-2">
                    {loanApplication.conditions.desktopAppraisalDocs.map((doc, index) => (
                      <div key={`${doc.name}-${index}`} className="rounded border border-[#e5e7eb] px-3 py-2 text-sm">
                        {doc.url ? (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="text-[#0d3b66] hover:underline break-all">
                            {doc.name}
                          </a>
                        ) : (
                          <p className="text-[#374151] break-all">{doc.name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#6b7280]">No desktop appraisal uploaded in Conditions.</p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                  <p className="text-sm font-semibold text-[#6b7280] mb-2">LLC Documents</p>
                  {loanApplication.conditions.llcDocuments.length > 0 ? (
                    <div className="space-y-2">
                      {loanApplication.conditions.llcDocuments.map((doc, index) => (
                        <div key={`${doc.name}-${index}`} className="rounded border border-[#e5e7eb] px-3 py-2 text-sm">
                          <p className="font-medium">{doc.docType}</p>
                          {doc.url ? (
                            <a href={doc.url} target="_blank" rel="noreferrer" className="text-[#0d3b66] hover:underline break-all">
                              {doc.name}
                            </a>
                          ) : (
                            <p className="text-[#374151] break-all">{doc.name}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#6b7280]">No LLC documents submitted in Conditions.</p>
                  )}
                </div>

                <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                  <p className="text-sm font-semibold text-[#6b7280] mb-2">Past Projects</p>
                  {loanApplication.conditions.pastProjects.length > 0 ? (
                    <div className="space-y-3">
                      {loanApplication.conditions.pastProjects.map((project, projectIndex) => (
                        <div key={`${project.propertyAddress}-${projectIndex}`} className="rounded border border-[#e5e7eb] px-3 py-2">
                          <p className="font-medium text-sm">{project.propertyAddress}</p>
                          <p className="text-xs text-[#6b7280] mt-1">{project.photos.length} photo(s)</p>
                          {project.photos.length > 0 ? (
                            <div className="mt-2 space-y-1">
                              {project.photos.map((photo, photoIndex) =>
                                photo.url ? (
                                  <a
                                    key={`${photo.name}-${photoIndex}`}
                                    href={photo.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-sm text-[#0d3b66] hover:underline break-all"
                                  >
                                    {photo.name}
                                  </a>
                                ) : (
                                  <p key={`${photo.name}-${photoIndex}`} className="text-sm text-[#374151] break-all">
                                    {photo.name}
                                  </p>
                                )
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#6b7280]">No past projects submitted in Conditions.</p>
                  )}
                </div>
              </div>

            </div>
            )
          ) : null}
          </section>
        ) : null}

        {sectionVisible("photos") ? (
          <section
            id="photos"
            className="rounded-lg border-2 border-[#0d3b66] bg-gradient-to-r from-[#0d3b66]/10 via-[#0ea5a5]/5 to-[#0d3b66]/10 p-6 shadow-lg relative z-30"
          >
          <div className="flex items-center gap-3 mb-6">
            <HeaderChip>
              <ImageIcon className="w-6 h-6" />
            </HeaderChip>
            <div>
              <h3 className="text-lg font-semibold">Subject Property Photos</h3>
              <p className="text-sm text-[#6b7280]">Visual inspection gallery</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPhotosCollapsed((prev) => !prev)}
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#0d3b66]/30 bg-white px-3 py-2 text-sm font-medium text-[#0d3b66] hover:bg-[#0d3b66]/5"
            >
              {isPhotosCollapsed ? "Expand" : "Collapse"}
              {isPhotosCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!isPhotosCollapsed ? (
            <>
          <div className="relative aspect-video rounded-lg overflow-hidden shadow-md mb-4">
            <button
              type="button"
              onClick={() => setIsPhotoViewerOpen(true)}
              className="w-full h-full text-left"
            >
              <img
                src={loanApplication.property.photos[selectedPhoto]}
                alt={`Subject property ${selectedPhoto + 1}`}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                Click to enlarge
              </span>
            </button>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={showPreviousPhoto}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/75"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={showNextPhoto}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/75"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {loanApplication.property.photos.map((photo, index) => (
              <button
                key={photo}
                type="button"
                onClick={() => setSelectedPhoto(index)}
                className={`aspect-square rounded-lg overflow-hidden border-2 transition ${
                  index === selectedPhoto
                    ? "border-[#0d3b66] ring-2 ring-[#0d3b66]/20"
                    : "border-transparent hover:border-[#e5e7eb]"
                }`}
              >
                <img src={photo} alt={`Property thumbnail ${index + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
            </>
          ) : null}
          </section>
        ) : null}

        {isPhotoViewerOpen ? (
          <div className="fixed inset-0 z-50 bg-black/85 p-4 sm:p-8">
            <div className="mx-auto flex h-full max-w-6xl flex-col">
              <div className="mb-3 flex items-center justify-between text-white">
                <p className="text-sm font-medium">
                  Photo {selectedPhoto + 1} of {photoCount}
                </p>
                <button
                  type="button"
                  aria-label="Close photo viewer"
                  onClick={() => setIsPhotoViewerOpen(false)}
                  className="rounded-full bg-white/10 p-2 hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative min-h-0 flex-1">
                <img
                  src={loanApplication.property.photos[selectedPhoto]}
                  alt={`Subject property large view ${selectedPhoto + 1}`}
                  className="h-full w-full rounded-lg object-contain"
                />
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={showPreviousPhoto}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/25"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={showNextPhoto}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/25"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {sectionVisible("existing-loans") ? (
          <section
            id="existing-loans"
            className="rounded-lg border-2 border-[#0ea5a5] bg-gradient-to-r from-[#0ea5a5]/10 via-[#0d3b66]/5 to-[#0ea5a5]/10 p-6 shadow-lg relative z-30"
          >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-16 h-10 rounded-lg bg-[#0ea5a5] flex items-center justify-center text-white">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Our Existing Loans</h3>
              <p className="text-sm text-[#6b7280]">Portfolio performance history</p>
            </div>
          </div>

          <div className="space-y-4">
            {loanApplication.currentLenderLoans.length === 0 ? (
              <div className="rounded-lg border border-[#e5e7eb] bg-white p-5 text-sm text-[#6b7280]">
                No active loans with us are currently on file for this borrower.
              </div>
            ) : (
              loanApplication.currentLenderLoans.map((loan, index) => {
                const milestone = getExistingLoanMilestone(loan);
                return (
                  <div key={loan.propertyAddress} className="bg-white rounded-lg border border-[#e5e7eb] p-5 hover:bg-[#f9fafb] transition">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <p className="font-semibold">{loan.propertyAddress}</p>
                      <StatusBadge variant={getExistingLoanStatusVariant(loan.status)}>{loan.status}</StatusBadge>
                    </div>
                    <p className="text-sm text-[#6b7280] mb-4">
                      {formatCurrency(loan.loanAmount)} • {loan.monthsRemaining} months remaining
                    </p>

                    <div className={`grid grid-cols-1 ${milestone ? "md:grid-cols-3" : "md:grid-cols-2"} gap-3 text-sm mb-4`}>
                      <div className="rounded-lg bg-[#f9fafb] p-3 border border-[#e5e7eb]">
                        <p className="text-[#6b7280]">Monthly Payment</p>
                        <p className="font-semibold">{formatCurrency(loan.monthlyPayment)}</p>
                      </div>
                      <div className="rounded-lg bg-[#f9fafb] p-3 border border-[#e5e7eb]">
                        <p className="text-[#6b7280]">Last Payment Date</p>
                        <p className="font-semibold">{loan.lastPaymentDate}</p>
                      </div>
                      {milestone ? (
                        <div className="rounded-lg bg-[#f9fafb] p-3 border border-[#e5e7eb]">
                          <p className="text-[#6b7280]">{milestone.label}</p>
                          <p className="font-semibold">{milestone.value}</p>
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-left rounded-lg border border-[#e5e7eb] px-3 py-2"
                      onClick={() => toggleLoanNotes(index)}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <MessageSquare className="w-4 h-4 text-[#0d3b66]" />
                        {loan.notes.length} note(s)
                      </span>
                      {expandedLoanNotes[index] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {expandedLoanNotes[index] ? (
                      <div className="mt-3 space-y-2">
                        {loan.notes.map((note) => (
                          <div key={`${note.date}-${note.author}`} className="rounded-lg bg-[#f3f4f6] border border-[#e5e7eb] p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                              <p className="text-xs font-semibold">{note.author}</p>
                              <p className="text-xs text-[#6b7280]">{note.date}</p>
                            </div>
                            <p className="text-sm text-[#374151]">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          </section>
        ) : null}

        {showSummarySheet ? (
          <SummarySheet
            loanApplication={loanApplication}
            liquidityStatus={{
              color: liquidityStatus.variant,
              label: liquidityStatus.label,
              description:
                liquidityStatus.variant === "success"
                  ? "Strong liquidity coverage"
                  : liquidityStatus.variant === "warning"
                    ? "Moderate liquidity coverage"
                    : "Liquidity coverage below target",
            }}
            onClose={() => setShowSummarySheet(false)}
            onDecisionSelect={handleSummaryDecision}
          />
        ) : null}
      </div>
    </div>
  );
}
