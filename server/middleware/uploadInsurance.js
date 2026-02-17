import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { insuranceUploadsDir } from "../lib/paths.js";

await fs.mkdir(insuranceUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: insuranceUploadsDir,
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    cb(null, `${timestamp}_${safe}`);
  },
});

const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

export const uploadInsurance = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) {
      return cb(new Error("Only PDF, PNG, or JPG files are allowed"));
    }
    cb(null, true);
  },
});
