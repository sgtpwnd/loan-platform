export type UnderwritingCaseStatus = "Draft" | "In Review" | "Approved" | "Declined";
export type UnderwritingWorkflowStatus =
  | "New Loan Request"
  | "In Progress"
  | "In-underwriting"
  | "UW for Review"
  | "Under Review"
  | "Approved";

export type UnderwritingRiskSeverity = "high" | "medium" | "low";
export type UnderwritingRiskState = "issue" | "pending" | "info";
export type UnderwritingRecordStatus = "complete" | "pending" | "in_review";
export type UnderwritingRecommendation = "Approve" | "Conditional" | "Decline";

export type UnderwritingDocumentSource =
  | "new_loan_request"
  | "continuation_form"
  | "borrower_profile"
  | "internal";

export type UnderwritingDocumentLink = {
  id: string;
  label: string;
  name: string;
  url: string | null;
  source: UnderwritingDocumentSource;
  required: boolean;
};

export type UnderwritingRiskFlag = {
  id: string;
  label: string;
  detail: string;
  severity: UnderwritingRiskSeverity;
  state: UnderwritingRiskState;
};

export type UnderwritingRecordSearchItem = {
  id: string;
  label: string;
  status: UnderwritingRecordStatus;
  note: string;
  updatedAt: number | null;
};

export type TitleAgentFormData = {
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
  purchaseAgreements: Array<{
    name: string;
    dataUrl: string | null;
    contentType?: string | null;
  }>;
  assignmentAgreements: Array<{
    name: string;
    dataUrl: string | null;
    contentType?: string | null;
  }>;
  updatedAt: number | null;
};

export type UnderwritingContinuationSubmission = {
  submittedAt: number | null;
  formData: Record<string, unknown>;
};

export type UnderwritingCaseSummary = {
  loanId: string;
  stage: string;
  workflowStatus: UnderwritingWorkflowStatus;
  createdAt: number;
  lastEventAt: number;
  executive: {
    borrowerName: string;
    borrowerEntity: string;
    borrowerEmail: string;
    propertyAddress: string;
    requestedLoanAmount: number;
    purpose: string;
    product: string;
    status: UnderwritingCaseStatus;
  };
  qualification: {
    creditScore: number | null;
    creditSource: string;
    flipsCompleted: number | null;
    rentalsOwned: number | null;
    yearsInvesting: number | null;
    liquidityAmount: number | null;
    liquiditySource: string;
    liquidityCoverage: {
      formula: string;
      availableLiquidity: number | null;
      requiredLiquidity: number | null;
      withUsExposure: number | null;
      estimatedOtherLenderExposure: number | null;
      otherLenderLoanCount: number;
      coverageRatio: number | null;
      remainingLiquidity: number | null;
      isEnough: boolean | null;
      assumptionNote: string;
    };
    dti: number | null;
    dscr: number | null;
    ltv: number | null;
    ltc: number | null;
    totalProjectCost: number | null;
    borrowerCashToClose: number | null;
    exitStrategy: string;
    exitTimeline: string;
    openLoanCount: number | null;
    occupancyStrategy: string;
  };
  riskFlags: UnderwritingRiskFlag[];
  riskCounts: {
    issues: number;
    pending: number;
    highRisk: number;
  };
  quickDecision: {
    recommendation: UnderwritingRecommendation;
    reasons: string[];
    conditions: string[];
  };
  recordSearchStatus: UnderwritingRecordSearchItem[];
  evaluatorAssessment: {
    title: string;
    recommendation: "PRE_APPROVE" | "REVIEW" | "DECLINE";
    confidence: number;
    reasons: string[];
    notes: string[];
    metrics: {
      ltv: number | null;
      ltc: number | null;
      docsScore: number;
    };
  };
  titleAgentForm?: TitleAgentFormData;
  borrowerPortal: {
    newLoanRequest: {
      borrower: {
        fullName: string;
        email: string;
        entityName: string;
      };
      property: {
        address: string;
      };
      loanRequest: {
        type: string;
        amount: number;
        purchasePrice: string;
        rehabBudget: string;
        arv: string;
        assessorValue?: string;
        zillowValue?: string;
        realtorComValue?: string;
        narprValue?: string;
        propelioMedianValue?: string;
        propelioHighValue?: string;
        propelioLowValue?: string;
        economicValue?: string;
        rentometerEstimate?: string;
        zillowRentEstimate?: string;
        exitStrategy: string;
        targetClosingDate: string;
      };
    };
    continuation: {
      submitted: boolean;
      latestSubmittedAt: number | null;
      submissions: UnderwritingContinuationSubmission[];
      latest: Record<string, unknown> | null;
    };
    conditions?: {
      submitted: boolean;
      latestSubmittedAt: number | null;
      latest: Record<string, unknown> | null;
    };
  };
  linksAndDocuments: {
    photos: UnderwritingDocumentLink[];
    pastProjects: Array<{
      propertyName: string;
      photoLabel: string;
      photoUrl: string | null;
    }>;
    documents: UnderwritingDocumentLink[];
    llcDocumentsViewerUrl?: string | null;
    conditionsPackage?: {
      id: string;
      createdAt: number | null;
      folderPath: string;
      manifestPath: string | null;
      documentCount: number;
      files: Array<{
        id: string;
        label: string;
        name: string;
        path: string;
      }>;
    } | null;
  };
  internalNotes: Array<{
    id: string;
    source: string;
    message: string;
    createdAt: number | null;
  }>;
  combinedNarrative: string;
};

