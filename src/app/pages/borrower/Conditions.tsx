import { CheckCircle2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "../../components/ui/button";
import {
  fetchWorkflowApplications,
  submitBorrowerConditionsForm,
  type BorrowerConditionsFormData,
  type BorrowerConditionsLiquidityDoc,
  type UploadedDocument,
  type UnderwritingLlcDoc,
  type WorkflowApplication,
} from "../../services/workflowApi";

type UploadedFile = Required<Pick<UploadedDocument, "name" | "contentType" | "dataUrl">>;

type ConditionsPastProject = BorrowerConditionsFormData["pastProjects"][number];
const requiredLlcConditionDocs = [
  { docType: "EIN", label: "EIN" },
  { docType: "CERTIFICATE_OF_GOOD_STANDING", label: "Certificate of Good Standing" },
  { docType: "OPERATING_AGREEMENT", label: "Operating Agreement" },
  { docType: "ARTICLES_OF_ORGANIZATION", label: "Articles of Organization" },
] as const;
type RequiredLlcConditionDocType = (typeof requiredLlcConditionDocs)[number]["docType"];
const proofOfLiquidityDocumentOptions = [
  {
    category: "BANK_STATEMENTS",
    label: "Bank statements",
    subcategories: [
      { value: "CHECKING_ACCOUNTS", label: "Checking accounts" },
      { value: "SAVINGS_ACCOUNTS", label: "Savings accounts" },
      { value: "MONEY_MARKET_ACCOUNTS", label: "Money market accounts" },
    ],
  },
  {
    category: "BROKERAGE_INVESTMENT_ACCOUNTS",
    label: "Brokerage / investment accounts",
    subcategories: [
      { value: "STOCKS", label: "Stocks" },
      { value: "ETFS", label: "ETFs" },
      { value: "MUTUAL_FUNDS", label: "Mutual funds" },
    ],
  },
  {
    category: "RETIREMENT_ACCOUNTS",
    label: "Retirement accounts",
    subcategories: [
      { value: "RETIREMENT_401K", label: "401(k)" },
      { value: "RETIREMENT_IRA", label: "IRA" },
      { value: "RETIREMENT_ROTH_IRA", label: "Roth IRA" },
      { value: "BONDS", label: "Bonds" },
    ],
  },
  {
    category: "LINES_OF_CREDIT_UNUSED",
    label: "Lines of credit (unused portion)",
    subcategories: [
      { value: "HELOC", label: "HELOC" },
      { value: "BUSINESS_LINE_OF_CREDIT", label: "Business line of credit" },
      { value: "MARGIN_ACCOUNT", label: "Margin account" },
    ],
  },
  {
    category: "CRYPTOCURRENCY",
    label: "Cryptocurrency",
    subcategories: [
      { value: "BITCOIN", label: "Bitcoin" },
      { value: "ETHEREUM", label: "Ethereum" },
      { value: "STABLECOINS", label: "Stablecoins" },
    ],
  },
  {
    category: "CASH_VALUE_LIFE_INSURANCE",
    label: "Cash value life insurance",
    subcategories: [{ value: "BORROWABLE_POLICY_VALUE", label: "Borrow against policy value" }],
  },
] as const;
type ProofOfLiquidityCategory = (typeof proofOfLiquidityDocumentOptions)[number]["category"];
type ProofOfLiquiditySubcategory =
  (typeof proofOfLiquidityDocumentOptions)[number]["subcategories"][number]["value"];

const emptyConditionsForm: BorrowerConditionsFormData = {
  creditScore: null,
  proofOfLiquidityAmount: "",
  proofOfLiquidityDocs: [],
  desktopAppraisalValue: "",
  desktopAppraisalDocs: [],
  llcDocs: [],
  referral: {
    name: "",
    email: "",
    phone: "",
  },
  pastProjects: [{ propertyAddress: "", photos: [] }],
  otherMortgageLoansCount: null,
  otherMortgageTotalAmount: "",
  submittedAt: null,
  updatedAt: null,
};
const proofOfLiquidityCategoryMap: Map<string, (typeof proofOfLiquidityDocumentOptions)[number]> = new Map(
  proofOfLiquidityDocumentOptions.map((option) => [option.category, option])
);
const defaultProofOfLiquidityCategory = proofOfLiquidityDocumentOptions[0].category;
const defaultProofOfLiquiditySubcategory = proofOfLiquidityDocumentOptions[0].subcategories[0].value;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function toUploadedFiles(files: FileList | null): Promise<UploadedFile[]> {
  if (!files) return [];
  return Promise.all(
    Array.from(files).map(async (file) => ({
      name: file.name,
      contentType: file.type || "application/octet-stream",
      dataUrl: await readFileAsDataUrl(file),
    }))
  );
}

function normalizeUploadedDocuments(input: UploadedDocument[] | null | undefined) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((file) => file && typeof file === "object")
    .filter((file) => typeof file.name === "string" && file.name.trim())
    .filter((file) => typeof file.dataUrl === "string" && file.dataUrl.startsWith("data:"))
    .map((file) => ({
      name: file.name,
      contentType: file.contentType || "application/octet-stream",
      dataUrl: file.dataUrl,
    }));
}

