import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { StatusBadge } from "../../components/StatusBadge";
import {
  fetchWorkflowApplications,
  updateWorkflowApplication,
  type WorkflowApplication,
  type LoanType,
} from "../../services/workflowApi";

function formatDateTime(timestamp: number | null | undefined) {
  if (!Number.isFinite(Number(timestamp))) return "N/A";
  return new Date(Number(timestamp)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(value: unknown) {
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const stageOrder = [
  "Application Submitted",
  "Document Verification",
  "Processing",
  "Underwriting Review",
  "Final Approval",
  "Closing",
  "Funding",
];

function stageLabel(application: WorkflowApplication) {
  return application.currentStage || stageOrder[application.currentStageIndex] || "In Progress";
}

function statusVariant(application: WorkflowApplication): "success" | "info" | "warning" | "default" {
  if (application.currentStageIndex >= 5 || application.status?.toLowerCase().includes("active")) return "success";
  if (application.preApprovalDecision === "REQUEST_INFO") return "warning";
  if (application.preApprovalDecision === "PRE_APPROVE") return "info";
  return "default";
}

export function MyApplications() {
  const [applications, setApplications] = useState<WorkflowApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const [showDetailOnly, setShowDetailOnly] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<{
    property: string;
    type: LoanType;
    amount: string;
    purchasePrice: string;
    rehabBudget: string;
    arv: string;
    exitStrategy: string;
    targetClosingDate: string;
  }>({
    property: "",
    type: "Fix & Flip Loan (Rehab Loan)",
    amount: "",
    purchasePrice: "",
    rehabBudget: "",
    arv: "",
    exitStrategy: "",
    targetClosingDate: "",
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const loaded = await fetchWorkflowApplications();
        if (!mounted) return;
        setApplications(loaded);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load applications.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const sortedApplications = useMemo(
    () => [...applications].sort((a, b) => b.createdAt - a.createdAt),
    [applications]
  );

  // Auto-select the first application once data is loaded
  useEffect(() => {
    if (!selectedId && sortedApplications.length > 0) {
      setSelectedId(sortedApplications[0].id);
    }
  }, [sortedApplications, selectedId]);

  const selectedApplication = useMemo(
    () => sortedApplications.find((app) => app.id === selectedId) || null,
    [sortedApplications, selectedId]
  );

  const handleRowClick = (id: string) => {
    setSelectedId(id);
    setShowDetailOnly(true);
  };

  useEffect(() => {
    if (selectedApplication && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedApplication]);

  useEffect(() => {
    if (!selectedApplication) return;
    setEditForm({
      property: selectedApplication.property || "",
      type: selectedApplication.type,
      amount: String(selectedApplication.amount || ""),
      purchasePrice: selectedApplication.purchaseDetails?.purchasePrice || "",
      rehabBudget: selectedApplication.purchaseDetails?.rehabBudget || "",
      arv: selectedApplication.purchaseDetails?.arv || "",
      exitStrategy: selectedApplication.purchaseDetails?.exitStrategy || "",
      targetClosingDate: selectedApplication.purchaseDetails?.targetClosingDate || "",
    });
  }, [selectedApplication]);

  const handleEditSave = async () => {
    if (!selectedApplication) return;
    try {
      setIsSaving(true);
      const updated = await updateWorkflowApplication(selectedApplication.id, {
        property: editForm.property.trim(),
        type: editForm.type,
        amount: Number(editForm.amount) || 0,
        purchaseDetails: {
          purchasePrice: editForm.purchasePrice,
          rehabBudget: editForm.rehabBudget,
          arv: editForm.arv,
          compsValidationNote: selectedApplication.purchaseDetails?.compsValidationNote || "",
          exitStrategy: editForm.exitStrategy,
          targetClosingDate: editForm.targetClosingDate,
          compsFiles: selectedApplication.purchaseDetails?.compsFiles || [],
          propertyPhotos: selectedApplication.purchaseDetails?.propertyPhotos || [],
          purchaseContractFiles: selectedApplication.purchaseDetails?.purchaseContractFiles || [],
          scopeOfWorkFiles: selectedApplication.purchaseDetails?.scopeOfWorkFiles || [],
        },
      });
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSelectedId(updated.id);
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header id="status" className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">My Applications</h1>
          <p className="text-muted-foreground mt-1">
            Track your loan requests and their stage in the workflow. (Restored page — timeline features trimmed for now.)
          </p>
        </div>
        <Link to="/borrower/active-loans" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
          View Active Loans
        </Link>
      </header>

      {error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading applications...</p> : null}

      {!isLoading ? (
        showDetailOnly && selectedApplication ? (
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm" ref={detailRef}>
            {(() => {
              let timelineStages =
                selectedApplication?.stages && selectedApplication.stages.length > 0
                  ? [...selectedApplication.stages]
                  : [...stageOrder];

              const fundingIndex = timelineStages.findIndex((stage) => stage.toLowerCase().includes("funding"));
              const hasClosing = timelineStages.some((stage) => stage.toLowerCase().includes("closing"));
              if (fundingIndex >= 0 && !hasClosing) {
                timelineStages.splice(fundingIndex, 0, "Closing");
              }

              const rawIdx = Math.max(Number(selectedApplication?.currentStageIndex ?? 0), 0);
              const currentIdx =
                !hasClosing && fundingIndex >= 0 && rawIdx >= fundingIndex
                  ? Math.min(rawIdx + 1, timelineStages.length - 1)
                  : Math.min(rawIdx, timelineStages.length - 1);

              return (
                <div className="mb-4 overflow-x-auto">
                  <div className="flex items-center gap-4 min-w-[520px]">
                    {timelineStages.map((stage, index) => {
                      const state =
                        index < currentIdx ? "done" : index === currentIdx ? "current" : "pending";
                      const color =
                        state === "done" ? "bg-success" : state === "current" ? "bg-info" : "bg-border";
                      return (
                        <div key={`${stage}-${index}`} className="flex-1 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${color}`} />
                            <p
                              className={`text-sm ${
                                state === "pending" ? "text-muted-foreground" : "text-foreground font-semibold"
                              }`}
                            >
                              {stage}
                            </p>
                          </div>
                          {index < timelineStages.length - 1 ? (
                            <div className="ml-1 mt-2 h-1 rounded-full bg-border">
                              <div
                                className={`h-full rounded-full ${
                                  state === "done" ? "bg-success" : state === "current" ? "bg-info" : "bg-border"
                                }`}
                                style={{ width: "100%" }}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground">Loan</p>
                  <p className="text-xl font-semibold">{selectedApplication.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant={statusVariant(selectedApplication)}>
                    {selectedApplication.status || "In Progress"}
                  </StatusBadge>
                  <button
                    type="button"
                    className="rounded border border-border px-3 py-1 text-xs hover:bg-muted"
                    onClick={() => setIsEditing((prev) => !prev)}
                  >
                    {isEditing ? "Cancel" : "Edit"}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-border px-3 py-1 text-xs hover:bg-muted"
                    onClick={() => setShowDetailOnly(false)}
                  >
                  Back to list
                </button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4 text-sm">
              <div>
                <p className="text-muted-foreground">Borrower</p>
                <p className="font-medium">{selectedApplication.borrowerName || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Borrower Email</p>
                <p className="font-medium break-all">{selectedApplication.borrowerEmail || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Property</p>
                <p className="font-medium">{selectedApplication.property || "Subject property"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Loan Type</p>
                <p className="font-medium">{selectedApplication.type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-medium">{formatMoney(selectedApplication.amount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Stage</p>
                <p className="font-medium">{stageLabel(selectedApplication)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium">{selectedApplication.status || "In Progress"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pre-Approval</p>
                <p className="font-medium">{selectedApplication.preApprovalDecision || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">LLC Name</p>
                <p className="font-medium">{selectedApplication.llcName || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{formatDateTime(selectedApplication.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-medium">{formatDateTime(selectedApplication.lastEventAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Target Closing Date</p>
                <p className="font-medium">
                  {selectedApplication.purchaseDetails?.targetClosingDate || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Purchase Price</p>
                <p className="font-medium">
                  {formatMoney(selectedApplication.purchaseDetails?.purchasePrice)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Rehab Budget</p>
                <p className="font-medium">
                  {formatMoney(selectedApplication.purchaseDetails?.rehabBudget)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">ARV</p>
                <p className="font-medium">{formatMoney(selectedApplication.purchaseDetails?.arv)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Exit Strategy</p>
                <p className="font-medium">{selectedApplication.purchaseDetails?.exitStrategy || "—"}</p>
              </div>
              <div className="lg:col-span-3">
                <p className="text-muted-foreground">Comps / Notes</p>
                <p className="font-medium">
                  {selectedApplication.purchaseDetails?.compsValidationNote || "—"}
                </p>
              </div>
            </div>

            {isEditing ? (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Edit Application</h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 text-sm">
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Property</span>
                    <input
                      className="w-full rounded-md border border-border px-3 py-2 bg-white"
                      value={editForm.property}
                      onChange={(e) => setEditForm((p) => ({ ...p, property: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Loan Type</span>
                    <select
                      className="w-full rounded-md border border-border px-3 py-2 bg-white"
                      value={editForm.type}
                      onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value as LoanType }))}
                    >
                      {[
                        "Fix & Flip Loan (Rehab Loan)",
                        "Bridge Loan",
                        "Ground-Up Construction Loan",
                        "Transactional Funding (Double Close / Wholesale)",
                        "Land Loan",
                        "Purchase",
                        "Refinance",
                        "Cash-Out Refinance",
                      ].map((lt) => (
                        <option key={lt} value={lt}>
                          {lt}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Amount</span>
                    <input
                      className="w-full rounded-md border border-border px-3 py-2 bg-white"
                      value={editForm.amount}
                      onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Purchase Price</span>
                    <input
                      className="w-full rounded-md border border-border px-3 py-2 bg-white"
                      value={editForm.purchasePrice}
                      onChange={(e) => setEditForm((p) => ({ ...p, purchasePrice: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Rehab Budget</span>
                    <input
                      className="w-full rounded-md border border-border px-3 py-2 bg-white"
                      value={editForm.rehabBudget}
                      onChange={(e) => setEditForm((p) => ({ ...p, rehabBudget: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">ARV</span>
                    <input
                      className="w-full rounded-md border border-border px-3 py-2 bg-white"
                      value={editForm.arv}
                      onChange={(e) => setEditForm((p) => ({ ...p, arv: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Exit Strategy</span>
                    <input
                      className="w-full rounded-md border border-border px-3 py-2 bg-white"
                      value={editForm.exitStrategy}
                      onChange={(e) => setEditForm((p) => ({ ...p, exitStrategy: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Target Closing Date</span>
                    <input
                      type="date"
                      className="w-full rounded-md border border-border px-3 py-2 bg-white"
                      value={editForm.targetClosingDate}
                      onChange={(e) => setEditForm((p) => ({ ...p, targetClosingDate: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary/90 disabled:opacity-50"
                    onClick={handleEditSave}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {selectedApplication.underwritingIntake?.formData ? (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Underwriting Intake
                </h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Beds / Baths</p>
                    <p className="font-medium">
                      {selectedApplication.underwritingIntake.formData.bed || "—"} /{" "}
                      {selectedApplication.underwritingIntake.formData.bath || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Closing Company</p>
                    <p className="font-medium">
                      {selectedApplication.underwritingIntake.formData.closingCompany || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Closing Agent</p>
                    <p className="font-medium">
                      {selectedApplication.underwritingIntake.formData.closingAgentName || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Closing Agent Email</p>
                    <p className="font-medium break-all">
                      {selectedApplication.underwritingIntake.formData.closingAgentEmail || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Credit Score (provided)</p>
                    <p className="font-medium">
                      {selectedApplication.underwritingIntake.formData.creditScore ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Liquidity Amount</p>
                    <p className="font-medium">
                      {selectedApplication.underwritingIntake.formData.proofOfLiquidityAmount || "—"}
                    </p>
                  </div>
                  <div className="lg:col-span-3">
                    <p className="text-muted-foreground">Referral</p>
                    <p className="font-medium">
                      {selectedApplication.underwritingIntake.formData.referral?.name || "—"} •{" "}
                      {selectedApplication.underwritingIntake.formData.referral?.email || "—"} •{" "}
                      {selectedApplication.underwritingIntake.formData.referral?.phone || "—"}
                    </p>
                  </div>
                  <div className="lg:col-span-3">
                    <p className="text-muted-foreground">LLC State Recorded</p>
                    <p className="font-medium">
                      {selectedApplication.underwritingIntake.formData.llcStateRecorded || "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {selectedApplication.conditionsForm ? (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Conditions Form
                </h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Credit Score</p>
                    <p className="font-medium">{selectedApplication.conditionsForm.creditScore ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Liquidity Amount</p>
                    <p className="font-medium">
                      {selectedApplication.conditionsForm.proofOfLiquidityAmount || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Other Mortgage Loans</p>
                    <p className="font-medium">
                      {selectedApplication.conditionsForm.otherMortgageLoansCount ?? "—"} loans •{" "}
                      {selectedApplication.conditionsForm.otherMortgageTotalAmount || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Referral</p>
                    <p className="font-medium">
                      {selectedApplication.conditionsForm.referral?.name || "—"} •{" "}
                      {selectedApplication.conditionsForm.referral?.email || "—"} •{" "}
                      {selectedApplication.conditionsForm.referral?.phone || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Desktop Appraisal</p>
                    <p className="font-medium">
                      {selectedApplication.conditionsForm.desktopAppraisalValue || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Submitted At</p>
                    <p className="font-medium">
                      {formatDateTime(selectedApplication.conditionsForm.submittedAt || null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Updated At</p>
                    <p className="font-medium">
                      {formatDateTime(selectedApplication.conditionsForm.updatedAt || null)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            {sortedApplications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-3 pr-4">Loan ID</th>
                      <th className="py-3 pr-4">Property</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3 pr-4">Amount</th>
                      <th className="py-3 pr-4">Stage</th>
                      <th className="py-3 pr-4">Updated</th>
                      <th className="py-3 pr-0">Status</th>
                      <th className="py-3 pr-0 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedApplications.map((application) => (
                      <tr
                        key={application.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleRowClick(application.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleRowClick(application.id);
                          }
                        }}
                        aria-selected={selectedId === application.id}
                        className={`border-b border-border hover:bg-muted/30 cursor-pointer ${
                          selectedId === application.id ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="py-3 pr-4 font-medium">
                          <button
                            type="button"
                            className="text-left w-full hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(application.id);
                            }}
                          >
                            {application.id}
                          </button>
                        </td>
                        <td className="py-3 pr-4">{application.property || "Subject property"}</td>
                        <td className="py-3 pr-4">{application.type}</td>
                        <td className="py-3 pr-4">
                          {Number.isFinite(application.amount)
                            ? application.amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
                            : "—"}
                        </td>
                        <td className="py-3 pr-4">{stageLabel(application)}</td>
                        <td className="py-3 pr-4">{formatDateTime(application.lastEventAt)}</td>
                        <td className="py-3 pr-0">
                          <StatusBadge variant={statusVariant(application)}>{application.status || "In Progress"}</StatusBadge>
                        </td>
                        <td className="py-3 pr-0 text-right">
                          <button
                            type="button"
                            className="rounded border border-border px-3 py-1 text-xs hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(application.id);
                            }}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      ) : null}
    </div>
  );
}
