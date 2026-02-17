import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { LoanRequestEmailPostcard } from "../components/LoanRequestEmailPostcard";
import {
  fetchLenderPipeline,
  fetchLenderPipelineRecord,
  type LenderPipelineRecord,
} from "../services/workflowApi";

function selectLatestNewLoan(records: LenderPipelineRecord[]) {
  const newLoanRecords = records.filter((item) => item.statusLabel === "New Loan Request");
  const source = newLoanRecords.length > 0 ? newLoanRecords : records;
  if (source.length === 0) return null;
  return [...source].sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

export function LenderNewLoanRequest() {
  const [searchParams] = useSearchParams();
  const loanId = searchParams.get("loanId")?.trim() || "";
  const [record, setRecord] = useState<LenderPipelineRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let targetLoanId = loanId;
        if (!targetLoanId) {
          const pipeline = await fetchLenderPipeline();
          const latest = selectLatestNewLoan(pipeline);
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
        setError(loadError instanceof Error ? loadError.message : "Failed to load loan request.");
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
      <div className="flex min-h-screen items-center justify-center bg-slate-200 px-4">
        <p className="text-base font-medium text-slate-700">Loading new loan request...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-200 px-4">
        <p className="max-w-2xl text-center text-base font-medium text-red-700">{error}</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-200 px-4">
        <p className="text-base font-medium text-slate-700">No loan request was found.</p>
      </div>
    );
  }

  return <LoanRequestEmailPostcard record={record} showDashboardLink={false} />;
}
