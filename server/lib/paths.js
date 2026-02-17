import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.join(__dirname, "..");
export const dataDir = path.join(rootDir, "data");
export const uploadsDir = path.join(rootDir, "uploads");
export const insuranceUploadsDir = path.join(uploadsDir, "insurance");

export const insuranceDataFile = path.join(dataDir, "insurance.json");

export function resolveDataFile(name) {
  return path.join(dataDir, name);
}

export function resolveUploadPath(...parts) {
  return path.join(uploadsDir, ...parts);
}
