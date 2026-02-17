interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center w-full mb-8 overflow-x-auto pb-2">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center flex-1 min-w-[170px]">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 text-sm font-semibold ${
                index + 1 <= currentStep
                  ? "bg-primary border-primary text-white"
                  : "bg-white border-border text-muted-foreground"
              }`}
            >
              {index + 1}
            </div>
            <div className={`text-sm mt-2 text-center ${index + 1 <= currentStep ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {step}
            </div>
          </div>
          {index < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-4 ${index + 1 < currentStep ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
