import fs from "node:fs/promises";
import { v4 as uuidv4 } from "uuid";
import { insuranceDataFile, dataDir } from "../lib/paths.js";
import { computeInsuranceStatus } from "../lib/insurance.status.js";
import { buildTokenRecord } from "../lib/insurance.tokens.js";

let lock = Promise.resolve();

async function withLock(fn) {
  const release = lock;
  let resolveNext;
  lock = new Promise((res) => {
    resolveNext = res;
  });
  await release.catch(() => {});
  try {
    return await fn();
  } finally {
    resolveNext();
  }
}

async function ensureSeed() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(insuranceDataFile);
    return;
  } catch {
    const now = Date.now();
    const mkLoan = (id, borrowerName, status = "ACTIVE", days = 90, insuranceStatus = "valid") => {
      const expiration = new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
      return {
        id,
        loanNumber: `LN-${id}`,
        status,
        borrower: { id: `brw_${id}`, name: borrowerName, email: `${borrowerName.split(" ")[0].toLowerCase()}@email.com`, phone: "(555) 000-0000" },
        property: { address: `${id} Main St`, city: "Austin", state: "TX", zip: "78701", type: "Single Family" },
        loan: {
          amount: 750000,
          originationDate: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
          maturityDate: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),
          interestRate: 8.25,
          loanToValue: 65,
        },
        insurance: {
          status: insuranceStatus,
          policyNumber: `POL-${id}`,
          carrier: "Acme Insurance",
          coverageAmount: 1000000,
          expirationDate: expiration,
          mortgageeVerified: true,
          addressMatch: true,
          coverageAdequate: true,
          documentUrl: "",
        },
        policies: [],
        tasks: [],
        events: [],
        assignedStaff: "Sarah Johnson",
        createdAt: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
      };
    };

    const seed = {
      loans: [
        mkLoan("12043", "Michael Chen", "ACTIVE", 90, "valid"),
        mkLoan("12044", "Alicia Patel", "ACTIVE", 20, "expiring"),
        mkLoan("12045", "Jordan Diaz", "ACTIVE", -3, "default"),
      ],
      uploadTokens: [],
    };
    await fs.writeFile(insuranceDataFile, JSON.stringify(seed, null, 2));
  }
}

export async function readData() {
  await ensureSeed();
  try {
    const raw = await fs.readFile(insuranceDataFile, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    // if corrupted, rewrite seed and retry once
    await fs.writeFile(insuranceDataFile, JSON.stringify({ loans: [], uploadTokens: [] }, null, 2));
    const raw = await fs.readFile(insuranceDataFile, "utf-8");
    return JSON.parse(raw);
  }
}

export async function writeData(data) {
  await fs.writeFile(insuranceDataFile, JSON.stringify(data, null, 2));
}

function applyStatus(loan) {
  const status = computeInsuranceStatus(loan.insurance?.expirationDate, {
    loanStatus: loan.status,
    forcePlaced: loan.insurance?.forcePlaced,
  });
  return { ...loan, insurance: { ...loan.insurance, status } };
}

export async function listLoans({ q, status } = {}) {
  const data = await readData();
  data.loans = data.loans.map(applyStatus);
  const filtered = data.loans.filter((loan) => {
    const matchesStatus = status ? loan.insurance?.status === status : true;
    const matchesQ =
      !q ||
      [loan.borrower?.name, loan.borrower?.email, loan.property?.address, loan.loanNumber]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q.toLowerCase()));
    return matchesStatus && matchesQ;
  });
  await writeData(data);
  return filtered;
}

export async function getLoan(id) {
  const loans = await listLoans();
  return loans.find((l) => l.id === id || l.loanNumber === id) || null;
}

export async function createLoan(payload) {
  return withLock(async () => {
    const data = await readData();
    const id = payload.id || uuidv4().slice(0, 8);
    const loanNumber = payload.loanNumber || `LN-${id}`;
    const nowISO = new Date().toISOString();
    const loan = applyStatus({
      id,
      loanNumber,
      status: payload.status || "ACTIVE",
      borrower: payload.borrower || {},
      property: payload.property || {},
      loan: payload.loan || {},
      insurance: payload.insurance || {},
      policies: payload.policies || [],
      tasks: payload.tasks || [],
      events: payload.events || [],
      assignedStaff: payload.assignedStaff || "Unassigned",
      createdAt: nowISO,
      updatedAt: nowISO,
    });
    data.loans.push(loan);
    await writeData(data);
    return loan;
  });
}

export async function updateLoan(id, patch) {
  return withLock(async () => {
    const data = await readData();
    const idx = data.loans.findIndex((l) => l.id === id || l.loanNumber === id);
    if (idx === -1) return null;
    const updated = applyStatus({
      ...data.loans[idx],
      ...patch,
      insurance: { ...data.loans[idx].insurance, ...(patch.insurance || {}) },
      updatedAt: new Date().toISOString(),
    });
    data.loans[idx] = updated;
    await writeData(data);
    return updated;
  });
}

export async function listBorrowers() {
  const loans = await listLoans();
  const map = new Map();
  loans.forEach((loan) => {
    const borrowerId = loan.borrower?.id || loan.borrower?.email || loan.borrower?.name || loan.id;
    const existing = map.get(borrowerId) || { ...loan.borrower, id: borrowerId, loans: [] };
    existing.loans.push(loan);
    map.set(borrowerId, existing);
  });
  return Array.from(map.values()).map((b) => {
    const compliant = b.loans.filter((l) => l.insurance?.status === "valid").length;
    const expiring = b.loans.filter((l) => l.insurance?.status === "expiring").length;
    const defaulted = b.loans.filter((l) => l.insurance?.status === "default").length;
    const forcePlaced = b.loans.filter((l) => l.insurance?.status === "force-placed").length;
    return {
      ...b,
      totalLoans: b.loans.length,
      compliant,
      expiring,
      default: defaulted,
      forcePlaced,
    };
  });
}

