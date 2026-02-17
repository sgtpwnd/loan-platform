import {
  listLoans,
  getLoan,
  createLoan,
  updateLoan,
  listBorrowers,
  getBorrower,
  createToken,
  validateToken,
  addPolicyUpload,
  addEvent,
  forcePlacePolicy,
  acknowledgeInsurance,
} from "../stores/insurance.store.json.js";
import { computeInsuranceStatus } from "../lib/insurance.status.js";

export async function fetchLoans(filters = {}) {
  return listLoans(filters);
}

export async function fetchLoan(id) {
  return getLoan(id);
}

export async function createLoanRecord(payload) {
  return createLoan(payload);
}

export async function updateLoanRecord(id, patch) {
  const updated = await updateLoan(id, patch);
  return updated;
}

export async function fetchBorrowers() {
  return listBorrowers();
}

export async function fetchBorrower(id) {
  return getBorrower(id);
}

export async function createUploadToken(loanId) {
  return createToken(loanId);
}

export async function validateUploadToken(token) {
  return validateToken(token);
}

export async function handlePolicyUpload(loanId, fileInfo) {
  return addPolicyUpload(loanId, fileInfo);
}

export async function recordReminder(loanId) {
  return addEvent(loanId, { type: "REMINDER_SENT", channel: "SYSTEM", details: {} });
}

export async function forcePlace(loanId, payload) {
  return forcePlacePolicy(loanId, payload);
}

export async function acknowledgePolicy(loanId, payload) {
  return acknowledgeInsurance(loanId, payload);
}

export function deriveStatus(loan) {
  return computeInsuranceStatus(loan?.insurance?.expirationDate, {
    loanStatus: loan?.status,
    forcePlaced: loan?.insurance?.forcePlaced,
  });
}
