import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { StatusBadge } from "./StatusBadge";
import {
  fetchLenderPipeline,
  updateLenderValuationInput,
  type LenderPipelineRecord,
  type ValuationInputRole,
  type ValuationInputValues,
  fetchAttomSubjectProperty,
  type AttomSubjectPropertyResponse,
  fetchRentometerSummary,
} from "../services/workflowApi";

const underwritingStatuses = new Set(["In-underwriting", "UW for Review", "Under Review"]);

const valuationFields: Array<{ key: keyof ValuationInputValues; label: string; placeholder: string; optional?: boolean }> = [
  { key: "assessorValue", label: "Assessor Value / Total Market Value", placeholder: "e.g. 245000" },
  { key: "attomAvmValue", label: "AVM (ATTOM)", placeholder: "e.g. 245000", optional: true },
  { key: "zillowValue", label: "Zillow Value", placeholder: "e.g. 252000" },
  { key: "realtorComValue", label: "Realtor.com Value", placeholder: "e.g. 249500" },
  { key: "narprValue", label: "NARRPR Value", placeholder: "e.g. 251000" },
  { key: "propelioMedianValue", label: "Propelio Median Value", placeholder: "e.g. 250000" },
  { key: "propelioHighValue", label: "Propelio High Value", placeholder: "e.g. 263000" },
  { key: "propelioLowValue", label: "Propelio Low Value", placeholder: "e.g. 236000" },
  { key: "economicValue", label: "Economic Value", placeholder: "e.g. 248000" },
  { key: "rentometerEstimate", label: "Rentometer Estimate", placeholder: "e.g. 2150" },
  { key: "zillowRentEstimate", label: "Zillow Rent Estimate", placeholder: "e.g. 2200" },
  { key: "currentOwner", label: "Current Owner", placeholder: "e.g. Jane Smith" },
  { key: "lastSaleDate", label: "Last Sale Date", placeholder: "e.g. 2021-08-15" },
  { key: "lastSalePrice", label: "Last Sale Price", placeholder: "e.g. 275000" },
  { key: "bankruptcyRecord", label: "Bankruptcy Record", placeholder: "e.g. No record / Chapter 7 in 2019" },
  { key: "internalWatchlist", label: "Internal Watchlist", placeholder: "e.g. Clear / Flagged - reason" },
  { key: "forecasaStatus", label: "Forecasa Status", placeholder: "e.g. No negative remark / Foreclosure filing noted" },
  { key: "activeLoansCount", label: "Number of Active Loans", placeholder: "e.g. 2" },
  {
    key: "negativeDeedRecords",
    label: "Register of Deeds - High-Risk Negative Records",
    placeholder:
      "Foreclosure filings, tax liens, civil judgments, mechanic's liens, recent/multiple bankruptcies, etc.",
  },
];

const emptyValuationValues: ValuationInputValues = {
  assessorValue: "",
  attomAvmValue: "",
  zillowValue: "",
  realtorComValue: "",
  narprValue: "",
  propelioMedianValue: "",
  propelioHighValue: "",
  propelioLowValue: "",
  economicValue: "",
  rentometerEstimate: "",
  zillowRentEstimate: "",
  currentOwner: "",
  lastSaleDate: "",
  lastSalePrice: "",
  bankruptcyRecord: "",
  internalWatchlist: "",
  forecasaStatus: "",
  activeLoansCount: "",
  negativeDeedRecords: "",
};

function readValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function getStatusVariant(status: string) {
  if (status === "In-underwriting") return "warning" as const;
  if (status === "UW for Review") return "info" as const;
  if (status === "Under Review") return "info" as const;
  if (status === "Approved") return "success" as const;
  return "default" as const;
}

