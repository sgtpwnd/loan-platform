import type { UnderwritingCaseSummary } from "../lib/underwriting/summary";

export type LoanType =
  | "Fix & Flip Loan (Rehab Loan)"
  | "Bridge Loan"
  | "Ground-Up Construction Loan"
  | "Transactional Funding (Double Close / Wholesale)"
  | "Land Loan"
  | "Purchase"
  | "Refinance"
  | "Cash-Out Refinance";

export type UploadedDocument = {
  name: string;
  contentType?: string | null;
  dataUrl?: string | null;
};

export type BorrowerLiquidityProofDocType = "BANK_STATEMENT" | "OTHER_ACCOUNT";
export type BorrowerLiquidityOwnershipType = "BORROWER" | "LLC" | "PARTNER_LLC_MEMBER";

export type BorrowerLiquidityProofDoc = UploadedDocument & {
  docType: BorrowerLiquidityProofDocType;
  statementName: string;
  ownershipType: BorrowerLiquidityOwnershipType;
  partnerIsGuarantor: boolean;
  partnerGuarantorName: string;
  partnerIsLlcMember: boolean;
  uploadedAt?: number | null;
};

export type UploadedDocumentInput = string | UploadedDocument;

export type BorrowerAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type BorrowerEmergencyContact = {
  name: string;
  email: string;
  phone: string;
};

export type GuarantorContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type BorrowerProfileInfo = {
  firstName: string;
  middleName: string;
  lastName: string;
  llcName: string;
  email: string;
  homePhone: string;
  workPhone: string;
  mobilePhone: string;
  dateOfBirth: string;
  socialSecurityNumber: string;
  civilStatus: string;
  presentAddress: BorrowerAddress;
  timeAtResidence: string;
  mailingSameAsPresent: boolean;
  mailingAddress: BorrowerAddress;
  noBusinessAddress?: boolean;
  businessAddress: BorrowerAddress;
  emergencyContacts: BorrowerEmergencyContact[];
  guarantors: string[];
  guarantorContacts: GuarantorContact[];
  liquidityProofDocs: BorrowerLiquidityProofDoc[];
};

export type UnderwritingLlcDoc = UploadedDocument & {
  docType?: string | null;
};

export type BorrowerAccessStatus = "NOT_CREATED" | "ACCESS_CREATED" | "PROFILE_COMPLETED";

export type BorrowerAccessState = {
  status: BorrowerAccessStatus;
  email: string;
  invitedAt?: number | null;
  createdAt?: number | null;
  profileCompletedAt?: number | null;
};

export type UnderwritingLlcOptionOnFile = {
  name: string;
  stateRecorded?: string | null;
};

export type PurchaseDetails = {
  purchasePrice: string;
  rehabBudget: string;
  arv: string;
  currentOwner?: string;
  lastSaleDate?: string;
  lastSalePrice?: string;
  assessorValue?: string;
  attomAvmValue?: string;
  zillowValue?: string;
  realtorComValue?: string;
  narprValue?: string;
  propelioMedianValue?: string;
  propelioHighValue?: string;
  propelioLowValue?: string;
  economicValue?: string;
  rentometerEstimate?: string;
  zillowRentEstimate?: string;
  compsValidationNote: string;
  compsFiles: UploadedDocumentInput[];
  propertyPhotos: UploadedDocumentInput[];
  purchaseContractFiles: UploadedDocumentInput[];
  scopeOfWorkFiles: UploadedDocumentInput[];
  exitStrategy: string;
  targetClosingDate: string;
};

export type ValuationInputRole = "LOAN_OFFICER" | "EVALUATOR";

export type ValuationInputValues = {
  assessorValue: string;
  attomAvmValue: string;
  zillowValue: string;
  realtorComValue: string;
  narprValue: string;
  propelioMedianValue: string;
  propelioHighValue: string;
  propelioLowValue: string;
  economicValue: string;
  rentometerEstimate: string;
  zillowRentEstimate: string;
  currentOwner: string;
  lastSaleDate: string;
  lastSalePrice: string;
  bankruptcyRecord: string;
  internalWatchlist: string;
  forecasaStatus: string;
  activeLoansCount: string;
  negativeDeedRecords: string;
};

