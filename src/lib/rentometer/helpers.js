export function parseNumber(input) {
  if (input === null || input === undefined) return null;
  const num = Number(input);
  return Number.isFinite(num) ? num : null;
}

export function convertBathsForRentometer(bathsInput) {
  const num = parseNumber(
    typeof bathsInput === "string" ? bathsInput.replace(/[^0-9.]/g, "") : bathsInput
  );
  if (num === null) return null;
  if (num >= 1.5) return "1.5+";
  return "1";
}

export function convertBedroomsForRentometer(bedroomsInput) {
  const num = parseNumber(
    typeof bedroomsInput === "string" ? bedroomsInput.replace(/[^0-9.]/g, "") : bedroomsInput
  );
  if (num === null) throw new Error("bedrooms is required");
  const rounded = Math.round(num);
  if (rounded < 0) return 0;
  if (rounded > 6) return 6;
  return rounded;
}

export function normalizeAddress(address) {
  if (typeof address !== "string") throw new Error("address is required");
  const trimmed = address.trim();
  if (!trimmed) throw new Error("address is required");
  return trimmed;
}

export function clampLookBackDays(value) {
  const num = parseNumber(value);
  if (!num) return 365;
  if (num < 90) return 90;
  if (num > 1460) return 1460;
  return Math.round(num);
}
