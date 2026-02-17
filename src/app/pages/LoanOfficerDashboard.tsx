import { ValuationRoleDashboard } from "../components/ValuationRoleDashboard";

export function LoanOfficerDashboard() {
  return (
    <ValuationRoleDashboard
      role="LOAN_OFFICER"
      title="Loan Officer Dashboard"
      subtitle="Complete required valuation inputs when a loan reaches In-underwriting. Saved values flow directly to Underwriting Enhanced."
    />
  );
}
