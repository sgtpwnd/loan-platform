import { CheckCircle2, Lock, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";

export function Login() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<"lender" | "borrower">("lender");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(userType === "lender" ? "/dashboard" : "/borrower/dashboard");
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-background">
      <section className="hidden lg:flex flex-col justify-center bg-gradient-to-br from-[#0d3b66] to-[#0ea5a5] p-12 text-white">
        <div className="max-w-lg">
          <h1 className="text-4xl font-bold leading-tight">LendFlow Enterprise Platform</h1>
          <p className="mt-4 text-white/90 text-lg">Complete Loan Origination and Servicing for modern lenders and borrowers.</p>

          <div className="mt-8 space-y-4">
            {[
              "End-to-end workflow automation",
              "Real-time underwriting insights",
              "Unified borrower communication hub",
            ].map((feature) => (
              <div key={feature} className="rounded-lg border border-white/20 bg-white/10 p-4 flex items-start gap-3">
                <CheckCircle2 className="mt-0.5" size={18} />
                <p className="text-sm">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-primary">Sign In</h2>
            <p className="text-muted-foreground text-sm mt-1">Access your LendFlow workspace</p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted mb-6">
            <button
              type="button"
              onClick={() => setUserType("lender")}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                userType === "lender" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Lender/Officer
            </button>
            <button
              type="button"
              onClick={() => setUserType("borrower")}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                userType === "borrower" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Borrower
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium mb-2 block">Email</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  className="w-full rounded-lg border border-border bg-white pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                  type="email"
                  required
                  defaultValue={userType === "lender" ? "sarah.johnson@lendflow.com" : "michael.chen@email.com"}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium mb-2 block">Password</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  className="w-full rounded-lg border border-border bg-white pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                  type="password"
                  required
                  defaultValue="password123"
                />
              </div>
            </label>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="rounded border-border" defaultChecked />
                Remember me
              </label>
              <button type="button" className="text-primary hover:underline">
                Forgot password?
              </button>
            </div>

            <button type="submit" className="w-full rounded-lg bg-primary text-white py-2.5 font-medium hover:bg-primary/90 transition">
              Sign In
            </button>
          </form>
          <div className="mt-4 border-t border-border pt-4 text-center">
            <p className="text-xs text-muted-foreground">First-time borrower?</p>
            <Link className="mt-2 inline-flex rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20" to="/apply">
              Start First-Time Application
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
