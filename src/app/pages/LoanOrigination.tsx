import { UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { StepIndicator } from "../components/StepIndicator";

const steps = ["Borrower Information", "Property Details", "Loan Details", "Documents"];

export function LoanOrigination() {
  const [currentStep, setCurrentStep] = useState(1);

  const progressLabel = useMemo(() => `Step ${currentStep} of ${steps.length}`, [currentStep]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-primary">Loan Origination</h1>
        <p className="text-muted-foreground mt-1">Create and submit a new loan application in four guided steps.</p>
      </header>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">New Application</h2>
          <span className="text-sm text-muted-foreground">{progressLabel}</span>
        </div>

        <StepIndicator steps={steps} currentStep={currentStep} />

        <div className="space-y-6">
          {currentStep === 1 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="First Name" placeholder="Michael" />
              <Input label="Last Name" placeholder="Chen" />
              <Input label="Email" type="email" placeholder="mchen@email.com" />
              <Input label="Phone" placeholder="(512) 555-0142" />
              <Input label="Date of Birth" type="date" />
              <Input label="SSN" placeholder="***-**-6789" />
            </div>
          )}

          {currentStep === 2 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Input className="md:col-span-2" label="Property Address" placeholder="123 Main Street, Austin, TX 78701" />
              <Select
                label="Property Type"
                options={["Single Family", "Condo", "Townhouse", "Multi-Family"]}
              />
              <Input label="Property Value" placeholder="$475,000" />
              <Select label="Intended Use" options={["Primary", "Investment", "Second Home"]} />
            </div>
          )}

          {currentStep === 3 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Loan Type"
                options={[
                  "Fix & Flip Loan (Rehab Loan)",
                  "Bridge Loan",
                  "Ground-Up Construction Loan",
                  "Transactional Funding (Double Close / Wholesale)",
                  "Land Loan",
                ]}
              />
              <Input label="Loan Amount" placeholder="$450,000" />
              <Input label="Down Payment" placeholder="$45,000" />
              <Select label="Loan Term" options={["15 years", "20 years", "30 years"]} />
              <Input label="Interest Rate" placeholder="6.25%" />
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="rounded-lg border-2 border-dashed border-border p-8 text-center bg-muted/40">
                <UploadCloud className="mx-auto text-primary" size={28} />
                <p className="mt-2 font-medium">Drag and drop documents here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse files</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Required Documents</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {[
                    "Government-issued Photo ID",
                    "Two most recent pay stubs",
                    "W-2 forms (last 2 years)",
                    "Two months bank statements",
                    "Purchase contract",
                    "Homeowners insurance quote",
                  ].map((item) => (
                    <label key={item} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="rounded border-border" />
                      {item}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            type="button"
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition disabled:opacity-40"
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
          >
            Previous
          </button>
          {currentStep < steps.length ? (
            <button
              type="button"
              className="rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary/90 transition"
              onClick={() => setCurrentStep((prev) => Math.min(steps.length, prev + 1))}
            >
              Next
            </button>
          ) : (
            <button type="button" className="rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary/90 transition">
              Submit Application
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

type InputProps = {
  label: string;
  placeholder?: string;
  type?: string;
  className?: string;
};

function Input({ label, placeholder, type = "text", className = "" }: InputProps) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium mb-2 block">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-white px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
      />
    </label>
  );
}

type SelectProps = {
  label: string;
  options: string[];
};

function Select({ label, options }: SelectProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-2 block">{label}</span>
      <select className="w-full rounded-lg border border-border bg-white px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