export type EvaluatorInputValues = {
  cmaAvgSalePrice: string;
  cmaPricePerSqFt: string;
  cmaDaysOnMarket: string;
  cmaSubjectSqFt: string;
  keyFindingLtv: string;
  keyFindingApplication: string;
  keyFindingScore: string;
  asIsValue: string;
  arv: string;
  currentLtv: string;
  ltvAfterRepairs: string;
  recommendation: string;
  confidence: string;
  riskLevel: string;
  professionalAssessment: string;
};

export type LenderValuationInputSnapshot = {
  loanId: string;
  statusLabel: string;
  values: ValuationInputValues;
  missingFields: string[];
  isComplete: boolean;
  lastUpdatedAt: number | null;
  lastUpdatedBy: ValuationInputRole | null;
};

export type AttomSubjectPropertyResponse = {
  address_matched: boolean;
  total_market_value: number | null;
  land_appraisal_value: number | null;
  building_appraisal_value: number | null;
  last_sale_date?: string | null;
  last_sale_price?: number | null;
  owner_name?: string | null;
  avm_value: number | null;
  sources: {
    expandedprofile_url: string | null;
    basicprofile_url: string | null;
    assessment_snapshot_url: string | null;
    avm_url: string | null;
    detailowner_url?: string | null;
    sale_snapshot_url?: string | null;
  };
  retrieved_at: string;
  needs_review: boolean;
  notes: string[];
  raw_property?: Record<string, unknown> | null;
  attempts?: Array<Record<string, unknown>>;
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
  purchaseAgreements: UploadedDocument[];
  assignmentAgreements: UploadedDocument[];
  updatedAt?: number | null;
};

export type LenderEvaluatorInputSnapshot = {
  loanId: string;
  statusLabel: string;
  values: EvaluatorInputValues;
  missingFields: string[];
  isComplete: boolean;
  lastUpdatedAt: number | null;
  lastUpdatedBy: string | null;
};

export type UnderwritingPrefill = {
  isNewBorrower: boolean;
  canReuseCreditScore: boolean;
  creditScoreOnFile: number;
  creditScoreOnFileDate?: number | null;
  canReuseLiquidity: boolean;
  liquidityOnFile: string;
  liquidityOnFileDate?: number | null;
  canReuseMortgageLoans?: boolean;
  mortgageLoansOnFileDate?: number | null;
  llcNameOnFile?: string;
  llcOptionsOnFile?: UnderwritingLlcOptionOnFile[];
  hasLlcDocsOnFile: boolean;
  llcDocsOnFile: UnderwritingLlcDoc[];
  existingMortgageLenders: string[];
  otherMortgageTotalMonthlyInterestOnFile?: number | null;
  referralOnFile?: {
    name: string;
    phone: string;
    email: string;
  } | null;
  pastProjectsOnFile: Array<{
    propertyName: string;
    photoLabel: string;
  }>;
  borrowerLiquidityProofDocsOnFile: BorrowerLiquidityProofDoc[];
  borrowerGuarantorsOnFile: string[];
  borrowerGuarantorContactsOnFile?: GuarantorContact[];
  activeLoansWithUs: Array<{
    loanId: string;
    property: string;
    amount?: number | null;
    status: string;
    expectedCompletionDate: string;
    payoffDate: string;
    monthlyPayment?: number | null;
    notes: string;
  }>;
  borrowerIdentityOnFile: {
    firstName: string;
    middleName: string;
    lastName: string;
    llcName: string;
    email: string;
  };
};

export type UnderwritingIntakeData = {
  bed: string;
  bath: string;
  closingCompany: string;
  closingAgentName: string;
  closingAgentEmail: string;
  useCreditScoreOnFile: boolean;
  creditScore: number | null;
  useLiquidityOnFile: boolean;
  proofOfLiquidityAmount: string;
  llcName: string;
  llcStateRecorded: string;
  llcSameAsOnFile: boolean;
  useLlcDocsOnFile: boolean;
  llcDocs: UnderwritingLlcDoc[];
  newLlcInfoCompleted: boolean;
  useExistingMortgageLoans: boolean;
  otherMortgageLoansCount: number | null;
  otherMortgageLenders: string[];
  otherMortgageTotalMonthlyInterest: number | null;
  hasNewMortgageLoans: boolean;
  newMortgageLenders: string[];
  activeLoans: Array<{
    loanId: string;
    status: string;
    expectedCompletionDate: string;
    payoffDate: string;
    monthlyPayment: number | null;
    notes: string;
  }>;
  useProfileReferral: boolean;
  referral: {
    name: string;
    phone: string;
    email: string;
  };
  useProfileProjects: boolean;
  pastProjects: Array<{
    propertyName: string;
    photoLabel: string;
    photo?: UploadedDocument | null;
  }>;
  borrowerProfile: BorrowerProfileInfo;
};