export const UNDERWRITING_RULES = {
  maxLtv: 0.75,
  maxLtc: 0.9,
  minCreditScore: 680,
  minLiquidityToLoanRatio: 0.1,
  acceptableLiquidityRatio: 2,
  excellentLiquidityRatio: 4,
  maxOtherMortgageLoans: 5,
  liquidityMonths: 6,
  assumedAnnualInterestRate: 0.12,
  prepaidInterestAnnualRate: 0.13,
  perDiemDayCountBasis: 360,
  originationFeePercent: 5,
  monthlyServiceFee: 950,
  documentPreparationFee: 250,
  closingCostEstimate: 6000,
  estimatedOtherLenderMonthlyPaymentFactor: 0.75,
  estimatedOtherLenderLoanFactor: 0.75,
  shortClosingTimelineDays: 14,
  declineCreditScore: 620,
  declineLtv: 0.82,
} as const;

/*
Field Mapping (Borrower Portal -> Underwriting Summary tiles/flags)
1) New Loan Request:
- `application.amount` -> Decision Header / Requested Loan Amount
- `application.type` -> Decision Header / Purpose
- `application.property` -> Decision Header / Subject Property
- `application.purchaseDetails.purchasePrice|rehabBudget|arv` -> LTC/LTV/Total Project Cost/Cash-to-close
- `application.purchaseDetails.exitStrategy|targetClosingDate` -> Exit Strategy & timeline / Short timeline flags
- `purchaseDetails.{compsFiles,propertyPhotos,purchaseContractFiles,scopeOfWorkFiles}` -> Missing docs flags + Links & Documents
2) Continuation Form:
- `underwritingIntake.formData.creditScore` -> Qualification Snapshot / Credit score tile
- `underwritingIntake.formData.proofOfLiquidityAmount` -> Liquidity tile + Low reserve flag
- `underwritingIntake.formData.otherMortgageLoansCount|otherMortgageLenders` -> Existing mortgages/open loans tile
- `underwritingIntake.formData.activeLoans` -> Active loans drill-down + pending/condition context
- `underwritingIntake.formData.activeLoans + internal borrower loan amounts + other mortgage count` -> Liquidity coverage formula + enough/not enough result
- `underwritingIntake.formData.llcName|llcDocs` -> Entity mismatch + LLC docs completeness flags
- `underwritingIntake.formData.pastProjects` -> Experience tile (# flips/projects) + Links & Documents
- `underwritingIntake.formData.referral` -> Borrower portal detail drill-down
3) Internal/Underwriting:
- `buildAiAssessment(...)` -> Evaluator assessment + quick-decision reasons
- `decisionNotes` + lender communications -> Internal Notes section
*/
