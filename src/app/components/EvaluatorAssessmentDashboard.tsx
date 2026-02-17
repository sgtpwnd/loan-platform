import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import {
  fetchLenderPipeline,
  updateLenderEvaluatorInput,
  type EvaluatorInputValues,
  type LenderPipelineRecord,
} from "../services/workflowApi";

const underwritingStatuses = new Set(["In-underwriting", "UW for Review", "Under Review"]);

type EvaluatorField = {
  key: keyof EvaluatorInputValues;
  label: string;
  placeholder: string;
  type?: "select";
  options?: string[];
};

const cmaFields: EvaluatorField[] = [
  { key: "cmaAvgSalePrice", label: "Avg Sale Price", placeholder: "e.g. 250000" },
  { key: "cmaPricePerSqFt", label: "Price / Sq Ft", placeholder: "e.g. 180" },
  { key: "cmaDaysOnMarket", label: "Days on Market", placeholder: "e.g. 21" },
  { key: "cmaSubjectSqFt", label: "Subject Sq Ft", placeholder: "e.g. 1750" },
];

const keyFindingFields: EvaluatorField[] = [
  { key: "keyFindingLtv", label: "LTV", placeholder: "e.g. 40%" },
  {
    key: "keyFindingApplication",
    label: "Application",
    placeholder: "Select status",
    type: "select",
    options: ["Complete", "Incomplete", "Needs Review"],
  },
  { key: "keyFindingScore", label: "Score", placeholder: "e.g. 100/100" },
];

const assessmentFields: EvaluatorField[] = [
  { key: "asIsValue", label: "As-Is Value", placeholder: "e.g. 50000" },
  { key: "arv", label: "ARV", placeholder: "e.g. 250000" },
  { key: "currentLtv", label: "Current LTV", placeholder: "e.g. 40%" },
  { key: "ltvAfterRepairs", label: "LTV After Repairs", placeholder: "e.g. 40%" },
  {
    key: "recommendation",
    label: "Recommendation",
    placeholder: "Select recommendation",
    type: "select",
    options: ["PRE_APPROVE", "CONDITIONAL", "DECLINE"],
  },
  {
    key: "confidence",
    label: "Confidence",
    placeholder: "e.g. 100%",
  },
  {
    key: "riskLevel",
    label: "Risk Level",
    placeholder: "Select risk level",
    type: "select",
    options: ["Low", "Moderate", "High"],
  },
];

const allFields: EvaluatorField[] = [...cmaFields, ...keyFindingFields, ...assessmentFields, {
  key: "professionalAssessment",
  label: "Professional Assessment",
  placeholder: "Write a concise evaluator narrative.",
}];

