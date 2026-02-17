const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function sanitizeCurrencyInput(value: string) {
  const digitsAndDots = value.replace(/[^\d.]/g, "");
  if (!digitsAndDots) return "";

  const firstDot = digitsAndDots.indexOf(".");
  if (firstDot === -1) return digitsAndDots;

  const whole = digitsAndDots.slice(0, firstDot);
  const normalizedWhole = whole.length > 0 ? whole : "0";
  const fraction = digitsAndDots
    .slice(firstDot + 1)
    .replace(/\./g, "")
    .slice(0, 2);

  return fraction.length > 0 ? `${normalizedWhole}.${fraction}` : `${normalizedWhole}.`;
}

export function stripCurrencyFormatting(value: string) {
  return sanitizeCurrencyInput(value);
}

export function parseCurrencyValue(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = sanitizeCurrencyInput(value);
  if (!normalized || normalized === ".") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatUsdValue(value: string | number | null | undefined) {
  const parsed = parseCurrencyValue(value);
  if (parsed === null) return "";
  return usdFormatter.format(parsed);
}
