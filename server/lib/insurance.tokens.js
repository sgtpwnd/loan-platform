import crypto from "node:crypto";

export function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function buildTokenRecord(loanId, daysValid = 7) {
  const token = generateToken();
  const now = Date.now();
  const expiresAt = new Date(now + daysValid * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = new Date(now).toISOString();
  return { token, loanId, expiresAt, createdAt };
}