export type BorrowerConditionsPastProject = {
  propertyAddress: string;
  photos: UploadedDocument[];
};

export type BorrowerConditionsLiquidityDoc = UploadedDocument & {
  category?: string | null;
  subcategory?: string | null;
};

export type BorrowerConditionsDocumentPackage = {
  id: string;
  createdAt: number | null;
  rootRelativePath: string;
  manifestRelativePath: string | null;
  documentCount: number;
  files: Array<{
    id: string;
    section: string;
    label: string;
    name: string;
    relativePath: string;
    savedAs: string;
    mimeType: string;
    bytes: number;
    category?: string | null;
    subcategory?: string | null;
    docType?: string | null;
    projectIndex?: number | null;
    propertyAddress?: string | null;
  }>;
};

export type BorrowerConditionsFormData = {
  creditScore: number | null;
  proofOfLiquidityAmount: string;
  proofOfLiquidityDocs: BorrowerConditionsLiquidityDoc[];
  llcDocs: UnderwritingLlcDoc[];
  referral: {
    name: string;
    email: string;
    phone: string;
  };
  desktopAppraisalValue: string;
  desktopAppraisalDocs: UploadedDocument[];
  pastProjects: BorrowerConditionsPastProject[];
  otherMortgageLoansCount: number | null;
  otherMortgageTotalAmount: string;
  submittedAt?: number | null;
  updatedAt?: number | null;
  documentPackage?: BorrowerConditionsDocumentPackage | null;
  reuseMeta?: {
    sourceLoanId: string;
    sourceUpdatedAt: number | null;
    within30Days: boolean;
  } | null;
};

export type UnderwritingIntakeState = {
  status: "LOCKED" | "PENDING" | "SUBMITTED";
  requestedAt?: number | null;
  submittedAt?: number | null;
  notificationSentAt?: number | null;
  formData?: UnderwritingIntakeData | null;
  submissionHistory?: Array<{
    submittedAt?: number | null;
    formData?: UnderwritingIntakeData | Record<string, unknown> | null;
  }>;
};

export type UnderwritingSummary = {
  generatedAt: number;
  loanRequest: {
    loanId?: string;
    borrower?: string;
    borrowerEmail?: string;
    property?: string;
    type?: string;
    requestedAmount?: number;
    purchaseDetails?: PurchaseDetails | null;
  };
  continuation: {
    bed?: string;
    bath?: string;
    closingCompany?: string;
    closingAgentName?: string;
    closingAgentEmail?: string;
    creditScore?: number | null;
    proofOfLiquidityAmount?: string;
    llcName?: string;
    otherMortgageLoansCount?: number;
    otherMortgageLenders?: string[];
    otherMortgageTotalMonthlyInterest?: number | null;
    activeLoans?: Array<{
      loanId: string;
      status: string;
      expectedCompletionDate: string;
      payoffDate: string;
      monthlyPayment: number | null;
      notes: string;
    }>;
    referral?: {
      name?: string;
      phone?: string;
      email?: string;
    };
    pastProjectsCount?: number;
  };
  conditions?: {
    submitted?: boolean;
    latestSubmittedAt?: number | null;
    creditScore?: number | null;
    proofOfLiquidityAmount?: string;
    proofOfLiquidityDocsCount?: number;
    llcDocsCount?: number;
    referral?: {
      name?: string;
      phone?: string;
      email?: string;
    };
    pastProjectsCount?: number;
    otherMortgageLoansCount?: number | null;
    otherMortgageTotalAmount?: number | null;
  };
  aiAssessment: AIAssessment;
  combinedNarrative: string;
};

export type WorkflowEventType =
  | "DOCUMENTS_VERIFIED"
  | "PROCESSING_COMPLETED"
  | "UNDERWRITING_APPROVED"
  | "FUNDING_COMPLETED";

