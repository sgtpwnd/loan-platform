import { Link, useNavigate } from "react-router";

export function PublicAnotherLoanRequest() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-xl border border-primary/30 bg-card p-6 shadow-sm">
        <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Submission Complete
        </p>
        <h1 className="mt-3 text-2xl font-bold text-primary">Do you need to submit another loan request?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          If yes, click below to start a new request.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            onClick={() => navigate("/apply/new")}
          >
            Start New Request
          </button>
          <Link
            to="/apply"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}
