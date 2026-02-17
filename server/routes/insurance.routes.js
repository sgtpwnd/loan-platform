import express from "express";
import { uploadInsurance } from "../middleware/uploadInsurance.js";
import {
  fetchLoans,
  fetchLoan,
  createLoanRecord,
  updateLoanRecord,
  fetchBorrowers,
  fetchBorrower,
  createUploadToken,
  validateUploadToken,
  handlePolicyUpload,
  recordReminder,
  forcePlace,
  acknowledgePolicy,
} from "../services/insurance.service.js";

const router = express.Router();

router.get("/loans", async (req, res) => {
  const { q, status } = req.query;
  const loans = await fetchLoans({ q, status });
  res.json({ loans });
});

router.get("/loans/:id", async (req, res) => {
  const loan = await fetchLoan(req.params.id);
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  res.json({ loan });
});

router.post("/loans", async (req, res) => {
  try {
    const loan = await createLoanRecord(req.body || {});
    res.status(201).json({ loan });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to create loan" });
  }
});

router.patch("/loans/:id", async (req, res) => {
  const loan = await updateLoanRecord(req.params.id, req.body || {});
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  res.json({ loan });
});

router.get("/borrowers", async (_req, res) => {
  const borrowers = await fetchBorrowers();
  res.json({ borrowers });
});

router.get("/borrowers/:id", async (req, res) => {
  const data = await fetchBorrower(req.params.id);
  if (!data) return res.status(404).json({ error: "Borrower not found" });
  res.json(data);
});

router.post("/tokens", async (req, res) => {
  const { loanId } = req.body || {};
  if (!loanId) return res.status(400).json({ error: "loanId is required" });
  const token = await createUploadToken(loanId);
  res.json({
    ...token,
    uploadApiUrl: `/api/insurance/upload/${token.token}`,
    portalUrl: `/portal/${loanId}`,
  });
});

router.post("/upload/:token", uploadInsurance.single("file"), async (req, res) => {
  const token = req.params.token;
  const valid = await validateUploadToken(token);
  if (!valid) return res.status(400).json({ error: "Invalid or expired token" });
  if (!req.file) return res.status(400).json({ error: "File is required" });

  const documentUrl = `/uploads/insurance/${req.file.filename}`;
  const updated = await handlePolicyUpload(valid.loanId, {
    documentUrl,
    originalName: req.file.originalname,
    size: req.file.size,
    mime: req.file.mimetype,
    expirationDate: req.body?.expirationDate,
  });
  if (!updated) return res.status(400).json({ error: "Unable to attach upload" });
  res.json({ ok: true, documentUrl, loanId: valid.loanId });
});

router.post("/loans/:id/send-reminder", async (req, res) => {
  const loanId = req.params.id;
  const loan = await fetchLoan(loanId);
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  await recordReminder(loanId);
  res.json({ ok: true });
});

router.post("/loans/:id/force-place", async (req, res) => {
  const loanId = req.params.id;
  const loan = await fetchLoan(loanId);
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  const payload = {
    carrier: req.body?.carrier,
    policyNumber: req.body?.policyNumber,
    coverageAmount: req.body?.coverageAmount,
    expirationDate: req.body?.expirationDate,
    reason: req.body?.reason,
  };
  const updated = await forcePlace(loanId, payload);
  if (!updated) return res.status(400).json({ error: "Unable to force-place policy" });
  res.json({ loan: updated });
});

router.post("/loans/:id/acknowledge", async (req, res) => {
  const loanId = req.params.id;
  const loan = await fetchLoan(loanId);
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  const updated = await acknowledgePolicy(loanId, { note: req.body?.note });
  if (!updated) return res.status(400).json({ error: "Unable to acknowledge insurance" });
  res.json({ loan: updated });
});

export default router;