function valuesFromRecord(record: LenderPipelineRecord | null): ValuationInputValues {
  if (!record) return { ...emptyValuationValues };
  const source = (record.purchaseDetails && typeof record.purchaseDetails === "object"
    ? record.purchaseDetails
    : {}) as Partial<Record<keyof ValuationInputValues, unknown>>;
  return {
    assessorValue: readValue(source.assessorValue),
    attomAvmValue: readValue(source.attomAvmValue),
    zillowValue: readValue(source.zillowValue),
    realtorComValue: readValue(source.realtorComValue),
    narprValue: readValue(source.narprValue),
    propelioMedianValue: readValue(source.propelioMedianValue),
    propelioHighValue: readValue(source.propelioHighValue),
    propelioLowValue: readValue(source.propelioLowValue),
    economicValue: readValue(source.economicValue),
    rentometerEstimate: readValue(source.rentometerEstimate),
    zillowRentEstimate: readValue(source.zillowRentEstimate),
    currentOwner: readValue(source.currentOwner),
    lastSaleDate: readValue(source.lastSaleDate),
    lastSalePrice: readValue(source.lastSalePrice),
    bankruptcyRecord: readValue(source.bankruptcyRecord),
    internalWatchlist: readValue(source.internalWatchlist),
    forecasaStatus: readValue(source.forecasaStatus),
    activeLoansCount: readValue(source.activeLoansCount),
    negativeDeedRecords: readValue(source.negativeDeedRecords),
  };
}

function missingLabels(values: ValuationInputValues) {
  return valuationFields
    .filter((field) => !field.optional && !values[field.key].trim())
    .map((field) => field.label);
}

