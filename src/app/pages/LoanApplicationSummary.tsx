import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { LoanRequestEmailPostcard } from "../components/LoanRequestEmailPostcard";
import { StatusBadge } from "../components/StatusBadge";
import { Dialog, DialogContent } from "../components/ui/dialog";
import {
  addLenderPipelineComment,
  fetchLenderPipeline,
  fetchLenderPipelineRecord,
  sendLenderPipelineBorrowerMessage,
  updatePreApprovalDecision,
  type LenderPipelineRecord,
} from "../services/workflowApi";

function selectLatestSummaryTarget(records: LenderPipelineRecord[]) {
  const newLoanRecords = records.filter((item) => item.statusLabel === "New Loan Request");
  const source = newLoanRecords.length > 0 ? newLoanRecords : records;
  if (source.length === 0) return null;
  return [...source].sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

function getDecisionVariant(decision: LenderPipelineRecord["preApprovalDecision"]) {
  if (decision === "PRE_APPROVE") return "success" as const;
  if (decision === "DECLINE") return "danger" as const;
  if (decision === "REQUEST_INFO") return "warning" as const;
  return "default" as const;
}

function getErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (!message || message.includes("<!DOCTYPE html>")) return fallback;
  return message;
}

export function LoanApplicationSummary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loanId = searchParams.get("loanId")?.trim() || "";
  const [record, setRecord] = useState<LenderPipelineRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommentSaving, setIsCommentSaving] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isMessageSaving, setIsMessageSaving] = useState(false);
  const [isDenyOpen, setIsDenyOpen] = useState(false);
  const [denyNotes, setDenyNotes] = useState("");
  const [isDenySaving, setIsDenySaving] = useState(false);

  const isActionBusy = isApproving || isCommentSaving || isMessageSaving || isDenySaving;

  const clearActionStatus = () => {
    setActionError(null);
    setActionSuccess(null);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let targetLoanId = loanId;
        if (!targetLoanId) {
          const pipeline = await fetchLenderPipeline();
          const latest = selectLatestSummaryTarget(pipeline);
          if (!latest) {
            if (!mounted) return;
            setRecord(null);
            setIsLoading(false);
            return;
          }
          targetLoanId = latest.loanId;
        }

        const pipelineRecord = await fetchLenderPipelineRecord(targetLoanId);
        if (!mounted) return;
        setRecord(pipelineRecord);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load loan application summary.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [loanId]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading loan application summary...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 p-8 shadow-sm">
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
        <p className="text-sm text-muted-foreground">No loan application summary is available.</p>
      </div>
    );
  }

  const handleApprove = async () => {
    clearActionStatus();
    setIsApproving(true);
    try {
      const updated = await updatePreApprovalDecision(record.loanId, "PRE_APPROVE");
      setRecord(updated);
      setActionSuccess("Loan approved and moved to pre-approval.");
    } catch (actionLoadError) {
      setActionError(getErrorMessage(actionLoadError, "Failed to approve loan."));
    } finally {
      setIsApproving(false);
    }
  };

  const openCommentModal = () => {
    clearActionStatus();
    setCommentText("");
    setIsCommentOpen(true);
  };

  const handleSaveComment = async () => {
    const normalized = commentText.trim();
    if (!normalized) {
      setActionError("Please enter a comment.");
      return;
    }
    clearActionStatus();
    setIsCommentSaving(true);
    try {
      const updated = await addLenderPipelineComment(record.loanId, normalized);
      setRecord(updated);
      setIsCommentOpen(false);
      setCommentText("");
      setActionSuccess("Comment saved.");
    } catch (actionLoadError) {
      setActionError(getErrorMessage(actionLoadError, "Failed to save comment."));
    } finally {
      setIsCommentSaving(false);
    }
  };

  const openMessageModal = () => {
    clearActionStatus();
    setMessageSubject("");
    setMessageText("");
    setIsMessageOpen(true);
  };

  const handleSendMessage = async () => {
    const normalizedMessage = messageText.trim();
    const normalizedSubject = messageSubject.trim();
    if (!normalizedMessage) {
      setActionError("Please enter a message for the borrower.");
      return;
    }
    clearActionStatus();
    setIsMessageSaving(true);
    try {
      const updated = await sendLenderPipelineBorrowerMessage(record.loanId, normalizedMessage, normalizedSubject);
      setRecord(updated);
      setIsMessageOpen(false);
      setMessageSubject("");
      setMessageText("");
      setActionSuccess("Message sent to borrower email.");
    } catch (actionLoadError) {
      setActionError(getErrorMessage(actionLoadError, "Failed to send borrower message."));
    } finally {
      setIsMessageSaving(false);
    }
  };

  const openDenyModal = () => {
    clearActionStatus();
    setDenyNotes(record.decisionNotes || "");
    setIsDenyOpen(true);
  };

  const handleDeny = async () => {
    const normalized = denyNotes.trim();
    if (!normalized) {
      setActionError("Please provide notes before denying.");
      return;
    }
    clearActionStatus();
    setIsDenySaving(true);
    try {
      const updated = await updatePreApprovalDecision(record.loanId, "DECLINE", normalized);
      setRecord(updated);
      setIsDenyOpen(false);
      setActionSuccess("Loan denied and notes sent to borrower.");
    } catch (actionLoadError) {
      setActionError(getErrorMessage(actionLoadError, "Failed to deny loan."));
    } finally {
      setIsDenySaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary">Loan Application Summary</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dedicated summary page for lender review and decision support.
            </p>
          </div>
          <StatusBadge variant={getDecisionVariant(record.preApprovalDecision)}>
            Decision: {record.preApprovalDecision}
          </StatusBadge>
        </div>
        <div className="mt-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        </div>
      </section>

      {actionError ? (
        <section className="rounded-lg border border-danger/30 bg-danger/10 p-4 shadow-sm">
          <p className="text-sm text-danger">{actionError}</p>
        </section>
      ) : null}
      {actionSuccess ? (
        <section className="rounded-lg border border-success/30 bg-success/10 p-4 shadow-sm">
          <p className="text-sm text-success">{actionSuccess}</p>
        </section>
      ) : null}

      <LoanRequestEmailPostcard
        record={record}
        showDashboardLink={false}
        title="Loan Application Summary"
        subtitle="Review the full request details and submitted supporting documents."
        mode="in-app"
        showHero={false}
        showAccentStripes={false}
        onApprove={handleApprove}
        onLeaveComment={openCommentModal}
        onMessageBorrower={openMessageModal}
        onDenyWithNotes={openDenyModal}
        actionLoading={{
          approve: isApproving,
          comment: isCommentSaving,
          message: isMessageSaving,
          deny: isDenySaving,
        }}
        disableActions={isActionBusy}
      />

      <Dialog open={isCommentOpen} onOpenChange={setIsCommentOpen}>
        <DialogContent className="max-w-xl p-6">
          <h3 className="text-lg font-semibold text-slate-900">Leave Comment</h3>
          <p className="mt-1 text-sm text-muted-foreground">This saves an internal lender comment for this request.</p>
          <textarea
            className="mt-4 w-full min-h-28 rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Enter your internal comment..."
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
              onClick={() => setIsCommentOpen(false)}
              disabled={isCommentSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-900 disabled:opacity-50"
              onClick={handleSaveComment}
              disabled={isCommentSaving}
            >
              {isCommentSaving ? "Saving..." : "Save Comment"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMessageOpen} onOpenChange={setIsMessageOpen}>
        <DialogContent className="max-w-xl p-6">
          <h3 className="text-lg font-semibold text-slate-900">Message Borrower</h3>
          <p className="mt-1 text-sm text-muted-foreground">This sends an email message to the borrower.</p>
          <input
            className="mt-4 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Subject (optional)"
            value={messageSubject}
            onChange={(event) => setMessageSubject(event.target.value)}
          />
          <textarea
            className="mt-3 w-full min-h-28 rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Type your message to borrower..."
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
              onClick={() => setIsMessageOpen(false)}
              disabled={isMessageSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSendMessage}
              disabled={isMessageSaving}
            >
              {isMessageSaving ? "Sending..." : "Send Message"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDenyOpen} onOpenChange={setIsDenyOpen}>
        <DialogContent className="max-w-xl p-6">
          <h3 className="text-lg font-semibold text-slate-900">Deny with Notes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Notes are required and will be sent to the borrower.
          </p>
          <textarea
            className="mt-4 w-full min-h-28 rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Enter denial notes..."
            value={denyNotes}
            onChange={(event) => setDenyNotes(event.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
              onClick={() => setIsDenyOpen(false)}
              disabled={isDenySaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              onClick={handleDeny}
              disabled={isDenySaving}
            >
              {isDenySaving ? "Saving..." : "Deny Loan"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