const emptyEvaluatorValues: EvaluatorInputValues = {
  cmaAvgSalePrice: "",
  cmaPricePerSqFt: "",
  cmaDaysOnMarket: "",
  cmaSubjectSqFt: "",
  keyFindingLtv: "",
  keyFindingApplication: "",
  keyFindingScore: "",
  asIsValue: "",
  arv: "",
  currentLtv: "",
  ltvAfterRepairs: "",
  recommendation: "",
  confidence: "",
  riskLevel: "",
  professionalAssessment: "",
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

function valuesFromRecord(record: LenderPipelineRecord | null): EvaluatorInputValues {
  if (!record?.evaluatorInput?.values) return { ...emptyEvaluatorValues };
  const source = record.evaluatorInput.values as Partial<EvaluatorInputValues>;
  return {
    cmaAvgSalePrice: readValue(source.cmaAvgSalePrice),
    cmaPricePerSqFt: readValue(source.cmaPricePerSqFt),
    cmaDaysOnMarket: readValue(source.cmaDaysOnMarket),
    cmaSubjectSqFt: readValue(source.cmaSubjectSqFt),
    keyFindingLtv: readValue(source.keyFindingLtv),
    keyFindingApplication: readValue(source.keyFindingApplication),
    keyFindingScore: readValue(source.keyFindingScore),
    asIsValue: readValue(source.asIsValue),
    arv: readValue(source.arv),
    currentLtv: readValue(source.currentLtv),
    ltvAfterRepairs: readValue(source.ltvAfterRepairs),
    recommendation: readValue(source.recommendation),
    confidence: readValue(source.confidence),
    riskLevel: readValue(source.riskLevel),
    professionalAssessment: readValue(source.professionalAssessment),
  };
}

function missingLabels(values: EvaluatorInputValues) {
  return allFields
    .filter((field) => !values[field.key].trim())
    .map((field) => field.label);
}

export function EvaluatorAssessmentDashboard() {
  const [pipeline, setPipeline] = useState<LenderPipelineRecord[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [formValues, setFormValues] = useState<EvaluatorInputValues>({ ...emptyEvaluatorValues });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const underwritingLoans = useMemo(
    () => pipeline.filter((record) => underwritingStatuses.has(record.statusLabel)),
    [pipeline]
  );

  const selectedRecord = useMemo(
    () => underwritingLoans.find((record) => record.loanId === selectedLoanId) ?? null,
    [underwritingLoans, selectedLoanId]
  );

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
      setFormValues({ ...emptyEvaluatorValues });
      return;
    }
    if (!selectedLoanId || !underwritingLoans.some((record) => record.loanId === selectedLoanId)) {
      setSelectedLoanId(underwritingLoans[0].loanId);
    }
  }, [selectedLoanId, underwritingLoans]);

  useEffect(() => {
    setFormValues(valuesFromRecord(selectedRecord));
    setNotice(null);
  }, [selectedRecord?.loanId]);

  const missing = useMemo(() => missingLabels(formValues), [formValues]);
  const needsInUnderwritingPrompt = selectedRecord?.statusLabel === "In-underwriting";

  const handleSave = async () => {
    if (!selectedRecord) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await updateLenderEvaluatorInput(selectedRecord.loanId, {
        updatedByRole: "EVALUATOR",
        values: formValues,
      });
      setPipeline((previous) =>
        previous.map((record) => (record.loanId === result.pipelineRecord.loanId ? result.pipelineRecord : record))
      );
      setNotice(`Evaluator assessment saved for ${selectedRecord.loanId}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save evaluator assessment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-primary">Evaluator Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Complete the evaluator assessment for loans that are currently in underwriting.
        </p>
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
                <div>
                  <h3 className="text-lg font-semibold">Evaluator Form • {selectedRecord.loanId}</h3>
                  <p className="text-sm text-muted-foreground">{selectedRecord.property}</p>
                </div>

                {needsInUnderwritingPrompt && missing.length > 0 ? (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
                      <div>
                        <p className="text-sm font-semibold">Action required</p>
                        <p className="text-sm text-muted-foreground">
                          This loan is in underwriting. Complete the evaluator assessment to finalize the review.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                      <div>
                        <p className="text-sm font-semibold">Assessment status</p>
                        <p className="text-sm text-muted-foreground">
                          {missing.length === 0
                            ? "All required evaluator fields are complete for this loan."
                            : `${missing.length} evaluator field(s) still missing.`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-6">
                  <div>
                    <p className="text-sm font-semibold">Comparative Market Analysis (CMA)</p>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {cmaFields.map((field) => (
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
                  </div>

                  <div>
                    <p className="text-sm font-semibold">Key Findings</p>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                      {keyFindingFields.map((field) => (
                        <label key={field.key} className="space-y-1">
                          <span className="text-sm font-medium">{field.label}</span>
                          {field.type === "select" ? (
                            <select
                              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              value={formValues[field.key]}
                              onChange={(event) =>
                                setFormValues((previous) => ({
                                  ...previous,
                                  [field.key]: event.target.value,
                                }))
                              }
                            >
                              <option value="">{field.placeholder}</option>
                              {field.options?.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
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
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">Evaluator&apos;s Assessment</p>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {assessmentFields.map((field) => (
                        <label key={field.key} className="space-y-1">
                          <span className="text-sm font-medium">{field.label}</span>
                          {field.type === "select" ? (
                            <select
                              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              value={formValues[field.key]}
                              onChange={(event) =>
                                setFormValues((previous) => ({
                                  ...previous,
                                  [field.key]: event.target.value,
                                }))
                              }
                            >
                              <option value="">{field.placeholder}</option>
                              {field.options?.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
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
                          )}
                        </label>
                      ))}
                    </div>
                    <label className="mt-4 block space-y-1">
                      <span className="text-sm font-medium">Professional Assessment</span>
                      <textarea
                        className="min-h-[140px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Summarize valuation, risk, and any recommendations."
                        value={formValues.professionalAssessment}
                        onChange={(event) =>
                          setFormValues((previous) => ({
                            ...previous,
                            professionalAssessment: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                      {isSaving ? "Saving..." : "Save Assessment"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
