const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const STORAGE_ROOT = path.join(__dirname, "..", "storage", "esign");
const TEMPLATE_DIR = path.join(STORAGE_ROOT, "templates");
const ENVELOPE_DIR = path.join(STORAGE_ROOT, "envelopes");

const ensureStorage = async () => {
  await fs.mkdir(TEMPLATE_DIR, { recursive: true });
  await fs.mkdir(ENVELOPE_DIR, { recursive: true });
};

const stripDataUrl = (base64) => {
  if (!base64) return "";
  const match = String(base64).match(/^data:.*;base64,(.*)$/);
  return match ? match[1] : String(base64);
};

const saveTemplatePdf = async ({ templateId, pdfBase64 }) => {
  await ensureStorage();
  const filename = `${templateId}.pdf`;
  const targetPath = path.join(TEMPLATE_DIR, filename);
  const buffer = Buffer.from(stripDataUrl(pdfBase64), "base64");
  await fs.writeFile(targetPath, buffer);
  return {
    path: targetPath,
    url: `/esign-files/templates/${filename}`,
  };
};

const saveEnvelopePdf = async ({ envelopeId, pdfBuffer }) => {
  await ensureStorage();
  const filename = `${envelopeId}.pdf`;
  const targetPath = path.join(ENVELOPE_DIR, filename);
  await fs.writeFile(targetPath, pdfBuffer);
  return {
    path: targetPath,
    url: `/esign-files/envelopes/${filename}`,
  };
};

const loadTemplatePdf = async (fileUrl) => {
  if (!fileUrl) return null;
  const filename = path.basename(fileUrl);
  const targetPath = path.join(TEMPLATE_DIR, filename);
  return fs.readFile(targetPath);
};

const generateAccessToken = () => crypto.randomUUID();

module.exports = {
  STORAGE_ROOT,
  TEMPLATE_DIR,
  ENVELOPE_DIR,
  ensureStorage,
  saveTemplatePdf,
  saveEnvelopePdf,
  loadTemplatePdf,
  generateAccessToken,
  stripDataUrl,
};
