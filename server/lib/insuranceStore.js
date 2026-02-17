import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuid } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFile = path.join(__dirname, "..", "data", "insurance.json");

async function ensureSeed() {
  try {
    await fs.access(dataFile);
  } catch {
    const seed = {
      loans: [
        {
          id: "12043",
          borrower: { name: "Michael Chen", email: "michael.chen@email.com", phone: "(512) 555-0123" },
          property: {
            address: "789 Maple Drive",
            city: "Austin",
            state: "TX",
            zip: "78704",
            type: "Single Family",
          },
          loan: {
            amount: 875000,
            originationDate: new Date().toISOString(),
            maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            interestRate: 8.5,
            loanToValue: 65,
          },
          insurance: {
            status: "valid",
            policyNumber: "POL-889123",
            carrier: "Acme Insurance",
            coverageAmount: 1200000,
            expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            mortgageeVerified: true,
            addressMatch: true,
            coverageAdequate: true,
          },
          assignedStaff: "Sarah Johnson",
          policies: [],
          tasks: [],
          events: [],
        },
      ],
      uploadTokens: [],
    };
    await writeData(seed);
  }
}

export async function readData() {
  await ensureSeed();
  const raw = await fs.readFile(dataFile, "utf-8");
  return JSON.parse(raw);
}

export async function writeData(data) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

export function computeInsuranceStatus(expirationDate) {
  if (!expirationDate) return "default";
  const diffMs = new Date(expirationDate).getTime() - Date.now();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "default";
  if (days <= 45) return "expiring";
  return "valid";
}

export async function listLoans() {
  const data = await readData();
  data.loans = data.loans.map((loan) => ({
    ...loan,
    insurance: {
      ...loan.insurance,
      status: computeInsuranceStatus(loan.insurance?.expirationDate),
    },
  }));
  await writeData(data);
  return data.loans;
}

export async function getLoan(id) {
  const loans = await listLoans();
  return loans.find((loan) => loan.id === id) || null;
}

export async function createLoan(payload) {
  const data = await readData();
  const id = payload.id || uuid().slice(0, 8);
  const newLoan = {
    id,
    borrower: payload.borrower,
    property: payload.property,
    loan: payload.loan,
    insurance: payload.insurance || {
      status: "default",
      policyNumber: "",
      carrier: "",
      coverageAmount: 0,
      expirationDate: null,
      mortgageeVerified: false,
      addressMatch: false,
      coverageAdequate: false,
    },
    assignedStaff: payload.assignedStaff || "Unassigned",
    policies: [],
    tasks: [],
    events: [],
  };
  data.loans.push(newLoan);
  await writeData(data);
  return newLoan;
}

export async function updateLoan(id, partial) {
  const data = await readData();
  const idx = data.loans.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  data.loans[idx] = { ...data.loans[idx], ...partial };
  await writeData(data);
  return data.loans[idx];
}

export async function listBorrowers() {
  const loans = await listLoans();
  const map = new Map();
  loans.forEach((loan) => {
    const email = loan.borrower?.email || loan.borrower?.name || loan.id;
    map.set(email, { id: email, ...loan.borrower, loans: loans.filter((l) => l.borrower?.email === email) });
  });
  return Array.from(map.values());
}

export async function getBorrower(id) {
  const borrowers = await listBorrowers();
  return borrowers.find((b) => b.id === id) || null;
}

export async function createUploadToken(loanId) {
  const data = await readData();
  const token = uuid();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  data.uploadTokens.push({ token, loanId, expiresAt });
  await writeData(data);
  return { token, loanId, expiresAt };
}

export async function validateToken(token) {
  const data = await readData();
  const entry = data.uploadTokens.find((t) => t.token === token);
  if (!entry) return null;
  if (new Date(entry.expiresAt).getTime() < Date.now()) return null;
  return entry;
}

export async function acceptUpload(token, fileInfo) {
  const data = await readData();
  const entry = data.uploadTokens.find((t) => t.token === token);
  if (!entry) return null;
  const idx = data.loans.findIndex((l) => l.id === entry.loanId);
  if (idx === -1) return null;
  const loan = data.loans[idx];
  const policyEntry = {
    id: uuid(),
    documentUrl: fileInfo.documentUrl,
    originalName: fileInfo.originalName,
    size: fileInfo.size,
    mime: fileInfo.mime,
    uploadedAt: new Date().toISOString(),
  };
  loan.policies = loan.policies || [];
  loan.policies.push(policyEntry);
  loan.events = loan.events || [];
  loan.events.push({
    id: uuid(),
    type: "UPLOAD_RECEIVED",
    message: `Insurance document uploaded: ${fileInfo.originalName}`,
    createdAt: new Date().toISOString(),
  });
  data.loans[idx] = loan;
  await writeData(data);
  return loan;
}
