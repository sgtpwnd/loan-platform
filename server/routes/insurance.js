import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuid } from "uuid";
import {
  listLoans,
  getLoan,
  createLoan,
  updateLoan,
  listBorrowers,
  getBorrower,
  createUploadToken,
  validateToken,
  acceptUpload,
  computeInsuranceStatus,
} from "../lib/insuranceStore.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "..", "uploads", "insurance");

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuid()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg"];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.get("/loans", async (_req, res) => {
  const loans = await listLoans();
  res.json({ loans });
});

router.get("/loans/:id", async (req, res) => {
  const loan = await getLoan(req.params.id);
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  loan.insurance.status = computeInsuranceStatus(loan.insurance?.expirationDate);
  res.json({ loan });
});

router.post("/loans", async (req, res) => {
  try {
    const loan = await createLoan(req.body || {});
    res.status(201).json({ loan });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to create loan" });
  }
});

router.patch("/loans/:id", async (req, res) => {
  const loan = await updateLoan(req.params.id, req.body || {});
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  res.json({ loan });
});

router.get("/borrowers", async (_req, res) => {
  const borrowers = await listBorrowers();
  res.json({ borrowers });
});

router.get("/borrowers/:id", async (req, res) => {
  const borrower = await getBorrower(req.params.id);
  if (!borrower) return res.status(404).json({ error: "Borrower not found" });
  res.json({ borrower });
});

router.post("/tokens", async (req, res) => {
  const { loanId } = req.body || {};
  if (!loanId) return res.status(400).json({ error: "loanId is required" });
  const token = await createUploadToken(loanId);
  res.json({
    ...token,
    uploadUrl: `/portal/${loanId}`,
    uploadApiUrl: `/api/insurance/upload/${token.token}`,
  });
});

router.post("/upload/:token", upload.single("file"), async (req, res) => {
  const token = req.params.token;
  const valid = await validateToken(token);
  if (!valid) return res.status(400).json({ error: "Invalid or expired token" });
  if (!req.file) return res.status(400).json({ error: "File is required" });

  const documentUrl = `/uploads/insurance/${req.file.filename}`;
  const result = await acceptUpload(token, {
    documentUrl,
    originalName: req.file.originalname,
    size: req.file.size,
    mime: req.file.mimetype,
  });
  if (!result) return res.status(400).json({ error: "Unable to attach upload" });
  res.json({ ok: true, documentUrl, loanId: valid.loanId });
});

export default router;