function normalizeProofOfLiquidityDocs(input: BorrowerConditionsLiquidityDoc[] | null | undefined) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((file) => file && typeof file === "object")
    .filter((file) => typeof file.name === "string" && file.name.trim())
    .filter((file) => typeof file.dataUrl === "string" && file.dataUrl.startsWith("data:"))
    .map((file) => {
      const category = typeof file.category === "string" ? file.category : "";
      const categoryOption = proofOfLiquidityCategoryMap.get(category);
      const subcategory = typeof file.subcategory === "string" ? file.subcategory : "";
      const subcategoryOption = categoryOption?.subcategories.find((item) => item.value === subcategory);
      return {
        name: file.name,
        contentType: file.contentType || "application/octet-stream",
        dataUrl: file.dataUrl,
        category: categoryOption ? categoryOption.category : "",
        subcategory: subcategoryOption ? subcategoryOption.value : "",
      };
    });
}

function normalizeLlcDocs(input: UnderwritingLlcDoc[] | null | undefined) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((file) => file && typeof file === "object")
    .filter((file) => typeof file.name === "string" && file.name.trim())
    .filter((file) => typeof file.dataUrl === "string" && file.dataUrl.startsWith("data:"))
    .map((file) => ({
      name: file.name,
      contentType: file.contentType || "application/octet-stream",
      dataUrl: file.dataUrl,
      docType: typeof file.docType === "string" ? file.docType : "OTHER",
    }));
}

function normalizePastProjects(input: ConditionsPastProject[] | null | undefined) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((project) => project && typeof project === "object")
    .map((project) => ({
      propertyAddress: typeof project.propertyAddress === "string" ? project.propertyAddress : "",
      photos: normalizeUploadedDocuments(project.photos),
    }));
}

function normalizeConditionsForm(input: BorrowerConditionsFormData | null | undefined): BorrowerConditionsFormData {
  const source = input && typeof input === "object" ? input : emptyConditionsForm;
  const creditScore = Number(source.creditScore);
  const otherMortgageLoansCount = Number(source.otherMortgageLoansCount);

  return {
    creditScore: Number.isFinite(creditScore) && creditScore > 0 ? Math.round(creditScore) : null,
    proofOfLiquidityAmount:
      typeof source.proofOfLiquidityAmount === "string" ? source.proofOfLiquidityAmount : "",
    proofOfLiquidityDocs: normalizeProofOfLiquidityDocs(source.proofOfLiquidityDocs),
    desktopAppraisalValue:
      typeof source.desktopAppraisalValue === "string" ? source.desktopAppraisalValue : "",
    desktopAppraisalDocs: normalizeUploadedDocuments(source.desktopAppraisalDocs),
    llcDocs: normalizeLlcDocs(source.llcDocs),
    referral: {
      name: typeof source.referral?.name === "string" ? source.referral.name : "",
      email: typeof source.referral?.email === "string" ? source.referral.email : "",
      phone: typeof source.referral?.phone === "string" ? source.referral.phone : "",
    },
    pastProjects: normalizePastProjects(source.pastProjects).length
      ? normalizePastProjects(source.pastProjects)
      : [{ propertyAddress: "", photos: [] }],
    otherMortgageLoansCount:
      Number.isFinite(otherMortgageLoansCount) && otherMortgageLoansCount >= 0
        ? Math.floor(otherMortgageLoansCount)
        : null,
    otherMortgageTotalAmount:
      typeof source.otherMortgageTotalAmount === "string" ? source.otherMortgageTotalAmount : "",
    submittedAt: typeof source.submittedAt === "number" ? source.submittedAt : null,
    updatedAt: typeof source.updatedAt === "number" ? source.updatedAt : null,
  };
}

