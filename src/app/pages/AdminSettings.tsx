import { useEffect, useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import {
  fetchUnderwritingSettings,
  updateUnderwritingSettings,
  type UnderwritingSettings,
} from "../services/workflowApi";

const users = [
  {
    name: "Sarah Johnson",
    email: "sarah.johnson@lendflow.com",
    role: "Loan Officer",
    status: "Active",
    lastLogin: "Today, 09:42 AM",
  },
  {
    name: "Mark Alvarez",
    email: "mark.alvarez@lendflow.com",
    role: "Underwriter",
    status: "Active",
    lastLogin: "Today, 08:11 AM",
  },
  {
    name: "Nina Patel",
    email: "nina.patel@lendflow.com",
    role: "Processor",
    status: "Active",
    lastLogin: "Yesterday",
  },
  {
    name: "Jason Kim",
    email: "jason.kim@lendflow.com",
    role: "Admin",
    status: "Active",
    lastLogin: "Today, 11:05 AM",
  },
  {
    name: "Alicia Reed",
    email: "alicia.reed@lendflow.com",
    role: "Loan Officer",
    status: "Invited",
    lastLogin: "-",
  },
  {
    name: "Paul Walker",
    email: "paul.walker@lendflow.com",
    role: "Underwriter",
    status: "Active",
    lastLogin: "2 days ago",
  },
  {
    name: "Jenny Li",
    email: "jenny.li@lendflow.com",
    role: "Processor",
    status: "Inactive",
    lastLogin: "1 week ago",
  },
  {
    name: "Chris Nolan",
    email: "chris.nolan@lendflow.com",
    role: "Admin",
    status: "Active",
    lastLogin: "Today, 10:20 AM",
  },
];

type UnderwritingSettingsForm = {
  monthlyServiceFee: number;
  documentPreparationFee: number;
  closingCostEstimate: number;
  originationFeePercent: number;
  prepaidInterestRatePercent: number;
  perDiemDayCountBasis: number;
  minLiquidityRatio: number;
  excellentLiquidityRatio: number;
  minCreditScore: number;
  maxLtvPercent: number;
  maxOtherMortgageLoans: number;
};

const defaultUnderwritingSettingsForm: UnderwritingSettingsForm = {
  monthlyServiceFee: 950,
  documentPreparationFee: 250,
  closingCostEstimate: 6000,
  originationFeePercent: 5,
  prepaidInterestRatePercent: 13,
  perDiemDayCountBasis: 360,
  minLiquidityRatio: 2,
  excellentLiquidityRatio: 4,
  minCreditScore: 680,
  maxLtvPercent: 75,
  maxOtherMortgageLoans: 5,
};

function toDisplayPercent(value: number) {
  return Number.isFinite(value) ? value * 100 : 0;
}

function parsePercentToRatio(value: number) {
  return Number.isFinite(value) ? value / 100 : 0;
}

function mapSettingsToForm(settings: UnderwritingSettings): UnderwritingSettingsForm {
  return {
    monthlyServiceFee: settings.monthlyServiceFee,
    documentPreparationFee: settings.documentPreparationFee,
    closingCostEstimate: settings.closingCostEstimate,
    originationFeePercent: settings.originationFeePercent,
    prepaidInterestRatePercent: toDisplayPercent(settings.prepaidInterestAnnualRate),
    perDiemDayCountBasis: settings.perDiemDayCountBasis,
    minLiquidityRatio: settings.acceptableLiquidityRatio,
    excellentLiquidityRatio: settings.excellentLiquidityRatio,
    minCreditScore: settings.minCreditScore,
    maxLtvPercent: toDisplayPercent(settings.maxLtv),
    maxOtherMortgageLoans: settings.maxOtherMortgageLoans,
  };
}

function mapFormToSettings(form: UnderwritingSettingsForm): Partial<UnderwritingSettings> {
  return {
    monthlyServiceFee: form.monthlyServiceFee,
    documentPreparationFee: form.documentPreparationFee,
    closingCostEstimate: form.closingCostEstimate,
    originationFeePercent: form.originationFeePercent,
    prepaidInterestAnnualRate: parsePercentToRatio(form.prepaidInterestRatePercent),
    perDiemDayCountBasis: form.perDiemDayCountBasis,
    acceptableLiquidityRatio: form.minLiquidityRatio,
    excellentLiquidityRatio: form.excellentLiquidityRatio,
    minCreditScore: form.minCreditScore,
    maxLtv: parsePercentToRatio(form.maxLtvPercent),
    maxOtherMortgageLoans: form.maxOtherMortgageLoans,
  };
}

export function AdminSettings() {
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "system" | "underwriting">("users");
  const [underwritingForm, setUnderwritingForm] = useState<UnderwritingSettingsForm>(defaultUnderwritingSettingsForm);
  const [isUnderwritingLoading, setIsUnderwritingLoading] = useState(true);
  const [isUnderwritingSaving, setIsUnderwritingSaving] = useState(false);
  const [underwritingMessage, setUnderwritingMessage] = useState<string | null>(null);
  const [underwritingError, setUnderwritingError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await fetchUnderwritingSettings();
        if (cancelled) return;
        setUnderwritingForm(mapSettingsToForm(settings));
        setUnderwritingError(null);
      } catch (error) {
        if (cancelled) return;
        setUnderwritingError(error instanceof Error ? error.message : "Failed to load underwriting settings.");
      } finally {
        if (!cancelled) setIsUnderwritingLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setNumericField = (field: keyof UnderwritingSettingsForm, rawValue: string) => {
    const parsed = Number(rawValue);
    setUnderwritingForm((previous) => ({
      ...previous,
      [field]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  const handleSaveUnderwritingSettings = async () => {
    setUnderwritingMessage(null);
    setUnderwritingError(null);
    setIsUnderwritingSaving(true);
    try {
      const saved = await updateUnderwritingSettings(mapFormToSettings(underwritingForm));
      setUnderwritingForm(mapSettingsToForm(saved));
      setUnderwritingMessage("Underwriting settings saved. New values are now applied to underwriting summaries.");
    } catch (error) {
      setUnderwritingError(error instanceof Error ? error.message : "Failed to save underwriting settings.");
    } finally {
      setIsUnderwritingSaving(false);
    }
  };

  const handleResetUnderwritingSettings = async () => {
    setUnderwritingMessage(null);
    setUnderwritingError(null);
    setIsUnderwritingSaving(true);
    try {
      const saved = await updateUnderwritingSettings(mapFormToSettings(defaultUnderwritingSettingsForm));
      setUnderwritingForm(mapSettingsToForm(saved));
      setUnderwritingMessage("Underwriting settings reset to defaults.");
    } catch (error) {
      setUnderwritingError(error instanceof Error ? error.message : "Failed to reset underwriting settings.");
    } finally {
      setIsUnderwritingSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">Admin Settings</h1>
          <p className="text-muted-foreground mt-1">Manage users, permissions, and system configuration.</p>
        </div>
        <button className="rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary/90 transition">
          Add User
        </button>
      </header>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap gap-6 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-4 px-2 border-b-2 transition-colors ${
              activeTab === "users"
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab("roles")}
            className={`pb-4 px-2 border-b-2 transition-colors ${
              activeTab === "roles"
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Roles
          </button>
          <button
            onClick={() => setActiveTab("system")}
            className={`pb-4 px-2 border-b-2 transition-colors ${
              activeTab === "system"
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            System Settings
          </button>
          <button
            onClick={() => setActiveTab("underwriting")}
            className={`pb-4 px-2 border-b-2 transition-colors ${
              activeTab === "underwriting"
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Underwriting Settings
          </button>
        </div>

        {activeTab === "users" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Last Login</th>
                  <th className="py-3 pr-0">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.email} className="border-b border-border hover:bg-muted/30">
                    <td className="py-3 pr-4 font-medium">{user.name}</td>
                    <td className="py-3 pr-4">{user.email}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge
                        variant={
                          user.role === "Admin"
                            ? "info"
                            : user.role === "Underwriter"
                              ? "warning"
                              : user.role === "Processor"
                                ? "default"
                                : "success"
                        }
                      >
                        {user.role}
                      </StatusBadge>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge
                        variant={
                          user.status === "Active"
                            ? "success"
                            : user.status === "Invited"
                              ? "info"
                              : "danger"
                        }
                      >
                        {user.status}
                      </StatusBadge>
                    </td>
                    <td className="py-3 pr-4">{user.lastLogin}</td>
                    <td className="py-3 pr-0 space-x-3">
                      <button className="text-primary hover:underline">Edit</button>
                      <button className="text-[#ef4444] hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "roles" && (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { name: "Admin", desc: "Full system access, user management, and policy control." },
              { name: "Loan Officer", desc: "Manages origination pipeline and borrower communication." },
              {
                name: "Underwriter",
                desc: "Reviews risk, credit, and approves/declines applications.",
              },
              { name: "Processor", desc: "Validates documents and coordinates closing preparation." },
            ].map((role) => (
              <div key={role.name} className="rounded-lg border border-border p-4">
                <h3 className="font-semibold">{role.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{role.desc}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "system" && (
          <div className="space-y-4">
            <Setting label="Enable Auto Underwriting Recommendations" defaultChecked />
            <Setting label="Require 2FA for Admins" defaultChecked />
            <Setting label="Daily Portfolio Summary Emails" defaultChecked />
            <Setting label="Borrower SMS Payment Reminders" defaultChecked={false} />
          </div>
        )}

        {activeTab === "underwriting" && (
          <div className="max-w-3xl">
            {isUnderwritingLoading ? (
              <div className="mb-4 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Loading underwriting settings...
              </div>
            ) : null}
            {underwritingMessage ? (
              <div className="mb-4 rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 px-4 py-3 text-sm text-[#047857]">
                {underwritingMessage}
              </div>
            ) : null}
            {underwritingError ? (
              <div className="mb-4 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-4 py-3 text-sm text-[#b91c1c]">
                {underwritingError}
              </div>
            ) : null}
            <div className="bg-card rounded-lg p-6 shadow-sm border border-border mb-6">
              <h2 className="text-lg font-semibold mb-2">Liquidity Calculation Settings</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Configure the 6-month liquidity formula inputs used by underwriting analysis.
              </p>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Service Fee (Monthly) - $</label>
                  <input
                    type="number"
                    value={underwritingForm.monthlyServiceFee}
                    onChange={(event) => setNumericField("monthlyServiceFee", event.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    One-time service fee added to the required liquidity amount
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Document Preparation Fee - $</label>
                  <input
                    type="number"
                    value={underwritingForm.documentPreparationFee}
                    onChange={(event) => setNumericField("documentPreparationFee", event.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                  <p className="text-xs text-muted-foreground mt-1">One-time fee added to the required liquidity amount</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Closing Cost Estimate - $</label>
                  <input
                    type="number"
                    value={underwritingForm.closingCostEstimate}
                    onChange={(event) => setNumericField("closingCostEstimate", event.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Fixed closing cost estimate included in liquidity requirements</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Origination Fee - %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={underwritingForm.originationFeePercent}
                    onChange={(event) => setNumericField("originationFeePercent", event.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Origination Fee = (Total Loan Amount / 100) x this percentage
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Prepaid Interest Rate - %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={underwritingForm.prepaidInterestRatePercent}
                    onChange={(event) => setNumericField("prepaidInterestRatePercent", event.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used in Per Diem: ((Total Loan Amount / 100) x rate) / {underwritingForm.perDiemDayCountBasis}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Per Diem Day Count Basis</label>
                  <input
                    type="number"
                    value={underwritingForm.perDiemDayCountBasis}
                    onChange={(event) => setNumericField("perDiemDayCountBasis", event.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Per Diem and prepaid-interest calculations use this day-count basis.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium">Per Diem &amp; Prepaid Interest Calculation</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per Diem = ((Total Loan Amount / 100) x {underwritingForm.prepaidInterestRatePercent}) /{" "}
                    {underwritingForm.perDiemDayCountBasis}.
                    Prepaid Interest = Per Diem x Days, where Days = target closing date to the first day of the
                    following month.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium">Configured Formula</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Required Liquidity = (Monthly Interest x 6) + (${underwritingForm.monthlyServiceFee}) + $
                    {underwritingForm.documentPreparationFee} + ${underwritingForm.closingCostEstimate} +
                    (Sum of Other-Loan Monthly Payments x 6) + (Total Other Mortgage Exposure x 6) + Origination Fee +
                    Prepaid Interest.
                    Origination Fee = (Total Loan Amount / 100) x {underwritingForm.originationFeePercent}. Prepaid
                    Interest = Per Diem x Days, where Per Diem = ((Total Loan Amount / 100) x{" "}
                    {underwritingForm.prepaidInterestRatePercent}) / {underwritingForm.perDiemDayCountBasis} and Days
                    = target closing date to the first day of the following month.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Minimum Liquidity Ratio (Acceptable)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={underwritingForm.minLiquidityRatio}
                    onChange={(event) => setNumericField("minLiquidityRatio", event.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Loans below this ratio will show warning indicator
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Excellent Liquidity Ratio (Low Risk)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={underwritingForm.excellentLiquidityRatio}
                    onChange={(event) => setNumericField("excellentLiquidityRatio", event.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Loans above this ratio will show success indicator
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 shadow-sm border border-border mb-6">
              <h2 className="text-lg font-semibold mb-2">Risk Assessment Settings</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Configure parameters for automated risk evaluation.
                LTV (Desktop) = Total Loan Amount ÷ Appraisal Value.
                LTV (Evaluator ARV) = Total Loan Amount ÷ Evaluator ARV.
              </p>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Minimum Credit Score</label>
                  <input
                    type="number"
                    value={underwritingForm.minCreditScore}
                    onChange={(event) => setNumericField("minCreditScore", event.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Maximum LTV Ratio (%)</label>
                  <input
                    type="number"
                    value={underwritingForm.maxLtvPercent}
                    onChange={(event) => setNumericField("maxLtvPercent", event.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Maximum Number of Other Loans</label>
                  <input
                    type="number"
                    value={underwritingForm.maxOtherMortgageLoans}
                    onChange={(event) => setNumericField("maxOtherMortgageLoans", event.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum loans from other lenders before triggering warning
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 shadow-sm border border-border mb-6">
              <h2 className="text-lg font-semibold mb-2">Negative Borrower Sources</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Configure external sources for borrower verification
              </p>
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="checkForecasa"
                    defaultChecked
                    className="w-4 h-4 border-border rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="checkForecasa" className="text-sm">
                    Check Forecasa Database for Negative Remarks
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="checkRegisterOfDeeds"
                    defaultChecked
                    className="w-4 h-4 border-border rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="checkRegisterOfDeeds" className="text-sm">
                    Check Register of Deeds for Liens and Judgments
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="checkInternalList"
                    defaultChecked
                    className="w-4 h-4 border-border rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="checkInternalList" className="text-sm">
                    Check Internal Negative Borrower List
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="checkBankruptcy"
                    defaultChecked
                    className="w-4 h-4 border-border rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="checkBankruptcy" className="text-sm">
                    Check Bankruptcy Records (Federal Database)
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 shadow-sm border border-border mb-6">
              <h2 className="text-lg font-semibold mb-2">Auto-Calculation Settings</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Enable automatic calculations during underwriting review
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoCalcLiquidity"
                    defaultChecked
                    className="w-4 h-4 border-border rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="autoCalcLiquidity" className="text-sm">
                    Auto-calculate liquidity ratio based on asset and loan data
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoCalcInterest"
                    defaultChecked
                    className="w-4 h-4 border-border rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="autoCalcInterest" className="text-sm">
                    Auto-calculate monthly interest from loan amount and interest rate
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoCalcClosing"
                    defaultChecked
                    className="w-4 h-4 border-border rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="autoCalcClosing" className="text-sm">
                    Use fixed closing cost estimate in liquidity formula
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoCalcOtherLoanPayments"
                    defaultChecked
                    className="w-4 h-4 border-border rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="autoCalcOtherLoanPayments" className="text-sm">
                    Include other-loan monthly payments in the 6-month liquidity requirement
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoCalcLTV"
                    defaultChecked
                    className="w-4 h-4 border-border rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="autoCalcLTV" className="text-sm">
                    Auto-calculate LTV from loan amount and property value
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 shadow-sm border border-border mb-6">
              <h2 className="text-lg font-semibold mb-2">Property Requirements</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Configure requirements for property documentation
              </p>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Minimum Number of Property Photos Required</label>
                  <input
                    type="number"
                    defaultValue="4"
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="requirePhotos"
                    defaultChecked
                    className="w-4 h-4 border-border rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="requirePhotos" className="text-sm">
                    Require property photos before approval
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => void handleSaveUnderwritingSettings()}
                disabled={isUnderwritingSaving || isUnderwritingLoading}
                className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-60"
              >
                {isUnderwritingSaving ? "Saving..." : "Save Underwriting Settings"}
              </button>
              <button
                type="button"
                onClick={() => void handleResetUnderwritingSettings()}
                disabled={isUnderwritingSaving || isUnderwritingLoading}
                className="px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors font-medium disabled:opacity-60"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

type SettingProps = {
  label: string;
  defaultChecked?: boolean;
};

function Setting({ label, defaultChecked = false }: SettingProps) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <span className="text-sm">{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4" />
    </label>
  );
}
