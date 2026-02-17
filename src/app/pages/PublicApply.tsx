import { useNavigate } from "react-router";

export function PublicApply() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-xl border border-primary/30 bg-card p-6 shadow-sm">
        <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          First-time borrower
        </p>
        <h1 className="mt-3 text-2xl font-bold text-primary">Start your new loan request</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No signup is required right now. Submit your loan request first. If pre-approved, you will be prompted to
          create borrower access and complete your profile.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            onClick={() => navigate("/apply/new")}
          >
            Continue to application
          </button>
          <p className="text-xs text-muted-foreground">You will continue to a separate public application page.</p>
        </div>
      </div>
    </div>
  );
}