function getRequiredLlcConditionDoc(
  llcDocs: UnderwritingLlcDoc[] | null | undefined,
  docType: RequiredLlcConditionDocType
) {
  if (!Array.isArray(llcDocs)) return null;
  return llcDocs.find((doc) => doc.docType === docType) || null;
}

function getProofOfLiquidityCategoryOption(category: string | null | undefined) {
  if (typeof category !== "string") return null;
  return proofOfLiquidityCategoryMap.get(category) || null;
}

function getProofOfLiquidityDocTag(doc: BorrowerConditionsLiquidityDoc) {
  const categoryOption = getProofOfLiquidityCategoryOption(doc.category);
  if (!categoryOption) return "Category not selected";
  const subcategoryOption = categoryOption.subcategories.find((item) => item.value === doc.subcategory);
  if (!subcategoryOption) return `${categoryOption.label} / Subcategory not selected`;
  return `${categoryOption.label} / ${subcategoryOption.label}`;
}

function hasSavedConditions(form: BorrowerConditionsFormData | null | undefined) {
  if (!form) return false;
  return Boolean(
    form.submittedAt ||
      form.updatedAt ||
      form.creditScore ||
      form.proofOfLiquidityAmount ||
      form.proofOfLiquidityDocs.length ||
      form.llcDocs.length ||
      form.referral.name ||
      form.referral.email ||
      form.referral.phone ||
      form.desktopAppraisalValue ||
      form.desktopAppraisalDocs.length ||
      form.pastProjects.some((project) => project.propertyAddress || project.photos.length) ||
      form.otherMortgageLoansCount !== null ||
      form.otherMortgageTotalAmount
  );
}

function buildInitialConditionsForm(application: WorkflowApplication | null): BorrowerConditionsFormData {
  if (!application) return normalizeConditionsForm(emptyConditionsForm);
  const saved = normalizeConditionsForm(application.conditionsForm);
  if (hasSavedConditions(saved)) return saved;

  const continuation = application.underwritingIntake?.formData;
  const fallbackFromContinuation: BorrowerConditionsFormData = {
    ...emptyConditionsForm,
    creditScore: Number.isFinite(Number(continuation?.creditScore)) ? Number(continuation?.creditScore) : null,
    proofOfLiquidityAmount:
      typeof continuation?.proofOfLiquidityAmount === "string" ? continuation.proofOfLiquidityAmount : "",
    proofOfLiquidityDocs: Array.isArray(continuation?.borrowerProfile?.liquidityProofDocs)
      ? continuation.borrowerProfile.liquidityProofDocs
      : [],
    desktopAppraisalValue: "",
    desktopAppraisalDocs: [],
    llcDocs: Array.isArray(continuation?.llcDocs) ? continuation.llcDocs : [],
    referral: {
      name: typeof continuation?.referral?.name === "string" ? continuation.referral.name : "",
      email: typeof continuation?.referral?.email === "string" ? continuation.referral.email : "",
      phone: typeof continuation?.referral?.phone === "string" ? continuation.referral.phone : "",
    },
    pastProjects: Array.isArray(continuation?.pastProjects)
      ? continuation.pastProjects.map((project) => ({
          propertyAddress: typeof project.propertyName === "string" ? project.propertyName : "",
          photos: project.photo ? [project.photo] : [],
        }))
      : emptyConditionsForm.pastProjects,
    otherMortgageLoansCount: Number.isFinite(Number(continuation?.otherMortgageLoansCount))
      ? Number(continuation?.otherMortgageLoansCount)
      : null,
    otherMortgageTotalAmount: Number.isFinite(Number(continuation?.otherMortgageTotalMonthlyInterest))
      ? String(continuation?.otherMortgageTotalMonthlyInterest)
      : "",
  };

  return normalizeConditionsForm(fallbackFromContinuation);
}