function parseSubjectAddress(address: string) {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const address1 = parts[0];
  const city = parts[1];
  const stateZip = parts.slice(2).join(", ");
  const zipMatch = stateZip.match(/([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)/);
  const state = zipMatch ? zipMatch[1] : stateZip.trim().split(/\s+/)[0];
  const zip = zipMatch ? zipMatch[2] : "";
  if (!address1 || !city || !state) return null;
  return { address1, city, state, zip };
}

type ValuationRoleDashboardProps = {
  role: ValuationInputRole;
  title: string;
  subtitle: string;
};

export function ValuationRoleDashboard({ role, title, subtitle }: ValuationRoleDashboardProps) {
  const navigate = useNavigate();
  const [pipeline, setPipeline] = useState<LenderPipelineRecord[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [formValues, setFormValues] = useState<ValuationInputValues>({ ...emptyValuationValues });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rentometerLoading, setRentometerLoading] = useState(false);
  const [attomResult, setAttomResult] = useState<AttomSubjectPropertyResponse | null>(null);
  const [attomError, setAttomError] = useState<string | null>(null);
  const [attomAddress, setAttomAddress] = useState("");
  const shareLink =
    selectedLoanId && typeof window !== "undefined"
      ? `${window.location.origin}/title-agent-form/${encodeURIComponent(selectedLoanId)}`
      : "";

  const underwritingLoans = useMemo(
    () => pipeline.filter((record) => underwritingStatuses.has(record.statusLabel)),
    [pipeline]
  );

  const selectedRecord = useMemo(
    () => underwritingLoans.find((record) => record.loanId === selectedLoanId) ?? null,
    [underwritingLoans, selectedLoanId]
  );

  // Persist last selected loan for cross-navigation (e.g., ROD Risk Scanner deep link)
  useEffect(() => {
    if (selectedLoanId) {
      window.localStorage?.setItem("lf_last_selected_loan", selectedLoanId);
    }
  }, [selectedLoanId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const rows = await fetchLenderPipeline();
        if (!mounted) return;
        setPipeline(rows);
        setError(null);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load underwriting loans.");
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
  }, []);

  useEffect(() => {
    if (underwritingLoans.length === 0) {
      setSelectedLoanId("");
      setFormValues({ ...emptyValuationValues });
      return;
    }
    if (!selectedLoanId || !underwritingLoans.some((record) => record.loanId === selectedLoanId)) {
      setSelectedLoanId(underwritingLoans[0].loanId);
    }
  }, [selectedLoanId, underwritingLoans]);

  useEffect(() => {
    setFormValues(valuesFromRecord(selectedRecord));
    setNotice(null);
      setAttomResult(null);
      setAttomError(null);
      setAttomAddress(selectedRecord?.property || "");
    }, [selectedRecord?.loanId]);

  const missing = useMemo(() => missingLabels(formValues), [formValues]);
  const needsInUnderwritingPrompt = selectedRecord?.statusLabel === "In-underwriting";
  const borrowerBed = selectedRecord?.underwritingIntake?.formData?.bed || "";
  const borrowerBath = selectedRecord?.underwritingIntake?.formData?.bath || "";
  const rentometerUrl = useMemo(() => {
    const address = selectedRecord?.property?.trim();
    const beds = borrowerBed?.trim();
    if (!address || !beds) return "";
    const params = new URLSearchParams({
      address,
      bedrooms: beds,
      radius: "2",
    });
    if (borrowerBath?.trim()) params.set("baths", borrowerBath.trim());
    return `https://www.rentometer.com/quickview?${params.toString()}`;
  }, [selectedRecord?.loanId, selectedRecord?.property, borrowerBed, borrowerBath]);

  const handleSave = async () => {
    if (!selectedRecord) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await updateLenderValuationInput(selectedRecord.loanId, {
        updatedByRole: role,
        values: formValues,
      });
      setPipeline((previous) =>
        previous.map((record) => (record.loanId === result.pipelineRecord.loanId ? result.pipelineRecord : record))
      );
      setNotice(
        `${role === "LOAN_OFFICER" ? "Loan officer" : "Evaluator"} valuation form saved for ${selectedRecord.loanId}.`
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save valuation form.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutofill = async () => {
    if (!selectedRecord) return;
    setIsAutoFilling(true);
    setError(null);
    setNotice(null);
    setAttomResult(null);
    setAttomError(null);
    try {
      const parsedAddress = parseSubjectAddress(attomAddress.trim() || selectedRecord.property || "");
      if (!parsedAddress) {
        throw new Error("Unable to parse subject property address. Please enter address1, city, state, and ZIP.");
      }
      const result = await fetchAttomSubjectProperty(parsedAddress);
      setFormValues((previous) => ({
        ...previous,
        assessorValue:
          result.total_market_value !== null ? String(result.total_market_value) : previous.assessorValue,
        attomAvmValue: result.avm_value !== null ? String(result.avm_value) : previous.attomAvmValue,
        currentOwner: result.owner_name ?? previous.currentOwner,
        lastSaleDate: result.last_sale_date ?? previous.lastSaleDate,
        lastSalePrice:
          result.last_sale_price !== null ? String(result.last_sale_price) : previous.lastSalePrice,
      }));
      setAttomResult(result);
      setNotice("Subject property values fetched from ATTOM.");
    } catch (autoError) {
      const message = autoError instanceof Error ? autoError.message : "Failed to auto-fill from Attom.";
      setError(message);
      setAttomError(message);
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleRentometer = async () => {
    if (!selectedRecord) return;
    const address = selectedRecord.property?.trim();
    if (!address) {
      setError("Property address is missing for this loan.");
      return;
    }
    // Beds/baths: prioritize borrower-submitted underwriting intake.
    const rawBeds = selectedRecord.underwritingIntake?.formData?.bed || "";
    const bedsNumber = Math.min(6, Math.max(0, Math.round(Number(rawBeds))));
    if (!Number.isFinite(bedsNumber)) {
      setError(
        "Bedrooms are required for Rentometer. Update the borrower underwriting intake (bed) first."
      );
      return;
    }

    const bathsNumeric = Number(borrowerBath);
    const bathsValue = Number.isFinite(bathsNumeric)
      ? bathsNumeric >= 1.5
        ? "1.5+"
        : "1"
      : borrowerBath === "1.5+"
        ? "1.5+"
        : borrowerBath === "1"
          ? "1"
          : undefined;

    setRentometerLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await fetchRentometerSummary({
        address,
        bedrooms: bedsNumber,
        bathrooms: bathsValue,
        building_type: "",
      });

      setFormValues((prev) => ({ ...prev, rentometerEstimate: String(result.average_rent) }));
      if (result.warning) {
        setNotice(`${result.warning} (samples: ${result.samples ?? "N/A"})`);
      } else {
        setNotice("Rentometer average rent fetched and applied.");
      }
    } catch (rentometerError) {
      const message = rentometerError instanceof Error ? rentometerError.message : "Rentometer fetch failed.";
      setError(message);
    } finally {
      setRentometerLoading(false);
    }
  };

  const formatAttomValue = (value: unknown) => {
    if (value === null || value === undefined) return "Not provided";
    if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : String(value);
    return String(value);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-primary">{title}</h1>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </header>

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{notice}</div>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading underwriting loans...</p>
        ) : underwritingLoans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No loans are currently in underwriting.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Underwriting Queue</h2>
              <div className="space-y-2">
                {underwritingLoans.map((record) => {
                  const rowValues = valuesFromRecord(record);
                  const rowMissingCount = missingLabels(rowValues).length;
                  const isComplete = rowMissingCount === 0;
                  const isSelected = selectedLoanId === record.loanId;
                  return (
                    <button
                      key={record.loanId}
                      type="button"
                      className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                      onClick={() => setSelectedLoanId(record.loanId)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm">{record.loanId}</p>
                        <StatusBadge variant={getStatusVariant(record.statusLabel)}>{record.statusLabel}</StatusBadge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{record.property}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <StatusBadge variant={isComplete ? "success" : "warning"}>
                          {isComplete ? "Complete" : `${rowMissingCount} missing`}
                        </StatusBadge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedRecord ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold">Valuation Form • {selectedRecord.loanId}</h3>
                    <p className="text-sm text-muted-foreground">{selectedRecord.property}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/40 px-3 py-2 text-sm text-primary hover:bg-primary/10"
                    onClick={() => navigate(`/underwriting?loanId=${encodeURIComponent(selectedRecord.loanId)}`)}
                  >
                    Open Underwriting
                    <ExternalLink size={14} />
                  </button>
                </div>

                {needsInUnderwritingPrompt && missing.length > 0 ? (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
                      <div>
                        <p className="text-sm font-semibold">Action required for Loan Officer</p>
                        <p className="text-sm text-muted-foreground">
                          This loan is in-underwriting. Complete all valuation inputs to push live values to Underwriting Enhanced.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                      <div>
                        <p className="text-sm font-semibold">Valuation form status</p>
                        <p className="text-sm text-muted-foreground">
                          {missing.length === 0
                            ? "All required valuation values are complete for this loan."
                            : `${missing.length} valuation field(s) still missing.`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="text-sm font-semibold text-foreground">Valuation Inputs</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="w-64 rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={attomAddress}
                        onChange={(event) => setAttomAddress(event.target.value)}
                        placeholder="Search address for ATTOM"
                      />
                      <button
                        type="button"
                        onClick={handleAutofill}
                        disabled={isAutoFilling}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-60"
                      >
                        {isAutoFilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight size={14} />}
                        Fetch from ATTOM
                      </button>
                      <button
                        type="button"
                        onClick={handleRentometer}
                        disabled={rentometerLoading}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-60"
                      >
                        {rentometerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight size={14} />}
                        Fetch Rentometer Avg Rent
                      </button>
                      <button
                        type="button"
                        onClick={() => rentometerUrl && window.open(rentometerUrl, "_blank", "noopener,noreferrer")}
                        disabled={!rentometerUrl}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-60"
                      >
                        Open in Rentometer
                      </button>
                    </div>
                    {(borrowerBed || borrowerBath) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Borrower intake: Bed {borrowerBed || "—"} • Bath {borrowerBath || "—"}
                      </p>
                    )}
                  </div>

                  {attomError ? (
                    <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                      {attomError}
                    </div>
                  ) : null}

                  {attomResult ? (
                    <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-primary">ATTOM subject property (latest)</p>
                        <p className="text-xs text-muted-foreground">
                          Retrieved {new Date(attomResult.retrieved_at).toLocaleString()}
                        </p>
                      </div>
                      {((attomResult.raw_property as any)?.address || (attomResult.raw_property as any)?.identifier) ? (
                        <div className="text-xs text-muted-foreground">
                          <div>
                            Address:{" "}
                            {((attomResult.raw_property as any)?.address?.oneLine ||
                              (attomResult.raw_property as any)?.address?.line1 ||
                              (attomResult.raw_property as any)?.address?.address1) ??
                              "—"}
                          </div>
                          <div>
                            APN: {((attomResult.raw_property as any)?.identifier?.apn) || "—"} • ATTOM ID:{" "}
                            {((attomResult.raw_property as any)?.identifier?.attomId) ||
                              ((attomResult.raw_property as any)?.identifier?.Id) ||
                              "—"}
                          </div>
                        </div>
                      ) : null}
                      {attomResult.needs_review ? (
                        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                          Needs review — verify the match and values.
                        </div>
                      ) : null}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-foreground">
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Assessor / Total Market Value</span>
                          <span className="font-semibold">
                            {formatAttomValue(attomResult.total_market_value)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Land Appraisal (Market Land)</span>
                          <span className="font-semibold">{formatAttomValue(attomResult.land_appraisal_value)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Building Appraisal (Market Improvement)</span>
                          <span className="font-semibold">{formatAttomValue(attomResult.building_appraisal_value)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">AVM (ATTOM)</span>
                          <span className="font-semibold">{formatAttomValue(attomResult.avm_value)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {attomResult.sources.expandedprofile_url ? (
                          <a
                            href={attomResult.sources.expandedprofile_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            Expanded Profile
                          </a>
                        ) : null}
                        {attomResult.sources.basicprofile_url ? (
                          <a
                            href={attomResult.sources.basicprofile_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            Basic Profile
                          </a>
                        ) : null}
                        {attomResult.sources.assessment_snapshot_url ? (
                          <a
                            href={attomResult.sources.assessment_snapshot_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            Assessment Snapshot
                          </a>
                        ) : null}
                        {attomResult.sources.avm_url ? (
                          <a
                            href={attomResult.sources.avm_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            AVM source
                          </a>
                        ) : null}
                      </div>
                        {attomResult.notes?.length ? (
                          <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                            {attomResult.notes.map((note, index) => (
                              <li key={index}>{note}</li>
                            ))}
                          </ul>
                        ) : null}
                      {attomResult.raw_property || attomResult.attempts ? (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer text-primary">Show search result (raw)</summary>
                          <pre className="mt-2 max-h-80 overflow-auto rounded bg-white/70 p-2 text-[11px] text-foreground border border-border whitespace-pre-wrap">
                            {JSON.stringify(
                              {
                                raw_property: attomResult.raw_property,
                                attempts: attomResult.attempts,
                              },
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {valuationFields.map((field) => (
                      <label key={field.key} className="space-y-1">
                        <span className="text-sm font-medium">{field.label}</span>
                        <input
                          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          value={formValues[field.key]}
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            setFormValues((previous) => ({
                              ...previous,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Missing: {missing.length === 0 ? "None" : missing.join(", ")}
                    </p>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                      {isSaving ? "Saving..." : "Save Valuation Inputs"}
                    </button>
                  </div>

                  {selectedLoanId ? (
                    <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex flex-col gap-2">
                      <p className="text-sm font-semibold text-primary">Title Agent Form</p>
                      <p className="text-sm text-muted-foreground">
                        Share this link with the title agent to complete seller/assignor details and upload agreements.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-xs bg-white border border-border rounded px-2 py-1">
                          {shareLink || "Link not available"}
                        </code>
                        {shareLink ? (
                          <button
                            type="button"
                            className="text-xs rounded-lg border border-primary/40 px-3 py-1.5 text-primary hover:bg-primary/10"
                            onClick={() => navigator.clipboard?.writeText(shareLink)}
                          >
                            Copy Link
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