export type WorkflowApplication = {
  id: string;
  borrowerName?: string;
  borrowerEmail?: string;
  borrowerProfile?: BorrowerProfileInfo;
  borrowerAccess?: BorrowerAccessState;
  llcName?: string;
  llcStateRecorded?: string;
  llcSameAsOnFile?: boolean;
  llcDocs?: UnderwritingLlcDoc[];
  property: string;
  type: LoanType;
  amount: number;
  currentStageIndex: number;
  createdAt: number;
  lastEventAt: number;
  history: string[];
  progress: number;
  status: string;
  currentStage: string;
  nextEvent: WorkflowEventType | null;
  stages: string[];
  preApprovalDecision?: "PENDING" | "PRE_APPROVE" | "DECLINE" | "REQUEST_INFO";
  decisionNotes?: string | null;
  communications?: WorkflowCommunication[];
  unreadBorrowerMessageCount?: number;
  purchaseDetails?: PurchaseDetails | null;
  underwritingIntake?: UnderwritingIntakeState;
  underwritingPrefill?: UnderwritingPrefill;
  underwritingSummary?: UnderwritingSummary | null;
  conditionsForm?: BorrowerConditionsFormData | null;
};

export type WorkflowCommunication = {
  id: string;
  threadId: string;
  from: "LENDER" | "BORROWER";
  channel: "PORTAL" | "EMAIL";
  type: "REQUEST_INFO" | "REPLY";
  subject?: string;
  message: string;
  attachments?: UploadedDocument[];
  createdAt: number;
  readByBorrower: boolean;
};

export type AIAssessment = {
  recommendation: "PRE_APPROVE" | "REVIEW" | "DECLINE";
  confidence: number;
  reasons: string[];
  metrics: {
    ltc?: number | null;
    arvLtv?: number | null;
    docsScore: number;
  };
};

export type LenderPipelineRecord = {
  loanId: string;
  borrower: string;
  borrowerEmail?: string;
  property: string;
  amount: number;
  statusLabel: string;
  stage: string;
  ltvLabel: string;
  preApprovalDecision: "PENDING" | "PRE_APPROVE" | "DECLINE" | "REQUEST_INFO";
  decisionNotes?: string | null;
  createdAt: number;
  type: LoanType;
  purchaseDetails?: PurchaseDetails | null;
  communications?: WorkflowCommunication[];
  aiAssessment: AIAssessment;
  valuationInput?: LenderValuationInputSnapshot;
  evaluatorInput?: LenderEvaluatorInputSnapshot;
  underwritingIntake?: UnderwritingIntakeState;
  underwritingSummary?: UnderwritingSummary | null;
  conditionsForm?: BorrowerConditionsFormData | null;
};

export type UnderwritingSettings = {
  maxLtv: number;
  maxLtc: number;
  minCreditScore: number;
  minLiquidityToLoanRatio: number;
  acceptableLiquidityRatio: number;
  excellentLiquidityRatio: number;
  maxOtherMortgageLoans: number;
  liquidityMonths: number;
  assumedAnnualInterestRate: number;
  prepaidInterestAnnualRate: number;
  perDiemDayCountBasis: number;
  monthlyServiceFee: number;
  documentPreparationFee: number;
  closingCostEstimate: number;
  originationFeePercent: number;
  estimatedOtherLenderMonthlyPaymentFactor: number;
  estimatedOtherLenderLoanFactor: number;
  shortClosingTimelineDays: number;
  declineCreditScore: number;
  declineLtv: number;
};

export type { UnderwritingCaseSummary };

