import { BadgeCheck, BriefcaseBusiness, CalendarDays, Mail, MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { StatusBadge } from "../../components/StatusBadge";

export function BorrowerProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [autoPay, setAutoPay] = useState(true);
  const profileSearchParams = new URLSearchParams(location.search);
  const shouldRedirectToApplicationsFromProfile =
    Boolean(profileSearchParams.get("loanId")) ||
    profileSearchParams.get("createAccess") === "1" ||
    profileSearchParams.get("continue") === "1";

  useEffect(() => {
    if (!shouldRedirectToApplicationsFromProfile) return;
    navigate(
      {
        pathname: "/borrower/applications",
        search: location.search,
      },
      { replace: true }
    );
  }, [location.search, navigate, shouldRedirectToApplicationsFromProfile]);

  if (shouldRedirectToApplicationsFromProfile) return null;

  return (
    <div className="space-y-6">
      <header id="contact">
        <h1 className="text-3xl font-bold text-primary">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your personal, financial, and account settings.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <article className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-semibold">M</div>
              <div>
                <h2 className="text-xl font-semibold">Michael Chen</h2>
                <p className="text-sm text-muted-foreground">Borrower</p>
              </div>
            </div>
            <StatusBadge variant="success" className="mt-4"><BadgeCheck size={12} className="mr-1" />Verified</StatusBadge>

            <div className="mt-6 space-y-3 text-sm">
              <p className="flex items-center gap-2"><Mail size={14} className="text-muted-foreground" /> michael.chen@email.com</p>
              <p className="flex items-center gap-2"><Phone size={14} className="text-muted-foreground" /> (512) 555-0142</p>
              <p className="flex items-center gap-2"><MapPin size={14} className="text-muted-foreground" /> 123 Main St, Austin, TX</p>
              <p className="flex items-center gap-2"><CalendarDays size={14} className="text-muted-foreground" /> DOB: May 12, 1992</p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-3">Employment</h3>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><BriefcaseBusiness size={14} className="text-muted-foreground" /> Tech Solutions Inc</p>
              <p>Position: <strong>Senior Software Engineer</strong></p>
              <p>Years: <strong>4.5</strong></p>
              <p>Income: <strong>$125K</strong></p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold">Credit Score</h3>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-3xl font-bold">742</p>
              <StatusBadge variant="success">Excellent</StatusBadge>
            </div>
            <div className="mt-4 h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-success" style={{ width: "85%" }} />
            </div>
          </article>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <article id="properties" className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Properties</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <h4 className="font-semibold">123 Main St</h4>
                <p className="text-sm text-muted-foreground">Single Family • Primary Residence</p>
                <p className="text-sm mt-3">Purchase: <strong>$450K</strong></p>
                <p className="text-sm">Current Value: <strong>$475K</strong></p>
                <p className="text-sm">Balance: <strong>$435K</strong></p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <h4 className="font-semibold">456 Oak Ave</h4>
                <p className="text-sm text-muted-foreground">Condo • Investment</p>
                <p className="text-sm mt-3">Purchase: <strong>$285K</strong></p>
                <p className="text-sm">Current Value: <strong>$310K</strong></p>
                <p className="text-sm">Balance: <strong>$272,555</strong></p>
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Payment Methods</h3>
            <div className="space-y-2 text-sm">
              <div className="rounded-lg border border-border px-3 py-2 flex justify-between items-center">
                <span>Chase Checking ••••1234</span>
                <StatusBadge variant="success">Default</StatusBadge>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">Wells Fargo Savings ••••5678</div>
            </div>
          </article>

          <article id="settings" className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Account Settings</h3>
            <div className="space-y-3">
              <Toggle label="Email Notifications" checked={emailNotifications} onChange={setEmailNotifications} />
              <Toggle label="SMS Alerts" checked={smsAlerts} onChange={setSmsAlerts} />
              <Toggle label="Auto-Pay" checked={autoPay} onChange={setAutoPay} />
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <span className="text-sm">Two-Factor Authentication</span>
                <button className="rounded-lg bg-primary text-white px-3 py-1.5 text-sm hover:bg-primary/90">Enable</button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-border px-4 py-3 cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`h-6 w-11 rounded-full transition flex items-center px-1 ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </label>
  );
}