export async function getBorrower(id) {
  const borrowers = await listBorrowers();
  const borrower = borrowers.find((b) => b.id === id);
  if (!borrower) return null;
  const loans = borrower.loans;
  return { borrower, loans };
}

export async function createToken(loanId, daysValid = 7) {
  return withLock(async () => {
    const data = await readData();
    const record = buildTokenRecord(loanId, daysValid);
    data.uploadTokens.push(record);
    await writeData(data);
    return record;
  });
}

export async function validateToken(token) {
  const data = await readData();
  const entry = data.uploadTokens.find((t) => t.token === token);
  if (!entry) return null;
  if (new Date(entry.expiresAt).getTime() < Date.now()) return null;
  return entry;
}

export async function addPolicyUpload(loanId, { documentUrl, originalName, size, mime, expirationDate }) {
  return withLock(async () => {
    const data = await readData();
    const idx = data.loans.findIndex((l) => l.id === loanId || l.loanNumber === loanId);
    if (idx === -1) return null;
    const policy = {
      id: uuidv4(),
      policyNumber: "",
      carrier: "",
      coverageAmount: data.loans[idx].insurance?.coverageAmount || 0,
      effectiveDate: new Date().toISOString(),
      expirationDate: expirationDate || data.loans[idx].insurance?.expirationDate || null,
      documentUrl,
      uploadedAt: new Date().toISOString(),
      status: "PENDING_REVIEW",
      originalName,
      size,
      mime,
    };
    const loan = { ...data.loans[idx] };
    loan.policies = [...(loan.policies || []), policy];
    loan.insurance = {
      ...loan.insurance,
      documentUrl,
      expirationDate: policy.expirationDate,
    };
    loan.events = [
      ...(loan.events || []),
      {
        id: uuidv4(),
        type: "UPLOAD_RECEIVED",
        channel: "SYSTEM",
        details: { originalName },
        createdAt: new Date().toISOString(),
      },
    ];
    loan.tasks = [
      ...(loan.tasks || []),
      {
        id: uuidv4(),
        type: "REVIEW_POLICY",
        priority: "HIGH",
        status: "OPEN",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];
    data.loans[idx] = applyStatus(loan);
    await writeData(data);
    return data.loans[idx];
  });
}

export async function addEvent(loanId, event) {
  return withLock(async () => {
    const data = await readData();
    const idx = data.loans.findIndex((l) => l.id === loanId || l.loanNumber === loanId);
    if (idx === -1) return null;
    const loan = { ...data.loans[idx] };
    loan.events = [...(loan.events || []), { id: uuidv4(), createdAt: new Date().toISOString(), ...event }];
    data.loans[idx] = loan;
    await writeData(data);
    return data.loans[idx];
  });
}

export async function forcePlacePolicy(loanId, { carrier, policyNumber, coverageAmount, expirationDate, reason }) {
  return withLock(async () => {
    const data = await readData();
    const idx = data.loans.findIndex((l) => l.id === loanId || l.loanNumber === loanId);
    if (idx === -1) return null;

    const forcePolicy = {
      id: uuidv4(),
      policyNumber: policyNumber || `FP-${uuidv4().slice(0, 6)}`,
      carrier: carrier || "Force-Placed Carrier",
      coverageAmount: Number(coverageAmount) || data.loans[idx].insurance?.coverageAmount || 0,
      effectiveDate: new Date().toISOString(),
      expirationDate: expirationDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      documentUrl: "",
      uploadedAt: new Date().toISOString(),
      status: "FORCE_PLACED",
    };

    const loan = { ...data.loans[idx] };
    loan.policies = [...(loan.policies || []), forcePolicy];
    loan.insurance = {
      ...loan.insurance,
      carrier: forcePolicy.carrier,
      policyNumber: forcePolicy.policyNumber,
      coverageAmount: forcePolicy.coverageAmount,
      expirationDate: forcePolicy.expirationDate,
      forcePlaced: true,
    };
    loan.events = [
      ...(loan.events || []),
      {
        id: uuidv4(),
        type: "FORCE_PLACED",
        channel: "SYSTEM",
        details: { reason },
        createdAt: new Date().toISOString(),
      },
    ];
    loan.tasks = [
      ...(loan.tasks || []),
      {
        id: uuidv4(),
        type: "CONTACT_BORROWER",
        priority: "URGENT",
        status: "OPEN",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];

    data.loans[idx] = applyStatus(loan);
    await writeData(data);
    return data.loans[idx];
  });
}

export async function acknowledgeInsurance(loanId, { note }) {
  return withLock(async () => {
    const data = await readData();
    const idx = data.loans.findIndex((l) => l.id === loanId || l.loanNumber === loanId);
    if (idx === -1) return null;
    const loan = { ...data.loans[idx] };
    loan.insurance = { ...loan.insurance, forcePlaced: false };
    loan.events = [
      ...(loan.events || []),
      {
        id: uuidv4(),
        type: "REPLACED",
        channel: "SYSTEM",
        details: { note },
        createdAt: new Date().toISOString(),
      },
    ];
    data.loans[idx] = applyStatus(loan);
    await writeData(data);
    return data.loans[idx];
  });
}