const getApiBaseUrl = () => {
  const configured = (import.meta as ImportMeta & { env?: { VITE_WORKFLOW_API_BASE_URL?: string } }).env
    ?.VITE_WORKFLOW_API_BASE_URL;
  if (configured && typeof configured === "string") {
    return configured.replace(/\/$/, "");
  }
  return "";
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchWorkflowApplications() {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/applications`);
  const data = await parseJson<{ applications: WorkflowApplication[] }>(response);
  return data.applications;
}

export async function createWorkflowApplication(input: {
  property: string;
  borrowerName?: string;
  borrowerFirstName?: string;
  borrowerMiddleName?: string;
  borrowerLastName?: string;
  borrowerEmail?: string;
  llcName?: string;
  llcStateRecorded?: string;
  llcSameAsOnFile?: boolean;
  llcDocs?: UnderwritingLlcDoc[];
  type: LoanType;
  amount: number;
  purchaseDetails?: PurchaseDetails | null;
}) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ application: WorkflowApplication }>(response);
  return data.application;
}

export async function submitWorkflowApplication(input: {
  property: string;
  borrowerName?: string;
  borrowerFirstName?: string;
  borrowerMiddleName?: string;
  borrowerLastName?: string;
  borrowerEmail?: string;
  llcName?: string;
  llcStateRecorded?: string;
  llcSameAsOnFile?: boolean;
  llcDocs?: UnderwritingLlcDoc[];
  type: LoanType;
  amount: number;
  purchaseDetails?: PurchaseDetails | null;
}) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/applications/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ application: WorkflowApplication }>(response);
  return data.application;
}

export async function updateWorkflowApplication(
  applicationId: string,
  input: {
    property: string;
    borrowerName?: string;
    borrowerFirstName?: string;
    borrowerMiddleName?: string;
    borrowerLastName?: string;
    borrowerEmail?: string;
    llcName?: string;
    llcStateRecorded?: string;
    llcSameAsOnFile?: boolean;
    llcDocs?: UnderwritingLlcDoc[];
    type: LoanType;
    amount: number;
    purchaseDetails?: PurchaseDetails | null;
  }
) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/applications/${applicationId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ application: WorkflowApplication }>(response);
  return data.application;
}

export async function pushWorkflowEvent(applicationId: string, eventType: WorkflowEventType) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/applications/${applicationId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType }),
  });
  const data = await parseJson<{ application: WorkflowApplication }>(response);
  return data.application;
}

export async function fetchLenderPipeline() {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/pipeline`);
  const data = await parseJson<{ pipeline: LenderPipelineRecord[] }>(response);
  return data.pipeline;
}

export async function fetchLenderPipelineRecord(loanId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/pipeline/${loanId}`);
  const data = await parseJson<{ pipelineRecord: LenderPipelineRecord }>(response);
  return data.pipelineRecord;
}

export async function fetchLenderValuationInput(loanId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/valuation-input/${loanId}`);
  const data = await parseJson<{ valuationInput: LenderValuationInputSnapshot }>(response);
  return data.valuationInput;
}

export async function attomAutofillValuation(loanId: string, addressOverride?: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/valuation-input/${loanId}/attom-autofill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(addressOverride ? { addressOverride } : {}),
  });
  const data = await parseJson<{
    valuationInput: LenderValuationInputSnapshot;
    pipelineRecord: LenderPipelineRecord;
    attomFields: Record<string, unknown>;
    attomRaw?: Record<string, unknown> | null;
    attomParams?: Record<string, unknown> | null;
  }>(response);
  return data;
}

export async function fetchAttomSubjectProperty(input: {
  address1: string;
  city: string;
  state: string;
  zip?: string;
}): Promise<AttomSubjectPropertyResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/property/attom/subject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<AttomSubjectPropertyResponse>(response);
  return data;
}

export async function fetchRentometerSummary(params: {
  address: string;
  bedrooms: number;
  bathrooms?: string;
  building_type?: string;
  look_back_days?: number;
}) {
  const search = new URLSearchParams();
  search.set("address", params.address);
  search.set("bedrooms", String(params.bedrooms));
  if (params.bathrooms) search.set("bathrooms", params.bathrooms);
  if (params.building_type) search.set("building_type", params.building_type);
  if (params.look_back_days) search.set("look_back_days", String(params.look_back_days));
  const response = await fetch(`${getApiBaseUrl()}/api/rentometer/summary?${search.toString()}`);
  const data = await parseJson<{
    average_rent: number;
    median_rent: number | null;
    p25: number | null;
    p75: number | null;
    samples: number | null;
    quickview_url: string | null;
    warning: string | null;
  }>(response);
  return data;
}

export async function updateLenderValuationInput(
  loanId: string,
  payload: { updatedByRole: ValuationInputRole; values: Partial<ValuationInputValues> }
) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/valuation-input/${loanId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ valuationInput: LenderValuationInputSnapshot; pipelineRecord: LenderPipelineRecord }>(
    response
  );
  return data;
}

