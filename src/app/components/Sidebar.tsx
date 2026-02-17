import { NavLink, useLocation } from "react-router";
import { LayoutDashboard, Users, FileText, Settings } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  // LOS core nav only; insurance module has its own sidebar
  { to: "/origination", label: "Loan Origination", icon: FileText },
  { to: "/underwriting", label: "Underwriting", icon: FileText },
  { to: "/servicing", label: "Loan Servicing", icon: FileText },
  { to: "/borrower", label: "Borrower Profile", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="text-xl font-semibold text-gray-900">Lender Insurance</div>
        <p className="text-sm text-gray-500">Tracking Platform</p>
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
      <div className="p-4 border-t border-gray-200">
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-sm font-medium text-gray-900">Need help?</p>
          <p className="text-xs text-gray-600">Contact support@lendflow.com</p>
        </div>
      </div>
    </aside>
  );
}
