export function computeDaysLeft(expirationISO) {
  if (!expirationISO) return null;
  const expires = new Date(expirationISO).getTime();
  if (Number.isNaN(expires)) return null;
  const diffMs = expires - Date.now();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function computeInsuranceStatus(expirationISO, { loanStatus = "ACTIVE", forcePlaced = false } = {}) {
  if (loanStatus && loanStatus !== "ACTIVE") return "inactive";
  if (forcePlaced) return "force-placed";
  const daysLeft = computeDaysLeft(expirationISO);
  if (daysLeft === null) return "expiring";
  if (daysLeft > 45) return "valid";
  if (daysLeft >= 1) return "expiring";
  return "default";
}