export async function fetchTitleAgentForm(loanId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/title-agent-form/${loanId}`);
  const data = await parseJson<{ form: TitleAgentFormData }>(response);
  return data.form;
}

export async function submitTitleAgentForm(loanId: string, payload: Partial<TitleAgentFormData>) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/title-agent-form/${loanId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ form: TitleAgentFormData }>(response);
  return data.form;
}

export async function fetchLenderEvaluatorInput(loanId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/evaluator-input/${loanId}`);
  const data = await parseJson<{ evaluatorInput: LenderEvaluatorInputSnapshot }>(response);
  return data.evaluatorInput;
}

export async function updateLenderEvaluatorInput(
  loanId: string,
  payload: { updatedByRole: "EVALUATOR"; values: Partial<EvaluatorInputValues> }
) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/evaluator-input/${loanId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ evaluatorInput: LenderEvaluatorInputSnapshot; pipelineRecord: LenderPipelineRecord }>(
    response
  );
  return data;
}

export async function fetchUnderwritingSummaries() {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/underwriting/summary`);
  const data = await parseJson<{ summaries: UnderwritingCaseSummary[] }>(response);
  return data.summaries;
}

export async function fetchUnderwritingSummary(loanId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/underwriting/summary/${loanId}`);
  const data = await parseJson<{ summary: UnderwritingCaseSummary }>(response);
  return data.summary;
}

export async function fetchUnderwritingSettings() {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/underwriting/settings`);
  const data = await parseJson<{ settings: UnderwritingSettings }>(response);
  return data.settings;
}

export async function updateUnderwritingSettings(payload: Partial<UnderwritingSettings>) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/underwriting/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ settings: UnderwritingSettings }>(response);
  return data.settings;
}

export async function updatePreApprovalDecision(
  loanId: string,
  decision: "PRE_APPROVE" | "DECLINE" | "REQUEST_INFO",
  notes?: string
) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/pipeline/${loanId}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, notes }),
  });
  const data = await parseJson<{ pipelineRecord: LenderPipelineRecord }>(response);
  return data.pipelineRecord;
}

export async function replyToWorkflowRequest(
  applicationId: string,
  message: string,
  attachments?: UploadedDocument[],
  threadId?: string
) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/applications/${applicationId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, attachments: attachments || [], threadId }),
  });
  const data = await parseJson<{ application: WorkflowApplication }>(response);
  return data.application;
}

export async function sendBorrowerWorkflowMessage(
  applicationId: string,
  subject: string,
  message: string,
  attachments?: UploadedDocument[]
) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/applications/${applicationId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, message, attachments: attachments || [] }),
  });
  const data = await parseJson<{ application: WorkflowApplication }>(response);
  return data.application;
}

export async function sendLenderWorkflowReply(
  loanId: string,
  message: string,
  attachments?: UploadedDocument[],
  threadId?: string
) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/pipeline/${loanId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, attachments: attachments || [], threadId }),
  });
  const data = await parseJson<{ pipelineRecord: LenderPipelineRecord }>(response);
  return data.pipelineRecord;
}

export async function addLenderPipelineComment(loanId: string, comment: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/pipeline/${loanId}/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
  const data = await parseJson<{ pipelineRecord: LenderPipelineRecord }>(response);
  return data.pipelineRecord;
}

export async function sendLenderPipelineBorrowerMessage(loanId: string, message: string, subject?: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/lender/pipeline/${loanId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject: subject || "", message }),
  });
  const data = await parseJson<{ pipelineRecord: LenderPipelineRecord }>(response);
  return data.pipelineRecord;
}

export async function submitUnderwritingIntake(
  applicationId: string,
  payload: UnderwritingIntakeData
) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/applications/${applicationId}/underwriting-intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ application: WorkflowApplication }>(response);
  return data.application;
}

export async function submitBorrowerConditionsForm(
  applicationId: string,
  payload: BorrowerConditionsFormData
) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/applications/${applicationId}/conditions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ application: WorkflowApplication }>(response);
  return data.application;
}

export async function createBorrowerAccess(
  applicationId: string,
  payload: { email: string; password: string; confirmPassword: string }
) {
  const response = await fetch(`${getApiBaseUrl()}/api/workflows/applications/${applicationId}/borrower-access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ application: WorkflowApplication }>(response);
  return data.application;
}
