import { Outlet } from "react-router";
import InsuranceSidebar from "./InsuranceSidebar";
import Header from "./Header";

export default function InsuranceLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <InsuranceSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
