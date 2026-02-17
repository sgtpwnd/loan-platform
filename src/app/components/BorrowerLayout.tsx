import {
  Bell,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
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
    to: "/borrower/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    children: [
      { to: "/borrower/dashboard#overview", label: "Overview" },
      { to: "/borrower/dashboard#payments", label: "Payments" },
      { to: "/borrower/dashboard#activity", label: "Activity" },
      { to: "/borrower/dashboard#loans", label: "Active Loans" },
    ],
  },
  {
    to: "/borrower/applications",
    label: "My Applications",
    icon: FileText,
    children: [
      { to: "/borrower/applications#status", label: "In-Progress" },
      { to: "/apply/new", label: "Start New" },
    ],
  },
  {
    to: "/borrower/active-loans",
    label: "Active Loans",
    icon: FileCheck2,
    children: [
      { to: "/borrower/active-loans#summary", label: "Summary" },
      { to: "/borrower/active-loans#funded", label: "Funded Loans" },
    ],
  },
  {
    to: "/borrower/documents",
    label: "Documents",
    icon: FileText,
    children: [
      { to: "/borrower/documents#checklist", label: "Checklist" },
      { to: "/borrower/documents#uploads", label: "Uploads" },
    ],
  },
  {
    to: "/borrower/payments",
    label: "Payments",
    icon: CreditCard,
    children: [
      { to: "/borrower/payments#overview", label: "Overview" },
      { to: "/borrower/payments#upcoming", label: "Upcoming" },
      { to: "/borrower/payments#history", label: "History" },
    ],
  },
  {
    to: "/borrower/messages",
    label: "Messages",
    icon: MessageSquare,
    children: [
      { to: "/borrower/messages#inbox", label: "Inbox" },
      { to: "/borrower/messages#actions", label: "Quick Actions" },
    ],
  },
  {
    to: "/borrower/conditions",
    label: "Conditions",
    icon: ClipboardList,
    children: [
      { to: "/borrower/conditions#form", label: "Form" },
      { to: "/borrower/conditions#liquidity", label: "Liquidity" },
      { to: "/borrower/conditions#submit", label: "Submit" },
    ],
  },
  {
    to: "/borrower/profile",
    label: "My Profile",
    icon: UserCircle,
    children: [
      { to: "/borrower/profile#contact", label: "Contact" },
      { to: "/borrower/profile#properties", label: "Properties" },
      { to: "/borrower/profile#settings", label: "Settings" },
    ],
  },
];

export function BorrowerLayout() {
  const location = useLocation();
  const shouldRenderFormOnlyLayout =
    location.pathname === "/borrower/applications" || location.pathname === "/borrower/access-setup";

  if (shouldRenderFormOnlyLayout) {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 bg-[#0d3b66] text-white flex flex-col">
        <div className="p-6 border-b border-white/15">
          <h1 className="text-2xl font-bold">LendFlow</h1>
          <p className="text-xs text-white/75 mt-1">Borrower Portal</p>
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
            <p className="text-sm font-medium">Michael Chen</p>
            <p className="text-xs text-white/75">Borrower</p>
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
            <Bell size={18} />
            <span className="text-sm">Secure Borrower Workspace</span>
          </div>
          <div className="text-sm text-muted-foreground">Account Health: Excellent</div>
        </header>
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
