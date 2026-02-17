import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/ui/button";
import {
  createBorrowerAccess,
  fetchWorkflowApplications,
  type WorkflowApplication,
} from "../../services/workflowApi";

const borrowerAccessPasswordPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;

function buildApplicationsSearch(loanId: string) {
  if (!loanId) return "";
  const nextParams = new URLSearchParams();
  nextParams.set("loanId", loanId);
  nextParams.set("continue", "1");
  nextParams.set("fromApp", "1");
  nextParams.set("fromAccessSetup", "1");
  return `?${nextParams.toString()}`;
}

export function BorrowerAccessSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loanId = searchParams.get("loanId")?.trim() || "";
  const prefilledEmail = searchParams.get("email")?.trim() || "";

  const [application, setApplication] = useState<WorkflowApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadApplication() {
      if (!loanId) {
        setError("Missing loan ID for borrower access setup.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const allApplications = await fetchWorkflowApplications();
        if (!mounted) return;
        const selected = allApplications.find((item) => item.id === loanId) || null;
        if (!selected) {
          setError(`Loan ${loanId} was not found.`);
          setIsLoading(false);
          return;
        }
        setApplication(selected);
        setEmail((previous) => {
          if (previous.trim()) return previous;
          return (
            selected.borrowerAccess?.email ||
            selected.borrowerProfile?.email ||
            selected.borrowerEmail ||
            ""
          );
        });
        if (selected.borrowerAccess?.status === "ACCESS_CREATED" || selected.borrowerAccess?.status === "PROFILE_COMPLETED") {
          setIsCompleted(true);
        }
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load borrower access setup.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadApplication();
    return () => {
      mounted = false;
    };
  }, [loanId]);

  const returnSearch = useMemo(() => buildApplicationsSearch(loanId), [loanId]);

  const handleContinueToUnderwriting = () => {
    const targetPath = `/borrower/applications${returnSearch}`;
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.location.href = targetPath;
        window.close();
        return;
      } catch {
        // Fall back to in-tab navigation when opener cannot be redirected.
      }
    }
    navigate(
      {
        pathname: "/borrower/applications",
        search: returnSearch,
      },
      { replace: true }
    );
  };

  const handleCreateAccess = async () => {
    if (!application) return;
    const normalizedEmail = email.trim();
    const profileEmail = application.borrowerProfile?.email?.trim() || "";

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email username to create borrower access.");
      return;
    }
    if (profileEmail && normalizedEmail.toLowerCase() !== profileEmail.toLowerCase()) {
      setError("Username must match the borrower email entered in the borrower information form.");
      return;
    }
    if (!borrowerAccessPasswordPattern.test(password)) {
      setError("Password must be at least 6 characters, alphanumeric, with at least one letter and one number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const updated = await createBorrowerAccess(application.id, {
        email: normalizedEmail,
        password,
        confirmPassword,
      });
      setApplication(updated);
      setPassword("");
      setConfirmPassword("");
      setIsCompleted(true);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create borrower access.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <LockKeyhole size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Borrower Access Setup</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create borrower login credentials in this secure window, then continue to the underwriting form.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            Loading borrower access details...
          </div>
        ) : null}

        {!isLoading && application ? (
          <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Loan</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{application.id}</p>
            <p className="mt-1 text-sm text-muted-foreground">{application.property}</p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {!isLoading && isCompleted ? (
          <div className="mt-6 rounded-lg border border-success/30 bg-success/10 p-4">
            <div className="flex items-start gap-2 text-success">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Borrower access is ready.</p>
                <p className="mt-1 text-xs text-success/90">
                  Continue to the underwriting form to complete and submit the rest of your loan package.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={handleContinueToUnderwriting}>
                Continue to Underwriting Form
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(
                    {
                      pathname: "/borrower/applications",
                      search: returnSearch,
                    },
                    { replace: true }
                  )
                }
              >
                Open in This Window
              </Button>
            </div>
          </div>
        ) : null}

        {!isLoading && !isCompleted ? (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateAccess();
            }}
          >
            <label className="block">
              <span className="mb-1 block text-sm text-muted-foreground">Username (Email)</span>
              <input
                type="email"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                placeholder="name@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-muted-foreground">Password</span>
              <input
                type="password"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                placeholder="Minimum 6 characters, letters + numbers"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-muted-foreground">Confirm Password</span>
              <input
                type="password"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" size="sm" disabled={isSaving || !application}>
                {isSaving ? "Creating Access..." : "Create Borrower Access"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(
                    {
                      pathname: "/borrower/applications",
                      search: loanId ? `?loanId=${encodeURIComponent(loanId)}&fromApp=1` : "",
                    },
                    { replace: true }
                  )
                }
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
