import { NavLink, useLocation } from "react-router";
import { LayoutDashboard, FileText, Plus, Users, ClipboardList, Bell, BarChart3, Settings } from "lucide-react";

const links = [
  { to: "/insurance", label: "Insurance Dashboard", icon: LayoutDashboard },
  { to: "/insurance/loans", label: "Loans", icon: FileText },
  { to: "/insurance/loans/add", label: "Add Loan", icon: Plus },
  { to: "/insurance/borrowers", label: "Borrowers", icon: Users },
  { to: "/insurance/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/insurance/force-placed", label: "Force-Placed", icon: Bell },
  { to: "/insurance/reports", label: "Reports", icon: BarChart3 },
  { to: "/insurance/settings", label: "Settings", icon: Settings },
];

export default function InsuranceSidebar() {
  const location = useLocation();
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="text-xl font-semibold text-gray-900">Insurance Tracker</div>
        <p className="text-sm text-gray-500">Lender module</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