function formatDateTime(timestamp: number | null | undefined) {
  if (!timestamp || !Number.isFinite(Number(timestamp))) return "N/A";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Conditions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLoanId = searchParams.get("loanId")?.trim() || "";

  const [applications, setApplications] = useState<WorkflowApplication[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [form, setForm] = useState<BorrowerConditionsFormData>(() => normalizeConditionsForm(emptyConditionsForm));
  const [proofOfLiquidityCategory, setProofOfLiquidityCategory] = useState<ProofOfLiquidityCategory>(
    defaultProofOfLiquidityCategory
  );
  const [proofOfLiquiditySubcategory, setProofOfLiquiditySubcategory] = useState<ProofOfLiquiditySubcategory | "">(
    defaultProofOfLiquiditySubcategory
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadApplications() {
      setIsLoading(true);
      setError(null);
      try {
        const nextApplications = await fetchWorkflowApplications();
        if (!mounted) return;
        setApplications(nextApplications);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load conditions form context.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadApplications();
    return () => {
      mounted = false;
    };
  }, []);

  const conditionEligibleApplications = useMemo(
    () =>
      applications.filter(
        (application) => application.underwritingIntake?.status === "SUBMITTED" || Boolean(application.conditionsForm?.submittedAt)
      ),
    [applications]
  );

  useEffect(() => {
    if (conditionEligibleApplications.length === 0) {
      setSelectedLoanId("");
      return;
    }

    const requestedExists = requestedLoanId
      ? conditionEligibleApplications.some((application) => application.id === requestedLoanId)
      : false;
    const fallbackId = requestedExists ? requestedLoanId : conditionEligibleApplications[0].id;

    setSelectedLoanId((previous) =>
      conditionEligibleApplications.some((application) => application.id === previous) ? previous : fallbackId
    );
  }, [conditionEligibleApplications, requestedLoanId]);

  const selectedApplication = useMemo(
    () => conditionEligibleApplications.find((application) => application.id === selectedLoanId) || null,
    [conditionEligibleApplications, selectedLoanId]
  );
  const selectedProofOfLiquidityCategoryOption = useMemo(
    () =>
      getProofOfLiquidityCategoryOption(proofOfLiquidityCategory) ||
      proofOfLiquidityDocumentOptions[0],
    [proofOfLiquidityCategory]
  );

  useEffect(() => {
    setForm(buildInitialConditionsForm(selectedApplication));
    setProofOfLiquidityCategory(defaultProofOfLiquidityCategory);
    setProofOfLiquiditySubcategory(defaultProofOfLiquiditySubcategory);
    setError(null);
    setSuccess(null);
  }, [selectedApplication?.id]);

  const handleLoanSelection = (loanId: string) => {
    setSelectedLoanId(loanId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("loanId", loanId);
    nextParams.set("fromApp", "1");
    setSearchParams(nextParams);
  };

  const handleProofOfLiquidityDocs = async (files: FileList | null) => {
    try {
      const uploaded = await toUploadedFiles(files);
      if (uploaded.length === 0) return;
      const categoryOption = getProofOfLiquidityCategoryOption(proofOfLiquidityCategory);
      if (!categoryOption) {
        setError("Select a proof of liquidity category before uploading.");
        return;
      }
      const subcategoryOption = categoryOption.subcategories.find(
        (item) => item.value === proofOfLiquiditySubcategory
      );
      if (!subcategoryOption) {
        setError("Select a valid proof of liquidity subcategory before uploading.");
        return;
      }
      setForm((previous) => ({
        ...previous,
        proofOfLiquidityDocs: [
          ...previous.proofOfLiquidityDocs,
          ...uploaded.map((file) => ({
            ...file,
            category: categoryOption.category,
            subcategory: subcategoryOption.value,
          })),
        ],
      }));
      setError(null);
    } catch {
      setError("Failed to process proof of liquidity file(s).");
    }
  };

  const handleDesktopAppraisalDocs = async (files: FileList | null) => {
    try {
      const uploaded = await toUploadedFiles(files);
      const pdfsOnly = uploaded.filter((file) => file.contentType?.includes("pdf"));
      if (pdfsOnly.length === 0) {
        setError("Please upload a PDF for the desktop appraisal.");
        return;
      }
      setForm((previous) => ({
        ...previous,
        desktopAppraisalDocs: [...previous.desktopAppraisalDocs, ...pdfsOnly],
      }));
      setError(null);
    } catch {
      setError("Failed to process desktop appraisal file.");
    }
  };

  const removeDesktopAppraisalDoc = (index: number) => {
    setForm((previous) => ({
      ...previous,
      desktopAppraisalDocs: previous.desktopAppraisalDocs.filter((_, docIndex) => docIndex !== index),
    }));
  };

  const handleProofOfLiquidityCategoryChange = (value: string) => {
    const categoryOption = getProofOfLiquidityCategoryOption(value);
    if (!categoryOption) return;
    setProofOfLiquidityCategory(categoryOption.category);
    setProofOfLiquiditySubcategory(categoryOption.subcategories[0]?.value || "");
  };

  const removeProofOfLiquidityDoc = (index: number) => {
    setForm((previous) => ({
      ...previous,
      proofOfLiquidityDocs: previous.proofOfLiquidityDocs.filter((_, docIndex) => docIndex !== index),
    }));
  };

  const handleRequiredLlcDocUpload = async (docType: RequiredLlcConditionDocType, files: FileList | null) => {
    try {
      const uploaded = await toUploadedFiles(files);
      if (uploaded.length === 0) return;
      const [nextFile] = uploaded;
      setForm((previous) => ({
        ...previous,
        llcDocs: [
          ...previous.llcDocs.filter((doc) => doc.docType !== docType),
          {
            ...nextFile,
            docType,
          },
        ],
      }));
      setError(null);
    } catch {
      setError("Failed to process LLC document file(s).");
    }
  };

  const handlePastProjectPhotos = async (index: number, files: FileList | null) => {
    try {
      const uploaded = await toUploadedFiles(files);
      if (uploaded.length === 0) return;
      setForm((previous) => ({
        ...previous,
        pastProjects: previous.pastProjects.map((project, projectIndex) =>
          projectIndex === index
            ? {
                ...project,
                photos: [...project.photos, ...uploaded],
              }
            : project
        ),
      }));
      setError(null);
    } catch {
      setError("Failed to process past project photo(s).");
    }
  };

  const handleSubmit = async () => {
    if (!selectedApplication) {
      setError("Select a loan before submitting conditions.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await submitBorrowerConditionsForm(selectedApplication.id, {
        ...form,
        referral: {
          name: form.referral.name.trim(),
          email: form.referral.email.trim(),
          phone: form.referral.phone.trim(),
        },
        pastProjects: form.pastProjects.map((project) => ({
          propertyAddress: project.propertyAddress.trim(),
          photos: project.photos,
        })),
      });
      setApplications((previous) =>
        previous.map((application) => (application.id === updated.id ? updated : application))
      );
      const nextForm = buildInitialConditionsForm(updated);
      setForm(nextForm);
      setSuccess(`Conditions form submitted on ${formatDateTime(nextForm.updatedAt || nextForm.submittedAt)}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit conditions form.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading conditions form...
        </div>
      </div>
    );
  }

  if (conditionEligibleApplications.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Conditions form unlocks after underwriting form submission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section id="form" className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Conditions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the required conditions package for underwriting review.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">Loan</span>
            <select
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              value={selectedApplication?.id || ""}
              onChange={(event) => handleLoanSelection(event.target.value)}
            >
              {conditionEligibleApplications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.id} - {application.property}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest conditions update</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {formatDateTime(form.updatedAt || form.submittedAt)}
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        ) : null}

        {success ? (
          <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">Credit Score</span>
            <input
              type="number"
              min={300}
              max={900}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              value={form.creditScore ?? ""}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  creditScore: event.target.value ? Number(event.target.value) : null,
                }))
              }
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">Proof of Liquidity Amount</span>
            <input
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              placeholder="e.g. 250000"
              value={form.proofOfLiquidityAmount}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  proofOfLiquidityAmount: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div id="liquidity" className="grid gap-4">
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Proof of Liquidity Documents</p>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  form.proofOfLiquidityDocs.length > 0
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {form.proofOfLiquidityDocs.length} uploaded
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Select the category and subcategory for each upload.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Category</span>
                <select
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  value={proofOfLiquidityCategory}
                  onChange={(event) => handleProofOfLiquidityCategoryChange(event.target.value)}
                >
                  {proofOfLiquidityDocumentOptions.map((option) => (
                    <option key={option.category} value={option.category}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Subcategory</span>
                <select
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  value={proofOfLiquiditySubcategory}
                  onChange={(event) =>
                    setProofOfLiquiditySubcategory(event.target.value as ProofOfLiquiditySubcategory)
                  }
                >
                  {selectedProofOfLiquidityCategoryOption.subcategories.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Upload Documents</span>
                <input
                  id="proof-liquidity-upload"
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(event) => void handleProofOfLiquidityDocs(event.target.files)}
                />
                <label
                  htmlFor="proof-liquidity-upload"
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#0d3b66] bg-[#0d3b66] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0b3258]"
                >
                  <Upload size={14} />
                  Upload Documents
                </label>
                <p className="mt-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Uploading as: {selectedProofOfLiquidityCategoryOption.label} /{" "}
                  {selectedProofOfLiquidityCategoryOption.subcategories.find(
                    (option) => option.value === proofOfLiquiditySubcategory
                  )?.label || "Select subcategory"}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{form.proofOfLiquidityDocs.length} file(s) uploaded</p>
            {form.proofOfLiquidityDocs.length > 0 ? (
              <div className="space-y-2">
                {form.proofOfLiquidityDocs.map((doc, index) => (
                  <div
                    key={`proof-of-liquidity-${doc.name}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{getProofOfLiquidityDocTag(doc)}</p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => removeProofOfLiquidityDoc(index)}
                    >
                      <Trash2 size={12} />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-sm font-medium">Desktop Appraisal</p>
            <p className="text-xs text-muted-foreground">
              Upload the desktop appraisal (PDF) and enter the appraised value provided.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block md:col-span-1">
                <span className="mb-1 block text-xs text-muted-foreground">Appraisal Value</span>
                <input
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  placeholder="e.g. 250000"
                  value={form.desktopAppraisalValue}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, desktopAppraisalValue: event.target.value }))
                  }
                />
              </label>
              <div className="md:col-span-2 space-y-2">
                <span className="mb-1 block text-xs text-muted-foreground">Upload Appraisal (PDF)</span>
                <input
                  id="desktop-appraisal-upload"
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="sr-only"
                  onChange={(event) => void handleDesktopAppraisalDocs(event.target.files)}
                />
                <label
                  htmlFor="desktop-appraisal-upload"
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#0d3b66] bg-[#0d3b66] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0b3258]"
                >
                  <Upload size={14} />
                  Upload PDF
                </label>
                <p className="text-xs text-muted-foreground">
                  PDFs only. You can upload multiple appraisal pages if needed.
                </p>
                {form.desktopAppraisalDocs.length > 0 ? (
                  <div className="space-y-2">
                    {form.desktopAppraisalDocs.map((doc, index) => (
                      <div
                        key={`${doc.name}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
                      >
                        <span className="truncate">{doc.name}</span>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                          onClick={() => removeDesktopAppraisalDoc(index)}
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No appraisal uploaded yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-sm font-medium">LLC Documents</p>
            <p className="text-xs text-muted-foreground">
              Upload all required files: EIN, Certificate of Good Standing, Operating Agreement, and Articles of
              Organization.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {requiredLlcConditionDocs.map(({ docType, label }) => {
                const uploadedDoc = getRequiredLlcConditionDoc(form.llcDocs, docType);
                const uploadInputId = `llc-doc-${docType.toLowerCase()}`;
                return (
                  <div key={docType} className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                          uploadedDoc ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {uploadedDoc ? "Uploaded" : "Pending"}
                      </span>
                    </div>
                    <input
                      id={uploadInputId}
                      type="file"
                      className="sr-only"
                      onChange={(event) => void handleRequiredLlcDocUpload(docType, event.target.files)}
                    />
                    <label
                      htmlFor={uploadInputId}
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#0d3b66] bg-[#0d3b66] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0b3258]"
                    >
                      <Upload size={14} />
                      Upload {label}
                    </label>
                    <p className="mt-2 text-xs text-muted-foreground truncate">
                      {uploadedDoc ? `Uploaded: ${uploadedDoc.name}` : "No file uploaded yet."}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3">
          <p className="text-sm font-medium">Referral Information</p>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
              placeholder="Referral Name"
              value={form.referral.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  referral: {
                    ...previous.referral,
                    name: event.target.value,
                  },
                }))
              }
            />
            <input
              type="email"
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
              placeholder="Referral Email"
              value={form.referral.email}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  referral: {
                    ...previous.referral,
                    email: event.target.value,
                  },
                }))
              }
            />
            <input
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
              placeholder="Referral Phone"
              value={form.referral.phone}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  referral: {
                    ...previous.referral,
                    phone: event.target.value,
                  },
                }))
              }
            />
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Past Projects (Property Address and Photos)</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setForm((previous) => ({
                  ...previous,
                  pastProjects: [...previous.pastProjects, { propertyAddress: "", photos: [] }],
                }))
              }
            >
              <Plus size={14} className="mr-1" />
              Add Project
            </Button>
          </div>

          {form.pastProjects.map((project, index) => (
            <div key={`project-${index}`} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Project {index + 1}</p>
                {form.pastProjects.length > 1 ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        pastProjects: previous.pastProjects.filter((_, projectIndex) => projectIndex !== index),
                      }))
                    }
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                ) : null}
              </div>
              <input
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                placeholder="Property Address"
                value={project.propertyAddress}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    pastProjects: previous.pastProjects.map((item, projectIndex) =>
                      projectIndex === index
                        ? {
                            ...item,
                            propertyAddress: event.target.value,
                          }
                        : item
                    ),
                  }))
                }
              />
              <div className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Upload Photos</span>
                <input
                  id={`past-project-photos-${index}`}
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(event) => void handlePastProjectPhotos(index, event.target.files)}
                />
                <label
                  htmlFor={`past-project-photos-${index}`}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#0d3b66] bg-[#0d3b66] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0b3258]"
                >
                  <Upload size={14} />
                  Upload Project Photos
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {project.photos.length > 0 ? `${project.photos.length} photo(s) uploaded` : "No photos uploaded yet."}
                </p>
                {project.photos.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {project.photos.map((photo, photoIndex) => (
                      <p
                        key={`project-photo-${index}-${photo.name}-${photoIndex}`}
                        className="truncate text-xs text-success"
                      >
                        Uploaded: {photo.name}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">Current Mortgage Loans with Other Lenders (Count)</span>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              value={form.otherMortgageLoansCount ?? ""}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  otherMortgageLoansCount: event.target.value ? Number(event.target.value) : null,
                }))
              }
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">Current Mortgage Loans with Other Lenders (Total Amount)</span>
            <input
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              placeholder="e.g. 500000"
              value={form.otherMortgageTotalAmount}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  otherMortgageTotalAmount: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div id="submit" className="flex justify-end">
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSaving || !selectedApplication}>
            {isSaving ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Conditions Form"
            )}
          </Button>
        </div>
      </section>
    </div>
  );
}
