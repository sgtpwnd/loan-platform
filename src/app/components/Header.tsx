import { Bell, Search, User } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        <Search size={18} className="text-gray-400" />
        <input
          className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search loans, borrowers..."
          aria-label="Search"
        />
      </div>
      <div className="flex items-center gap-4 ml-4">
        <button
          aria-label="Notifications"
          className="relative p-2 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="button"
        >
          <Bell size={18} className="text-gray-600" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
            SJ
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">Sarah Johnson</p>
            <p className="text-xs text-gray-500">Insurance Lead</p>
          </div>
          <User size={16} className="text-gray-500" />
        </div>
      </div>
    </header>
  );
}
