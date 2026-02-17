import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Trash, UploadCloud } from "lucide-react";
import { fetchTitleAgentForm, submitTitleAgentForm, type TitleAgentFormData } from "../services/workflowApi";

type DocInput = { name: string; dataUrl: string | null; contentType?: string | null };

const emptyForm: TitleAgentFormData = {
  sellerType: "INDIVIDUAL",
  sellerName: "",
  sellerLlcName: "",
  sellerMembers: [],
  hasAssignor: false,
  assignorType: "INDIVIDUAL",
  assignorName: "",
  assignorLlcName: "",
  assignorMembers: [],
  assignmentFees: "",
  purchaseAgreements: [],
  assignmentAgreements: [],
  updatedAt: null,
};

function normalizeDoc(file: File): Promise<DocInput> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        dataUrl: typeof reader.result === "string" ? reader.result : null,
        contentType: file.type || null,
      });
    };
    reader.readAsDataURL(file);
  });
}

export function TitleAgentForm() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const loanId = params.loanId || searchParams.get("loanId") || "";

  const [form, setForm] = useState<TitleAgentFormData>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!loanId) {
        setError("Missing loanId in URL.");
        setIsLoading(false);
        return;
      }
      try {
        const existing = await fetchTitleAgentForm(loanId);
        if (!mounted) return;
        setForm({ ...emptyForm, ...existing });
        setError(null);
      } catch (loadError) {
        if (!mounted) return;
        setForm({ ...emptyForm });
        setError(loadError instanceof Error ? loadError.message : "Failed to load form.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [loanId]);

  const handleMemberChange = (field: "sellerMembers" | "assignorMembers", index: number, value: string) => {
    setForm((prev) => {
      const next = [...prev[field]];
      next[index] = value;
      return { ...prev, [field]: next };
    });
  };

  const addMember = (field: "sellerMembers" | "assignorMembers") =>
    setForm((prev) => ({ ...prev, [field]: [...prev[field], ""] }));

  const removeMember = (field: "sellerMembers" | "assignorMembers", index: number) =>
    setForm((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));

  const uploadDocs = async (files: FileList | null, key: "purchaseAgreements" | "assignmentAgreements") => {
    if (!files || files.length === 0) return;
    const docs = await Promise.all(Array.from(files).map(normalizeDoc));
    setForm((prev) => ({
      ...prev,
      [key]: [...prev[key], ...docs],
    }));
  };

  const missing = useMemo(() => {
    const required: string[] = [];
    if (!form.sellerName && form.sellerType === "INDIVIDUAL") required.push("Seller Name");
    if (form.sellerType === "LLC" && !form.sellerLlcName) required.push("Seller LLC Name");
    if (form.hasAssignor) {
      if (form.assignorType === "INDIVIDUAL" && !form.assignorName) required.push("Assignor Name");
      if (form.assignorType === "LLC" && !form.assignorLlcName) required.push("Assignor LLC Name");
      if (!form.assignmentFees) required.push("Total Assignment Fees");
    }
    if (form.purchaseAgreements.length === 0) required.push("Purchase Agreement upload");
    return required;
  }, [form]);

  const handleSubmit = async () => {
    if (!loanId) {
      setError("Missing loanId in URL.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await submitTitleAgentForm(loanId, form);
      setNotice("Title agent form submitted to Underwriting.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save form.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Title Agent Intake</h1>
          <p className="text-muted-foreground">Loan ID: {loanId || "Not provided"}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {missing.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 size={16} /> Ready to submit
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle size={16} /> {missing.length} field(s) missing
            </span>
          )}
        </div>
      </header>

      {error ? <div className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-danger text-sm">{error}</div> : null}
      {notice ? (
        <div className="rounded border border-success/30 bg-success/10 px-3 py-2 text-success text-sm">{notice}</div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="animate-spin" size={16} /> Loading form...
        </div>
      ) : (
        <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <section className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <label className="space-y-1">
                <span className="text-sm font-medium">Seller Type</span>
                <select
                  className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  value={form.sellerType}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, sellerType: e.target.value === "LLC" ? "LLC" : "INDIVIDUAL" }))
                  }
                >
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="LLC">LLC</option>
                </select>
              </label>
              <label className="flex-1 min-w-[220px] space-y-1">
                <span className="text-sm font-medium">{form.sellerType === "LLC" ? "Seller Contact Name" : "Seller Name"}</span>
                <input
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  value={form.sellerName}
                  onChange={(e) => setForm((prev) => ({ ...prev, sellerName: e.target.value }))}
                />
              </label>
            </div>

            {form.sellerType === "LLC" ? (
              <div className="space-y-2">
                <label className="space-y-1 block">
                  <span className="text-sm font-medium">Seller LLC Name</span>
                  <input
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                    value={form.sellerLlcName}
                    onChange={(e) => setForm((prev) => ({ ...prev, sellerLlcName: e.target.value }))}
                  />
                </label>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Seller LLC Member(s)</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-primary"
                      onClick={() => addMember("sellerMembers")}
                    >
                      <Plus size={14} /> Add member
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.sellerMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No members added.</p>
                    ) : null}
                    {form.sellerMembers.map((member, index) => (
                      <div key={`seller-member-${index}`} className="flex items-center gap-2">
                        <input
                          className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm"
                          value={member}
                          onChange={(e) => handleMemberChange("sellerMembers", index, e.target.value)}
                        />
                        <button
                          type="button"
                          className="p-2 rounded border border-border text-muted-foreground hover:bg-muted"
                          onClick={() => removeMember("sellerMembers", index)}
                          aria-label="Remove member"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.hasAssignor}
                  onChange={(e) => setForm((prev) => ({ ...prev, hasAssignor: e.target.checked }))}
                />
                There is an assignor
              </label>
              {form.hasAssignor ? (
                <select
                  className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  value={form.assignorType}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, assignorType: e.target.value === "LLC" ? "LLC" : "INDIVIDUAL" }))
                  }
                >
                  <option value="INDIVIDUAL">Assignor Type: Individual</option>
                  <option value="LLC">Assignor Type: LLC</option>
                </select>
              ) : null}
            </div>

            {form.hasAssignor ? (
              <div className="space-y-3">
                <label className="space-y-1 block">
                  <span className="text-sm font-medium">
                    {form.assignorType === "LLC" ? "Assignor Contact Name" : "Assignor Name"}
                  </span>
                  <input
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                    value={form.assignorName}
                    onChange={(e) => setForm((prev) => ({ ...prev, assignorName: e.target.value }))}
                  />
                </label>
                {form.assignorType === "LLC" ? (
                  <div className="space-y-2">
                    <label className="space-y-1 block">
                      <span className="text-sm font-medium">Assignor LLC Name</span>
                      <input
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                        value={form.assignorLlcName}
                        onChange={(e) => setForm((prev) => ({ ...prev, assignorLlcName: e.target.value }))}
                      />
                    </label>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Assignor LLC Member(s)</span>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-primary"
                          onClick={() => addMember("assignorMembers")}
                        >
                          <Plus size={14} /> Add member
                        </button>
                      </div>
                      <div className="space-y-2">
                        {form.assignorMembers.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No members added.</p>
                        ) : null}
                        {form.assignorMembers.map((member, index) => (
                          <div key={`assignor-member-${index}`} className="flex items-center gap-2">
                            <input
                              className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm"
                              value={member}
                              onChange={(e) => handleMemberChange("assignorMembers", index, e.target.value)}
                            />
                            <button
                              type="button"
                              className="p-2 rounded border border-border text-muted-foreground hover:bg-muted"
                              onClick={() => removeMember("assignorMembers", index)}
                              aria-label="Remove member"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                <label className="space-y-1 block">
                  <span className="text-sm font-medium">Total Assignment Fees</span>
                  <input
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                    placeholder="e.g. 15000"
                    value={form.assignmentFees}
                    onChange={(e) => setForm((prev) => ({ ...prev, assignmentFees: e.target.value }))}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold">Documents</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 block">
                <span className="text-sm font-medium">Purchase Agreement</span>
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UploadCloud size={16} /> Upload PDF or image
                  </div>
                  <input type="file" accept=".pdf,image/*" multiple onChange={(e) => uploadDocs(e.target.files, "purchaseAgreements")} />
                  <div className="space-y-1 text-xs">
                    {form.purchaseAgreements.length === 0 ? <p className="text-muted-foreground">No files uploaded.</p> : null}
                    {form.purchaseAgreements.map((file, idx) => (
                      <p key={`pa-${idx}`} className="truncate">
                        {file.name}
                      </p>
                    ))}
                  </div>
                </div>
              </label>

              <label className="space-y-1 block">
                <span className="text-sm font-medium">Assignment Agreement(s)</span>
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UploadCloud size={16} /> Upload PDF or image
                  </div>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    multiple
                    onChange={(e) => uploadDocs(e.target.files, "assignmentAgreements")}
                  />
                  <div className="space-y-1 text-xs">
                    {form.assignmentAgreements.length === 0 ? (
                      <p className="text-muted-foreground">No files uploaded.</p>
                    ) : null}
                    {form.assignmentAgreements.map((file, idx) => (
                      <p key={`aa-${idx}`} className="truncate">
                        {file.name}
                      </p>
                    ))}
                  </div>
                </div>
              </label>
            </div>
          </section>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Missing: {missing.length === 0 ? "None" : missing.join(", ")}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
              {isSaving ? "Submitting..." : "Submit Form"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
