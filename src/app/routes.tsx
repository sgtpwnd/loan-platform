import { createBrowserRouter, Navigate, useParams } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { BorrowerLayout } from "./components/BorrowerLayout";
import { Login } from "./pages/Login";
import { LoanOrigination } from "./pages/LoanOrigination";
import { UnderwritingEnhanced } from "./pages/UnderwritingEnhanced";
import { LoanServicing } from "./pages/LoanServicing";
import { BorrowerProfile } from "./pages/BorrowerProfile";
// AdminSettings kept for legacy paths; using new Settings for insurance module
import { BorrowerDashboard } from "./pages/borrower/BorrowerDashboard";
import { MyApplications } from "./pages/borrower/MyApplications";
import { BorrowerAccessSetup } from "./pages/borrower/BorrowerAccessSetup";
import { ActiveLoans } from "./pages/borrower/ActiveLoans";
import { MyDocuments } from "./pages/borrower/MyDocuments";
import { PaymentPortal } from "./pages/borrower/PaymentPortal";
import { Messages } from "./pages/borrower/Messages";
import { BorrowerProfile as BorrowerProfilePage } from "./pages/borrower/BorrowerProfile";
import { Conditions } from "./pages/borrower/Conditions";
import { PublicApply } from "./pages/PublicApply";
import { PublicNewApplication } from "./pages/PublicNewApplication";
import { PublicAnotherLoanRequest } from "./pages/PublicAnotherLoanRequest";
import { LenderNewLoanRequest } from "./pages/LenderNewLoanRequest";
import { LoanApplicationSummary } from "./pages/LoanApplicationSummary";
import { LoanOfficerDashboard } from "./pages/LoanOfficerDashboard";
import { EvaluatorDashboard } from "./pages/EvaluatorDashboard";
import { TitleAgentForm } from "./pages/TitleAgentForm";
import Dashboard from "./pages/Dashboard";
import Borrowers from "./pages/Borrowers";
import BorrowerDetail from "./pages/BorrowerDetail";
import LoanDetail from "./pages/LoanDetail";
import AddLoan from "./pages/AddLoan";
import Loans from "./pages/Loans";
import Tasks from "./pages/Tasks";
import ForcePlaced from "./pages/ForcePlaced";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import BorrowerPortal from "./pages/BorrowerPortal";
import InsuranceLayout from "./components/InsuranceLayout";
import InsuranceDashboard from "./pages/InsuranceDashboard";

function RedirectLoans() {
  return <Navigate to="/insurance/loans" replace />;
}

function RedirectLoanDetail() {
  const { id } = useParams();
  return <Navigate to={`/insurance/loans/${id ?? ""}`} replace />;
}

function RedirectBorrowers() {
  return <Navigate to="/insurance/borrowers" replace />;
}

function RedirectBorrowerDetail() {
  const { id } = useParams();
  return <Navigate to={`/insurance/borrowers/${id ?? ""}`} replace />;
}

function RedirectTasks() {
  return <Navigate to="/insurance/tasks" replace />;
}

function RedirectForcePlaced() {
  return <Navigate to="/insurance/force-placed" replace />;
}

function RedirectReports() {
  return <Navigate to="/insurance/reports" replace />;
}

export const router = createBrowserRouter([
  {
    path: "/title-agent-form/:loanId",
    Component: TitleAgentForm,
  },
  {
    path: "/apply",
    Component: PublicApply,
  },
  {
    path: "/apply/new",
    Component: PublicNewApplication,
  },
  {
    path: "/apply/new/submitted",
    Component: PublicAnotherLoanRequest,
  },
  {
    path: "/lender/new-loan-request",
    Component: LenderNewLoanRequest,
  },
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "dashboard", Component: Dashboard },
      { path: "loan-officer-dashboard", Component: LoanOfficerDashboard },
      { path: "evaluator-dashboard", Component: EvaluatorDashboard },
      { path: "loan-application-summary", Component: LoanApplicationSummary },
      { path: "origination", Component: LoanOrigination },
      { path: "underwriting", Component: UnderwritingEnhanced },
      { path: "servicing", Component: LoanServicing },
      { path: "borrower", Component: BorrowerProfile },
      { path: "settings", Component: Settings },
      // Insurance tracker module + supporting routes
      // (removed from main LOS)
    ],
  },
  {
    path: "/insurance",
    Component: InsuranceLayout,
    children: [
      { index: true, Component: InsuranceDashboard },
      { path: "loans", Component: Loans },
      { path: "loans/add", Component: AddLoan },
      { path: "loans/:id", Component: LoanDetail },
      { path: "borrowers", Component: Borrowers },
      { path: "borrowers/:id", Component: BorrowerDetail },
      { path: "tasks", Component: Tasks },
      { path: "force-placed", Component: ForcePlaced },
      { path: "reports", Component: Reports },
      { path: "settings", Component: Settings },
    ],
  },
  {
    path: "/login",
    Component: Login,
  },
  // Legacy links: redirect old insurance URLs to module namespace
  { path: "/loans", Component: RedirectLoans },
  { path: "/loans/:id", Component: RedirectLoanDetail },
  { path: "/borrowers", Component: RedirectBorrowers },
  { path: "/borrowers/:id", Component: RedirectBorrowerDetail },
  { path: "/tasks", Component: RedirectTasks },
  { path: "/force-placed", Component: RedirectForcePlaced },
  { path: "/reports", Component: RedirectReports },
  {
    path: "/borrower",
    Component: BorrowerLayout,
    children: [
      { path: "dashboard", Component: BorrowerDashboard },
      { path: "applications", Component: MyApplications },
      { path: "access-setup", Component: BorrowerAccessSetup },
      { path: "active-loans", Component: ActiveLoans },
      { path: "documents", Component: MyDocuments },
      { path: "payments", Component: PaymentPortal },
      { path: "messages", Component: Messages },
      { path: "profile", Component: BorrowerProfilePage },
      { path: "conditions", Component: Conditions },
    ],
  },
  {
    path: "/portal/:loanId",
    Component: BorrowerPortal,
  },
]);
