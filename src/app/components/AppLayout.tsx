import {
  BarChart3,
  ShieldCheck,
  ClipboardCheck,
  FileBadge,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Settings,
  UserCircle,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  children?: Array<{ to: string; label: string }>;
};

const navItems: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    children: [
      { to: "/dashboard#overview", label: "Overview" },
      { to: "/dashboard#notifications", label: "Notifications" },
    ],
  },
  {
    to: "/loan-officer-dashboard",
    label: "Loan Officer",
    icon: UserCircle,
    children: [
      { to: "/loan-officer-dashboard#queue", label: "Queue" },
      { to: "/loan-officer-dashboard#new", label: "New Request" },
    ],
  },
  {
    to: "/evaluator-dashboard",
    label: "Evaluator",
    icon: ClipboardCheck,
    children: [
      { to: "/evaluator-dashboard#pipeline", label: "Pipeline" },
      { to: "/evaluator-dashboard#assessments", label: "Assessments" },
    ],
  },
  {
    to: "/origination",
    label: "Loan Origination",
    icon: FileBadge,
    children: [
      { to: "/origination#new-loan", label: "New Loan" },
      { to: "/origination#drafts", label: "Drafts" },
    ],
  },
  {
    to: "/underwriting",
    label: "Underwriting",
    icon: ClipboardCheck,
    children: [
      { to: "/underwriting#pipeline", label: "Pipeline" },
      { to: "/underwriting#conditions", label: "Conditions" },
    ],
  },
  {
    to: "/servicing",
    label: "Loan Servicing",
    icon: HandCoins,
    children: [
      { to: "/servicing#active", label: "Active Loans" },
      { to: "/servicing#payoffs", label: "Payoffs" },
    ],
  },
  {
    to: "/borrower",
    label: "Borrower Profile",
    icon: UserCircle,
    children: [
      { to: "/borrower#profiles", label: "Profiles" },
      { to: "/borrower#invites", label: "Invites" },
    ],
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    children: [
      { to: "/settings#preferences", label: "Preferences" },
      { to: "/settings#users", label: "Users" },
    ],
  },
  {
    to: "/insurance",
    label: "Insurance Tracker",
    icon: ShieldCheck,
    children: [
      { to: "/insurance", label: "Module Dashboard" },
      { to: "/insurance/loans", label: "Insurance Loans" },
      { to: "/insurance/borrowers", label: "Borrowers" },
    ],
  },
];

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 bg-[#0d3b66] text-white flex flex-col">
        <div className="p-6 border-b border-white/15">
          <h1 className="text-2xl font-bold">LendFlow</h1>
          <p className="text-xs text-white/75 mt-1">Loan Management Platform</p>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isParentActive = location.pathname === item.to || location.pathname.startsWith(item.to);
            return (
              <div key={item.to} className="space-y-1">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition ${
                      isActive ? "bg-[#0ea5a5] text-white" : "text-white/85 hover:bg-white/10"
                    }`
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
                {item.children && item.children.length ? (
                  <div className="ml-8 space-y-1">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          `block rounded-md px-3 py-2 text-xs transition ${
                            isActive || isParentActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/10"
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/15 space-y-3">
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-sm font-medium">Sarah Johnson</p>
            <p className="text-xs text-white/75">Loan Officer</p>
          </div>
          <NavLink to="/" className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm bg-white/10 hover:bg-white/20 transition">
            <LogOut size={16} />
            Logout
          </NavLink>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="h-16 px-8 border-b border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 size={18} />
            <span className="text-sm">Enterprise Loan Operations</span>
          </div>
          <div className="text-sm text-muted-foreground">February 2026</div>
        </header>
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
