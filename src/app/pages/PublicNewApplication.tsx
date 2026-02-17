import { FormEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { Link, useNavigate } from "react-router";
import {
  submitWorkflowApplication,
  type LoanType,
  type PurchaseDetails,
  type UploadedDocument,
} from "../services/workflowApi";
import {
  formatAddress,
  searchAddressSuggestions,
  type AddressSuggestion,
} from "../lib/address";
import {
  formatUsdValue,
  parseCurrencyValue,
  sanitizeCurrencyInput,
  stripCurrencyFormatting,
} from "../lib/currency";

type BorrowerUpload = Required<Pick<UploadedDocument, "name">> &
  Required<Pick<UploadedDocument, "contentType" | "dataUrl">>;

type NewApplicationForm = {
  borrowerFirstName: string;
  borrowerMiddleName: string;
  borrowerLastName: string;
  borrowerEmail: string;
  llcName: string;
  propertyStreet: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  type: LoanType;
  amount: string;
  purchasePrice: string;
  rehabBudget: string;
  arv: string;
  exitStrategy: string;
  targetClosingDate: string;
  compsFiles: BorrowerUpload[];
  propertyPhotos: BorrowerUpload[];
  purchaseContractFiles: BorrowerUpload[];
  scopeOfWorkFiles: BorrowerUpload[];
};

const initialForm: NewApplicationForm = {
  borrowerFirstName: "",
  borrowerMiddleName: "",
  borrowerLastName: "",
  borrowerEmail: "",
  llcName: "",
  propertyStreet: "",
  propertyCity: "",
  propertyState: "",
  propertyZip: "",
  type: "Fix & Flip Loan (Rehab Loan)",
  amount: "",
  purchasePrice: "",
  rehabBudget: "",
  arv: "",
  exitStrategy: "",
  targetClosingDate: "",
  compsFiles: [],
  propertyPhotos: [],
  purchaseContractFiles: [],
  scopeOfWorkFiles: [],
};

const loanTypeOptions: LoanType[] = [
  "Fix & Flip Loan (Rehab Loan)",
  "Bridge Loan",
  "Ground-Up Construction Loan",
  "Transactional Funding (Double Close / Wholesale)",
  "Land Loan",
];

const purchaseDetailLoanTypeSet = new Set<LoanType>([...loanTypeOptions, "Purchase"]);

const exitStrategyOptions = [
  "Refinance to DSCR (stabilized rental)",
  "Cash-out refinance with strong equity",
  "Fix & flip sale",
  "Portfolio / investor sale",
  "New construction sale",
] as const;

function requiresPurchaseDetails(type: LoanType) {
  return purchaseDetailLoanTypeSet.has(type);
}

type CurrencyField = "amount" | "purchasePrice" | "rehabBudget" | "arv";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function toUploadedFiles(files: FileList | null): Promise<BorrowerUpload[]> {
  if (!files) return [];
  const mapped = await Promise.all(
    Array.from(files).map(async (file) => ({
      name: file.name,
      contentType: file.type || "application/octet-stream",
      dataUrl: await readFileAsDataUrl(file),
    }))
  );
  return mapped;
}

function isPdfFile(file: File) {
  const normalizedName = file.name.trim().toLowerCase();
  const normalizedType = file.type.trim().toLowerCase();
  return normalizedType === "application/pdf" || normalizedName.endsWith(".pdf");
}

function hasNonPdfFiles(files: FileList | null) {
  if (!files) return false;
  return Array.from(files).some((file) => !isPdfFile(file));
}

function mergeBorrowerUploads(existing: BorrowerUpload[], incoming: BorrowerUpload[]) {
  const existingKeys = new Set(
    existing.map(
      (file) => `${file.name.trim().toLowerCase()}::${(file.contentType || "").trim().toLowerCase()}::${file.dataUrl || ""}`
    )
  );
  const merged = [...existing];
  for (const file of incoming) {
    const key = `${file.name.trim().toLowerCase()}::${(file.contentType || "").trim().toLowerCase()}::${file.dataUrl || ""}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    merged.push(file);
  }
  return merged;
}

function validateNewApplicationBorrowerInfo(form: NewApplicationForm) {
  if (!form.borrowerFirstName.trim()) return "First Name is required.";
  if (!form.borrowerLastName.trim()) return "Last Name is required.";
  if (!form.llcName.trim()) return "LLC Name is required.";
  if (!form.borrowerEmail.trim()) return "Email Address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.borrowerEmail.trim())) return "Enter a valid Email Address.";
  return null;
}

function validatePurchaseForm(form: NewApplicationForm) {
  const budgetLabel = form.type === "Ground-Up Construction Loan" ? "Construction Budget" : "Rehab Budget";
  if (!form.purchasePrice.trim()) return "Purchase Price is required.";
  if (!form.rehabBudget.trim()) return `${budgetLabel} is required.`;
  if (!form.arv.trim()) return "ARV is required.";
  if (form.compsFiles.length < 1) return "Please upload at least 1 COMPS file.";
  if (form.propertyPhotos.length === 0) return "Please upload photos of the property.";
  if (form.purchaseContractFiles.length === 0) return "Please upload purchase contract.";
  if (form.scopeOfWorkFiles.length === 0) return "Please upload scope of work.";
  if (!form.exitStrategy.trim()) return "Exit strategy is required.";
  if (!form.targetClosingDate) return "Target closing date is required.";
  return null;
}

function buildPurchaseDetails(form: NewApplicationForm): PurchaseDetails {
  return {
    purchasePrice: formatUsdValue(form.purchasePrice),
    rehabBudget: formatUsdValue(form.rehabBudget),
    arv: formatUsdValue(form.arv),
    compsValidationNote: "Borrower provided COMPS.",
    compsFiles: form.compsFiles,
    propertyPhotos: form.propertyPhotos,
    purchaseContractFiles: form.purchaseContractFiles,
    scopeOfWorkFiles: form.scopeOfWorkFiles,
    exitStrategy: form.exitStrategy.trim(),
    targetClosingDate: form.targetClosingDate,
  };
}

export function PublicNewApplication() {
  const navigate = useNavigate();
  const [form, setForm] = useState<NewApplicationForm>(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedLoanId, setSubmittedLoanId] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isAddressSearching, setIsAddressSearching] = useState(false);
  const searchRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      searchRequestRef.current?.abort();
    };
  }, []);

  const applyAddressSelection = (suggestion: AddressSuggestion) => {
    setForm((previous) => ({
      ...previous,
      propertyStreet: suggestion.street,
      propertyCity: suggestion.city,
      propertyState: suggestion.state,
      propertyZip: suggestion.zip,
    }));
    setAddressQuery(suggestion.label);
    setAddressSuggestions([]);
  };

  const handleAddressQueryChange = async (value: string) => {
    setAddressQuery(value);

    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setAddressSuggestions([]);
      setIsAddressSearching(false);
      searchRequestRef.current?.abort();
      searchRequestRef.current = null;
      return;
    }

    searchRequestRef.current?.abort();
    const nextController = new AbortController();
    searchRequestRef.current = nextController;

    setIsAddressSearching(true);
    try {
      const suggestions = await searchAddressSuggestions(trimmed, nextController.signal);
      if (searchRequestRef.current !== nextController) return;
      setAddressSuggestions(suggestions);
    } catch (searchError) {
      if (nextController.signal.aborted) return;
      setAddressSuggestions([]);
      setError(searchError instanceof Error ? searchError.message : "Address search failed. Please enter address manually.");
    } finally {
      if (searchRequestRef.current === nextController) {
        setIsAddressSearching(false);
      }
    }
  };

  const handleFileSelection = async (
    field: "compsFiles" | "propertyPhotos" | "purchaseContractFiles" | "scopeOfWorkFiles",
    files: FileList | null
  ) => {
    try {
      if (field === "purchaseContractFiles" && hasNonPdfFiles(files)) {
        setError("Purchase contract must be uploaded as PDF file(s).");
        return;
      }
      const uploadedFiles = await toUploadedFiles(files);
      if (uploadedFiles.length === 0) return;
      setForm((previous) => ({
        ...previous,
        [field]: mergeBorrowerUploads(previous[field] as BorrowerUpload[], uploadedFiles),
      }));
      setError(null);
    } catch {
      setError("Failed to process selected file(s). Please try again.");
    }
  };

  const handleCurrencyChange = (field: CurrencyField, value: string) => {
    setForm((previous) => ({ ...previous, [field]: sanitizeCurrencyInput(value) }));
  };

  const handleCurrencyFocus = (field: CurrencyField) => {
    setForm((previous) => ({ ...previous, [field]: stripCurrencyFormatting(previous[field]) }));
  };

  const handleCurrencyBlur = (field: CurrencyField) => {
    setForm((previous) => ({ ...previous, [field]: formatUsdValue(previous[field]) }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = parseCurrencyValue(form.amount);
    const propertyAddress = formatAddress({
      street: form.propertyStreet,
      city: form.propertyCity,
      state: form.propertyState,
      zip: form.propertyZip,
    });

    if (
      !form.propertyStreet.trim() ||
      !form.propertyCity.trim() ||
      !form.propertyState.trim() ||
      !form.propertyZip.trim() ||
      amount === null ||
      amount <= 0
    ) {
      setError("Enter street, city, state, ZIP, and a valid requested amount.");
      return;
    }

    const borrowerInfoError = validateNewApplicationBorrowerInfo(form);
    if (borrowerInfoError) {
      setError(borrowerInfoError);
      return;
    }

    if (requiresPurchaseDetails(form.type)) {
      const purchaseError = validatePurchaseForm(form);
      if (purchaseError) {
        setError(purchaseError);
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      const borrowerName = [form.borrowerFirstName, form.borrowerMiddleName, form.borrowerLastName]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" ");
      const created = await submitWorkflowApplication({
        property: propertyAddress,
        borrowerName,
        borrowerFirstName: form.borrowerFirstName.trim(),
        borrowerMiddleName: form.borrowerMiddleName.trim(),
        borrowerLastName: form.borrowerLastName.trim(),
        borrowerEmail: form.borrowerEmail.trim(),
        llcName: form.llcName.trim(),
        type: form.type,
        amount,
        purchaseDetails: requiresPurchaseDetails(form.type) ? buildPurchaseDetails(form) : null,
      });
      setSubmittedLoanId(created.id);
      setForm(initialForm);
      setAddressQuery("");
      setAddressSuggestions([]);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to submit application.");
    } finally {
      setIsSaving(false);
    }
  };

  if (submittedLoanId) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#d8f6f3_0%,_#f8fafc_45%,_#ffffff_100%)] px-4 py-8 md:py-12">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-600" />
              <div className="space-y-2">
                <p className="text-base font-semibold text-emerald-800">LOAN REQUEST SUBMITTED SUCCESSFULLY</p>
                <p className="text-sm text-slate-700">
                  Loan ID: <span className="font-semibold">{submittedLoanId}</span>
                </p>
                <p className="text-xs text-slate-600">
                  This message will stay on screen until you close it.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                onClick={() => navigate("/apply/new/submitted")}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#d8f6f3_0%,_#f8fafc_45%,_#ffffff_100%)] px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-2xl border border-primary/20 bg-white/95 p-5 shadow-sm md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Public Application</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">New Borrower Loan Application</h1>
              <p className="mt-1 text-sm text-slate-600">
                This page is separate from the borrower portal. Submit your request first. Borrower access is created
                after pre-approval.
              </p>
            </div>
            <Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" to="/apply">
              Back
            </Link>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h2 className="text-sm font-semibold text-slate-900">Borrower Information</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="First name"
                  value={form.borrowerFirstName}
                  onChange={(event) => setForm((previous) => ({ ...previous, borrowerFirstName: event.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Middle name (optional)"
                  value={form.borrowerMiddleName}
                  onChange={(event) => setForm((previous) => ({ ...previous, borrowerMiddleName: event.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Last name"
                  value={form.borrowerLastName}
                  onChange={(event) => setForm((previous) => ({ ...previous, borrowerLastName: event.target.value }))}
                />
                <input
                  type="email"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Email address"
                  value={form.borrowerEmail}
                  onChange={(event) => setForm((previous) => ({ ...previous, borrowerEmail: event.target.value }))}
                />
                <input
                  className="md:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="LLC legal name"
                  value={form.llcName}
                  onChange={(event) => setForm((previous) => ({ ...previous, llcName: event.target.value }))}
                />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h2 className="text-sm font-semibold text-slate-900">Loan Request</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-slate-900">Search Property Address</label>
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Start typing address to auto-fill"
                      value={addressQuery}
                      onChange={(event) => void handleAddressQueryChange(event.target.value)}
                    />
                  </div>
                  {isAddressSearching ? (
                    <p className="text-xs text-slate-500">Searching addresses...</p>
                  ) : null}
                  {addressSuggestions.length > 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-white">
                      {addressSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => applyAddressSelection(suggestion)}
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <input
                  className="md:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Street"
                  value={form.propertyStreet}
                  onChange={(event) => setForm((previous) => ({ ...previous, propertyStreet: event.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="City"
                  value={form.propertyCity}
                  onChange={(event) => setForm((previous) => ({ ...previous, propertyCity: event.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="State"
                  value={form.propertyState}
                  onChange={(event) => setForm((previous) => ({ ...previous, propertyState: event.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="ZIP"
                  value={form.propertyZip}
                  onChange={(event) => setForm((previous) => ({ ...previous, propertyZip: event.target.value }))}
                />

                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.type}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, type: event.target.value as LoanType }))
                  }
                >
                  {loanTypeOptions.map((loanType) => (
                    <option key={loanType} value={loanType}>
                      {loanType}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  inputMode="decimal"
                  placeholder="Requested Amount (Total Loan) - $0.00"
                  value={form.amount}
                  onChange={(event) => handleCurrencyChange("amount", event.target.value)}
                  onFocus={() => handleCurrencyFocus("amount")}
                  onBlur={() => handleCurrencyBlur("amount")}
                />
              </div>

              {requiresPurchaseDetails(form.type) ? (
                <div className="mt-6 border-t border-slate-200 pt-4">
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    inputMode="decimal"
                    placeholder="Purchase Price - $0.00"
                    value={form.purchasePrice}
                    onChange={(event) => handleCurrencyChange("purchasePrice", event.target.value)}
                    onFocus={() => handleCurrencyFocus("purchasePrice")}
                    onBlur={() => handleCurrencyBlur("purchasePrice")}
                  />
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    inputMode="decimal"
                    placeholder={
                      form.type === "Ground-Up Construction Loan"
                        ? "Construction Budget - $0.00"
                        : "Rehab Budget - $0.00"
                    }
                    value={form.rehabBudget}
                    onChange={(event) => handleCurrencyChange("rehabBudget", event.target.value)}
                    onFocus={() => handleCurrencyFocus("rehabBudget")}
                    onBlur={() => handleCurrencyBlur("rehabBudget")}
                  />
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    inputMode="decimal"
                    placeholder="ARV - $0.00"
                    value={form.arv}
                    onChange={(event) => handleCurrencyChange("arv", event.target.value)}
                    onFocus={() => handleCurrencyFocus("arv")}
                    onBlur={() => handleCurrencyBlur("arv")}
                  />
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.exitStrategy}
                    onChange={(event) => setForm((previous) => ({ ...previous, exitStrategy: event.target.value }))}
                  >
                    <option value="">Select exit strategy</option>
                    {exitStrategyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    {form.exitStrategy &&
                    !exitStrategyOptions.includes(form.exitStrategy as (typeof exitStrategyOptions)[number]) ? (
                      <option value={form.exitStrategy}>{form.exitStrategy}</option>
                    ) : null}
                  </select>
                  <input
                    type="date"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.targetClosingDate}
                    onChange={(event) => setForm((previous) => ({ ...previous, targetClosingDate: event.target.value }))}
                  />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label
                    className={`rounded-lg border-2 border-dashed px-3 py-3 text-sm transition-colors ${
                      form.compsFiles.length > 0 ? "border-emerald-500 bg-emerald-50/60" : "border-primary/45 bg-white"
                    }`}
                  >
                    <span className="block text-xs font-semibold uppercase tracking-wide text-primary">COMPS (required)</span>
                    <input
                      type="file"
                      multiple
                      className="mt-2 block w-full text-sm file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:font-medium file:text-white hover:file:bg-primary/90"
                      onChange={(event) => void handleFileSelection("compsFiles", event.target.files)}
                    />
                    {form.compsFiles.length > 0 ? (
                      <span className="mt-2 block text-xs font-semibold text-emerald-700">
                        Uploaded: {form.compsFiles.length} file(s).
                      </span>
                    ) : (
                      <span className="mt-2 block text-xs text-slate-500">No files uploaded yet.</span>
                    )}
                  </label>

                  <label
                    className={`rounded-lg border-2 border-dashed px-3 py-3 text-sm transition-colors ${
                      form.propertyPhotos.length > 0
                        ? "border-emerald-500 bg-emerald-50/60"
                        : "border-primary/45 bg-white"
                    }`}
                  >
                    <span className="block text-xs font-semibold uppercase tracking-wide text-primary">Property photos (required)</span>
                    <input
                      type="file"
                      multiple
                      className="mt-2 block w-full text-sm file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:font-medium file:text-white hover:file:bg-primary/90"
                      onChange={(event) => void handleFileSelection("propertyPhotos", event.target.files)}
                    />
                    {form.propertyPhotos.length > 0 ? (
                      <span className="mt-2 block text-xs font-semibold text-emerald-700">
                        Uploaded: {form.propertyPhotos.length} file(s).
                      </span>
                    ) : (
                      <span className="mt-2 block text-xs text-slate-500">No files uploaded yet.</span>
                    )}
                  </label>

                  <label
                    className={`rounded-lg border-2 border-dashed px-3 py-3 text-sm transition-colors ${
                      form.purchaseContractFiles.length > 0
                        ? "border-emerald-500 bg-emerald-50/60"
                        : "border-primary/45 bg-white"
                    }`}
                  >
                    <span className="block text-xs font-semibold uppercase tracking-wide text-primary">
                      Purchase contract (required, PDF only)
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,application/pdf"
                      className="mt-2 block w-full text-sm file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:font-medium file:text-white hover:file:bg-primary/90"
                      onChange={(event) => void handleFileSelection("purchaseContractFiles", event.target.files)}
                    />
                    {form.purchaseContractFiles.length > 0 ? (
                      <span className="mt-2 block text-xs font-semibold text-emerald-700">
                        Uploaded: {form.purchaseContractFiles.length} PDF file(s).
                      </span>
                    ) : (
                      <span className="mt-2 block text-xs text-slate-500">No files uploaded yet.</span>
                    )}
                  </label>

                  <label
                    className={`rounded-lg border-2 border-dashed px-3 py-3 text-sm transition-colors ${
                      form.scopeOfWorkFiles.length > 0
                        ? "border-emerald-500 bg-emerald-50/60"
                        : "border-primary/45 bg-white"
                    }`}
                  >
                    <span className="block text-xs font-semibold uppercase tracking-wide text-primary">Scope of work (required)</span>
                    <input
                      type="file"
                      multiple
                      className="mt-2 block w-full text-sm file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:font-medium file:text-white hover:file:bg-primary/90"
                      onChange={(event) => void handleFileSelection("scopeOfWorkFiles", event.target.files)}
                    />
                    {form.scopeOfWorkFiles.length > 0 ? (
                      <span className="mt-2 block text-xs font-semibold text-emerald-700">
                        Uploaded: {form.scopeOfWorkFiles.length} file(s).
                      </span>
                    ) : (
                      <span className="mt-2 block text-xs text-slate-500">No files uploaded yet.</span>
                    )}
                  </label>
                </div>
                </div>
              ) : null}
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50" to="/apply">
                Cancel
              </Link>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                {isSaving ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
