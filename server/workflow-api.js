import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getSubjectPropertyAVM,
  normalizeAddressKey,
  getMarketProfiles,
  getDetailOwner,
  getSaleSnapshot,
  pickSalePrice,
  pickSaleDate,
} from "../src/lib/attom/client.js";
import {
  convertBathsForRentometer,
  convertBedroomsForRentometer,
  normalizeAddress as normalizeRentometerAddress,
  clampLookBackDays,
} from "../src/lib/rentometer/helpers.js";
import { mapRentometerSummary } from "../src/lib/rentometer/client.js";
import insuranceRouter from "./routes/insurance.routes.js";

const app = express();
const port = Number(process.env.WORKFLOW_API_PORT || 5050);
const host = process.env.WORKFLOW_API_HOST || "127.0.0.1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const uploadsDir = path.join(__dirname, "uploads");
const insuranceUploadsDir = path.join(uploadsDir, "insurance");
const dataFile = path.join(dataDir, "workflow-applications.json");
const underwritingSettingsFile = path.join(dataDir, "workflow-underwriting-settings.json");
const conditionsDocumentsDir = path.join(dataDir, "conditions-submissions");

// Ensure required directories exist
await fs.mkdir(dataDir, { recursive: true });
await fs.mkdir(uploadsDir, { recursive: true });
await fs.mkdir(insuranceUploadsDir, { recursive: true });

const stages = [
  "Application Submitted",
  "Document Verification",
  "Processing",
  "Underwriting Review",
  "Final Approval",
  "Funding",
];

const sanitizeBaths = (value) => {
  if (value === null || value === undefined) return "";
  const normalizedString = typeof value === "string" ? value.trim() : "";
  if (normalizedString === "1.5+") return "1.5+";
  if (normalizedString === "1") return "1";

  const raw = typeof value === "number" && Number.isFinite(value) ? value : Number(String(value).replace(/[^0-9.]/g, ""));
  if (raw > 1) return "1.5+";
  if (raw === 1) return "1";
  return "";
};

const sanitizeBuildingType = (value) => {
  if (typeof value !== "string") return "";
  const lower = value.trim().toLowerCase();
  if (["house", "single family", "single_family"].includes(lower)) return "house";
  if (["apartment", "multi", "multifamily", "multi-family"].includes(lower)) return "apartment";
  return "";
};

const eventStageMap = {
  DOCUMENTS_VERIFIED: 2,
  PROCESSING_COMPLETED: 3,
  UNDERWRITING_APPROVED: 4,
  FUNDING_COMPLETED: 5,
};

const validPreApprovalDecisions = new Set(["PRE_APPROVE", "DECLINE", "REQUEST_INFO"]);
const borrowerPortalBaseUrlRaw = (process.env.BORROWER_PORTAL_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const defaultBorrowerPortalOrigin = "http://localhost:5173";
const lenderPortalBaseUrlRaw = (process.env.LENDER_PORTAL_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const defaultLenderPortalOrigin = "http://localhost:5173";
const lenderEmailActionBaseUrlRaw = (
  process.env.LENDER_EMAIL_ACTION_BASE_URL ||
  process.env.WORKFLOW_API_BASE_URL ||
  `http://localhost:${port}`
).replace(/\/$/, "");
const defaultWorkflowApiOrigin = `http://localhost:${port}`;
const lenderEmailActionSecret = process.env.LENDER_EMAIL_ACTION_SECRET || "workflow-lender-email-action-secret";
const lenderEmailActionTokenTtlMs = Number.isFinite(Number(process.env.LENDER_EMAIL_ACTION_TTL_MS))
  ? Math.max(Number(process.env.LENDER_EMAIL_ACTION_TTL_MS), 5 * 60 * 1000)
  : 3 * 24 * 60 * 60 * 1000;
const workflowApiBodyLimit =
  typeof process.env.WORKFLOW_API_BODY_LIMIT === "string" && process.env.WORKFLOW_API_BODY_LIMIT.trim()
    ? process.env.WORKFLOW_API_BODY_LIMIT.trim()
    : "25mb";
const attomApiKey = process.env.ATTOM_API_KEY || "";
const attomSubjectCache = new Map();
const ATTOM_SUBJECT_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const rentometerApiKey = process.env.RENTOMETER_API_KEY || "";
const rentometerCache = new Map();
const RENTOMETER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const rentometerRateLimit = new Map(); // ip -> { windowStart, count }
const RENTOMETER_RATE_LIMIT_MAX = 10;
const RENTOMETER_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const getClientIp = (req) => {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    "unknown"
  );
};

const isRateLimited = (ip, limitMap, max, windowMs) => {
  const now = Date.now();
  const entry = limitMap.get(ip) || { windowStart: now, count: 0 };
  if (now - entry.windowStart > windowMs) {
    entry.windowStart = now;
    entry.count = 0;
  }
  entry.count += 1;
  limitMap.set(ip, entry);
  return entry.count > max;
};

function parseAddressParts(addressLine) {
  if (!addressLine || typeof addressLine !== "string") return null;
  const parts = addressLine.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const normalizeStreet = (value) => {
    if (!value) return "";
    return value
      .replace(/\s+Ste\.?\s+\w+/i, "")
      .replace(/\s+Unit\s+\w+/i, "")
      .replace(/\bParkway\b/gi, "Pkwy")
      .replace(/\bBoulevard\b/gi, "Blvd")
      .replace(/\bAvenue\b/gi, "Ave")
      .replace(/\bStreet\b/gi, "St")
      .replace(/\bRoad\b/gi, "Rd")
      .replace(/\bDrive\b/gi, "Dr")
      .replace(/\bLane\b/gi, "Ln")
      .replace(/\bCourt\b/gi, "Ct")
      .replace(/\bEast\b/gi, "E")
      .replace(/\bWest\b/gi, "W")
      .replace(/\bNorth\b/gi, "N")
      .replace(/\bSouth\b/gi, "S")
      .trim();
  };

  const line1 = normalizeStreet(parts[0] || "");
  let city = parts[1] || "";
  let state = "";
  let postalcode = "";
  const stateMap = {
    ALABAMA: "AL",
    ALASKA: "AK",
    ARIZONA: "AZ",
    ARKANSAS: "AR",
    CALIFORNIA: "CA",
    COLORADO: "CO",
    CONNECTICUT: "CT",
    DELAWARE: "DE",
    FLORIDA: "FL",
    GEORGIA: "GA",
    HAWAII: "HI",
    IDAHO: "ID",
    ILLINOIS: "IL",
    INDIANA: "IN",
    IOWA: "IA",
    KANSAS: "KS",
    KENTUCKY: "KY",
    LOUISIANA: "LA",
    MAINE: "ME",
    MARYLAND: "MD",
    MASSACHUSETTS: "MA",
    MICHIGAN: "MI",
    MINNESOTA: "MN",
    MISSISSIPPI: "MS",
    MISSOURI: "MO",
    MONTANA: "MT",
    NEBRASKA: "NE",
    NEVADA: "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    OHIO: "OH",
    OKLAHOMA: "OK",
    OREGON: "OR",
    PENNSYLVANIA: "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    TENNESSEE: "TN",
    TEXAS: "TX",
    UTAH: "UT",
    VERMONT: "VT",
    VIRGINIA: "VA",
    WASHINGTON: "WA",
    "WEST VIRGINIA": "WV",
    WISCONSIN: "WI",
    WYOMING: "WY",
  };

  if (parts.length >= 3) {
    const stateZip = parts.slice(2).join(", ");
    const match = stateZip.match(/(.+?)\s+(\d{5}(?:-\d{4})?)/);
    if (match) {
      state = match[1].trim();
      postalcode = match[2];
    } else {
      state = stateZip.trim();
    }
  }

  const stateCode = state ? stateMap[state.toUpperCase()] || stateMap[state.replace(/\./g, "").toUpperCase()] : "";

  return { line1, city, state, stateCode, postalcode };
}

async function fetchAttomProperty(addressLine) {
  if (!attomApiKey) {
    throw new Error("ATTOM_API_KEY missing");
  }

  // Order matters: detail is richest, then address, then basicaddress.
  const endpoints = [
    "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail",
    "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/address",
    "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicaddress",
  ];

  const parsed = parseAddressParts(addressLine);
  const address1 = parsed?.line1 || addressLine;
  const city = parsed?.city || "";
  const state = parsed?.stateCode || parsed?.state || "";
  const postalcode = parsed?.postalcode || "";
  const attempts = [];
  let lastError = null;
  let detailAttemptedForId = false;

  const paramVariants = [];
  // Highest confidence: street + zip
  if (address1 && postalcode) paramVariants.push({ address1, postalcode });
  // Street + city/state
  if (address1 && city && state) paramVariants.push({ address1, city, state });
  // Street + city/state + zip
  if (address1 && city && state && postalcode) paramVariants.push({ address1, city, state, postalcode });
  // Street + address2 formatted
  if (address1 && city && state) paramVariants.push({ address1, address2: `${city}, ${state}` });
  if (address1 && city && state && postalcode) paramVariants.push({ address1, address2: `${city}, ${state} ${postalcode}` });
  // Full line + zip
  if (addressLine && postalcode) paramVariants.push({ address: addressLine, postalcode });
  // Full line + city/state
  if (addressLine && city && state) paramVariants.push({ address: addressLine, city, state });
  // Fallback: street only
  if (address1 && paramVariants.length === 0) paramVariants.push({ address1 });

  let bestProperty = null;

  for (const endpoint of endpoints) {
    for (const variant of paramVariants) {
      const url = new URL(endpoint);
      Object.entries(variant).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
      // Many Attom endpoints expect `address`; send it when we have a street line.
      if (variant.address1 && !url.searchParams.get("address")) {
        url.searchParams.set("address", variant.address1);
      }
      const attempt = { endpoint, params: Object.fromEntries(url.searchParams.entries()) };
      try {
        const response = await fetch(url, {
          headers: { apikey: attomApiKey, accept: "application/json" },
        });
        const text = await response.text();
        attempt.status = response.status;
        attempt.body = text.slice(0, 500);
        attempts.push(attempt);

        if (!response.ok) {
          lastError = `Endpoint ${endpoint} failed: ${response.status} ${text}`;
          continue;
        }

        let data = null;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          lastError = `Endpoint ${endpoint} returned invalid JSON`;
          continue;
        }

        const property = data?.property?.[0];
        if (property) {
          const hasDetail =
            property.assessment ||
            property.sale ||
            property.lastSale ||
            (Array.isArray(property.sales) && property.sales.length > 0) ||
            (Array.isArray(property.saleHistory) && property.saleHistory.length > 0) ||
            property.owner;

          // Keep the first property seen as a fallback, but prefer one with detail fields.
          if (!bestProperty) bestProperty = property;
          if (hasDetail) return property;

          // If we only got a skinny record but have an Attom ID, try a detail-by-id fetch once.
          const attomId = property?.identifier?.attomId || property?.identifier?.Id;
          if (attomId && !detailAttemptedForId) {
            detailAttemptedForId = true;
            const detailUrl = new URL("https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail");
            detailUrl.searchParams.set("attomid", String(attomId));
            const detailAttempt = {
              endpoint: detailUrl.toString(),
              params: Object.fromEntries(detailUrl.searchParams.entries()),
            };
            try {
              const detailResp = await fetch(detailUrl, {
                headers: { apikey: attomApiKey, accept: "application/json" },
              });
              const detailText = await detailResp.text();
              detailAttempt.status = detailResp.status;
              detailAttempt.body = detailText.slice(0, 500);
              attempts.push(detailAttempt);
              if (detailResp.ok) {
                const detailData = JSON.parse(detailText);
                const detailProperty = detailData?.property?.[0];
                if (detailProperty) return detailProperty;
              }
            } catch (detailError) {
              console.error("Attom detail-by-id fetch error", detailError);
            }
          }
        }
        lastError = `Endpoint ${endpoint} returned no property record with valuation detail`;
      } catch (error) {
        console.error(`Attom fetch error for ${endpoint}`, error);
        lastError = lastError || (error instanceof Error ? error.message : String(error));
      }
    }
  }

  if (bestProperty) return bestProperty;

  const err = new Error(lastError || "Attom fetch failed");
  err.name = "AttomFetchError";
  // @ts-ignore
  err.lastParams = attempts;
  throw err;
}

function parseAttomToValuationFields(attomProperty) {
  if (!attomProperty) return {};
  const getFirstNumber = (...candidates) => {
    for (const value of candidates.flat()) {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
    return null;
  };

  const getFirstString = (...candidates) => {
    for (const value of candidates.flat()) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  };

  const ownerObj = attomProperty.owner || {};
  const ownersArray = Array.isArray(ownerObj.owners) ? ownerObj.owners : [];
  const ownerName =
    getFirstString(
      ownerObj.ownername,
      ownerObj.ownerName,
      ownerObj.ownername1,
      ownerObj.ownername2,
      ownerObj.formattedOwnerName,
      ownersArray[0]?.ownerName,
      [ownerObj.owner1firstName, ownerObj.owner1lastName].filter(Boolean).join(" ").trim(),
      [ownersArray[0]?.owner1FirstName, ownersArray[0]?.owner1LastName].filter(Boolean).join(" ").trim(),
      attomProperty.ownername
    ) || null;

  const assessment = attomProperty.assessment || {};
  const assessed = assessment.assessed || {};
  const market = assessment.market || {};

  const assessorValue = getFirstNumber(
    assessed.totalvalue,
    assessed.totvalue,
    assessed.improvementvalue,
    assessed.imprvalue,
    assessed.landvalue,
    market.totalvalue,
    market.totvalue,
    market.improvementvalue,
    market.imprvalue,
    market.landvalue
  );

  const saleCandidates = [
    attomProperty.sale,
    attomProperty.lastSale,
    Array.isArray(attomProperty.sales) ? attomProperty.sales[0] : null,
    Array.isArray(attomProperty.saleHistory) ? attomProperty.saleHistory[0] : null,
    Array.isArray(attomProperty.salehistory) ? attomProperty.salehistory[0] : null,
    Array.isArray(attomProperty.transferhistory) ? attomProperty.transferhistory[0] : null,
  ].filter(Boolean);
  const saleRecord = saleCandidates.find(Boolean) || {};
  const saleAmount = saleRecord.amount || {};

  const avm = attomProperty.avm || {};
  const avmAmount = avm.amount || {};
  const valuations = attomProperty.valuation || {};
  const valuationsMarket = valuations.market || {};

  const attomAvmValue = getFirstNumber(
    avmAmount.value,
    avmAmount.prediction,
    avmAmount.market,
    avmAmount.avgvalue,
    valuationsMarket.mktTtlValue,
    valuationsMarket.mktTotValue
  );
  const realtorComValue = getFirstNumber(
    avmAmount.value,
    avmAmount.prediction,
    avmAmount.market,
    avmAmount.avgvalue,
    valuationsMarket.mktTtlValue,
    valuationsMarket.mktTotValue
  );
  const lastSalePrice = getFirstNumber(
    saleAmount.saleamt,
    saleRecord.saleamt,
    saleRecord.price,
    saleRecord.amount,
    saleAmount.amount
  );
  const lastSaleDate =
    getFirstString(
      saleRecord.saledate,
      saleRecord.saleDate,
      saleRecord.recordingDate,
      saleRecord.recDate,
      saleRecord.recordDate
    ) || null;

  return {
    assessorValue,
    realtorComValue,
    attomAvmValue,
    currentOwner: ownerName,
    lastSaleDate,
    lastSalePrice,
  };
}

const lenderEmailDocumentPreviewMaxFilesPerGroup = Number.isFinite(Number(process.env.LENDER_EMAIL_DOCUMENT_PREVIEW_MAX_FILES))
  ? Math.max(1, Math.floor(Number(process.env.LENDER_EMAIL_DOCUMENT_PREVIEW_MAX_FILES)))
  : 10;
const lenderDocumentPreviewGroups = {
  compsFiles: "COMPS",
  propertyPhotos: "Property Photos",
  purchaseContractFiles: "Purchase Contract",
  scopeOfWorkFiles: "Scope of Work",
};
const lenderNotificationRecipients = (() => {
  const envValue = [process.env.LENDER_NOTIFICATION_EMAILS, process.env.LENDER_NOTIFICATION_EMAIL]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(",");
  if (!envValue) return [];
  const recipients = [];
  const seen = new Set();
  for (const value of envValue.split(",")) {
    const trimmed = value.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({ email: trimmed });
  }
  return recipients;
})();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLenderPortalLink(params = {}) {
  let url;
  try {
    url = new URL(lenderPortalBaseUrlRaw, defaultLenderPortalOrigin);
  } catch {
    url = new URL(defaultLenderPortalOrigin);
  }
  url.pathname = "/loan-application-summary";
  url.search = "";
  url.hash = "";
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function buildLenderEmailActionLink(loanId, action, options = {}) {
  const expiresAt =
    Number.isFinite(Number(options.expiresAt)) && Number(options.expiresAt) > Date.now()
      ? Number(options.expiresAt)
      : Date.now() + lenderEmailActionTokenTtlMs;
  const payload = `${loanId}:${action}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", lenderEmailActionSecret).update(payload).digest("hex");
  let url;
  try {
    url = new URL(lenderEmailActionBaseUrlRaw || defaultWorkflowApiOrigin, defaultWorkflowApiOrigin);
  } catch {
    url = new URL(defaultWorkflowApiOrigin);
  }
  url.pathname = `/api/workflows/lender/email-actions/${encodeURIComponent(loanId)}/${encodeURIComponent(action)}`;
  url.search = "";
  url.searchParams.set("exp", String(expiresAt));
  url.searchParams.set("sig", signature);
  return url.toString();
}

function verifyLenderEmailActionSignature(loanId, action, exp, signature) {
  if (!loanId || !action || !exp || !signature) return false;
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const payload = `${loanId}:${action}:${expiresAt}`;
  const expected = crypto.createHmac("sha256", lenderEmailActionSecret).update(payload).digest("hex");
  const providedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function parseLenderEmailActionAuth(req) {
  const { exp, sig } = req.query || {};
  return {
    exp: typeof exp === "string" ? exp.trim() : "",
    sig: typeof sig === "string" ? sig.trim() : "",
  };
}

function buildLenderDocumentPreviewLink(loanId, group, index, options = {}) {
  const expiresAt =
    Number.isFinite(Number(options.expiresAt)) && Number(options.expiresAt) > Date.now()
      ? Number(options.expiresAt)
      : Date.now() + lenderEmailActionTokenTtlMs;
  const payload = `${loanId}:doc:${group}:${index}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", lenderEmailActionSecret).update(payload).digest("hex");
  let url;
  try {
    url = new URL(lenderEmailActionBaseUrlRaw || defaultWorkflowApiOrigin, defaultWorkflowApiOrigin);
  } catch {
    url = new URL(defaultWorkflowApiOrigin);
  }
  url.pathname = `/api/workflows/lender/document-preview/${encodeURIComponent(loanId)}/${encodeURIComponent(group)}/${encodeURIComponent(index)}`;
  url.search = "";
  url.searchParams.set("exp", String(expiresAt));
  url.searchParams.set("sig", signature);
  return url.toString();
}

function buildLenderDocumentViewerLink(loanId, group, index, options = {}) {
  const expiresAt =
    Number.isFinite(Number(options.expiresAt)) && Number(options.expiresAt) > Date.now()
      ? Number(options.expiresAt)
      : Date.now() + lenderEmailActionTokenTtlMs;
  const payload = `${loanId}:doc:${group}:${index}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", lenderEmailActionSecret).update(payload).digest("hex");
  let url;
  try {
    url = new URL(lenderEmailActionBaseUrlRaw || defaultWorkflowApiOrigin, defaultWorkflowApiOrigin);
  } catch {
    url = new URL(defaultWorkflowApiOrigin);
  }
  url.pathname = `/api/workflows/lender/document-viewer/${encodeURIComponent(loanId)}/${encodeURIComponent(group)}/${encodeURIComponent(index)}`;
  url.search = "";
  url.searchParams.set("exp", String(expiresAt));
  url.searchParams.set("sig", signature);
  return url.toString();
}

function buildLenderConditionsDocumentLink(loanId, packageId, fileId) {
  let url;
  try {
    url = new URL(lenderEmailActionBaseUrlRaw || defaultWorkflowApiOrigin, defaultWorkflowApiOrigin);
  } catch {
    url = new URL(defaultWorkflowApiOrigin);
  }
  url.pathname = `/api/workflows/lender/conditions-document/${encodeURIComponent(loanId)}/${encodeURIComponent(packageId)}/${encodeURIComponent(fileId)}`;
  url.search = "";
  return url.toString();
}

function buildLenderLlcDocumentsViewerLink(loanId) {
  let url;
  try {
    url = new URL(lenderEmailActionBaseUrlRaw || defaultWorkflowApiOrigin, defaultWorkflowApiOrigin);
  } catch {
    url = new URL(defaultWorkflowApiOrigin);
  }
  url.pathname = `/api/workflows/lender/llc-documents/${encodeURIComponent(loanId)}`;
  url.search = "";
  return url.toString();
}

function verifyLenderDocumentPreviewSignature(loanId, group, index, exp, signature) {
  if (!loanId || !group || index === null || index === undefined || !exp || !signature) return false;
  const normalizedIndex = Number(index);
  const expiresAt = Number(exp);
  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) return false;
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const payload = `${loanId}:doc:${group}:${normalizedIndex}:${expiresAt}`;
  const expected = crypto.createHmac("sha256", lenderEmailActionSecret).update(payload).digest("hex");
  const providedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function normalizeUploadedDocumentForPreview(input, options = {}) {
  const fallbackName =
    typeof options.fallbackName === "string" && options.fallbackName.trim() ? options.fallbackName.trim() : "document";
  if (typeof input === "string" && input.trim()) {
    return {
      name: input.trim(),
      contentType: "application/octet-stream",
      dataUrl: null,
    };
  }
  if (!input || typeof input !== "object") return null;
  return {
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : fallbackName,
    contentType:
      typeof input.contentType === "string" && input.contentType.trim()
        ? input.contentType.trim()
        : "application/octet-stream",
    dataUrl:
      typeof input.dataUrl === "string" && input.dataUrl.trim().startsWith("data:")
        ? input.dataUrl.trim()
        : null,
  };
}

function parseDataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
  const match = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!match) return null;
  const mimeType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  try {
    const buffer = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
    return { mimeType, buffer };
  } catch {
    return null;
  }
}

function sanitizePathSegment(value, fallback = "item") {
  const raw = typeof value === "string" ? value.trim() : "";
  const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned || fallback;
}

function normalizeStoredRelativePath(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "")
    .trim();
}

function isSafeStoredRelativePath(relativePath) {
  if (!relativePath) return false;
  if (relativePath.includes("..")) return false;
  if (path.isAbsolute(relativePath)) return false;
  return true;
}

function resolveStoredDataPath(relativePath) {
  const normalizedRelativePath = normalizeStoredRelativePath(relativePath);
  if (!isSafeStoredRelativePath(normalizedRelativePath)) return null;
  const resolvedRoot = path.resolve(dataDir);
  const resolvedPath = path.resolve(dataDir, normalizedRelativePath);
  if (!resolvedPath.startsWith(resolvedRoot)) return null;
  return resolvedPath;
}

function toStoredRelativePath(filePath) {
  return normalizeStoredRelativePath(path.relative(dataDir, filePath));
}

function inferFileExtension(fileName, mimeType = "application/octet-stream") {
  const fromName = path.extname(typeof fileName === "string" ? fileName : "").toLowerCase();
  if (fromName && fromName.length <= 10) return fromName;
  const lookup = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  };
  return lookup[mimeType] || ".bin";
}

function getConditionsLiquidityCategoryLabel(category) {
  const option = getConditionsLiquidityCategory(category);
  return option ? option.label : "Liquidity document";
}

function getConditionsLiquiditySubcategoryLabel(category, subcategory) {
  const categoryOption = getConditionsLiquidityCategory(category);
  if (!categoryOption) return "";
  const subcategoryOption = categoryOption.subcategories.find((option) => option.value === subcategory);
  return subcategoryOption ? subcategoryOption.label : "";
}

function normalizeConditionsDocumentPackageFile(input, index = 0) {
  if (!input || typeof input !== "object") return null;
  const id =
    typeof input.id === "string" && input.id.trim() ? input.id.trim() : `conditions-doc-${index + 1}`;
  const name =
    typeof input.name === "string" && input.name.trim() ? input.name.trim() : `conditions-document-${index + 1}`;
  const label =
    typeof input.label === "string" && input.label.trim() ? input.label.trim() : "Conditions Document";
  const section = typeof input.section === "string" ? input.section.trim() : "conditions";
  const relativePath = normalizeStoredRelativePath(input.relativePath);
  if (!isSafeStoredRelativePath(relativePath)) return null;
  return {
    id,
    section,
    label,
    name,
    relativePath,
    savedAs: typeof input.savedAs === "string" ? input.savedAs : name,
    mimeType: typeof input.mimeType === "string" ? input.mimeType : "application/octet-stream",
    bytes: Number.isFinite(Number(input.bytes)) && Number(input.bytes) >= 0 ? Number(input.bytes) : 0,
    category: typeof input.category === "string" ? input.category : "",
    subcategory: typeof input.subcategory === "string" ? input.subcategory : "",
    docType: typeof input.docType === "string" ? input.docType : "",
    projectIndex: Number.isFinite(Number(input.projectIndex)) ? Number(input.projectIndex) : null,
    propertyAddress: typeof input.propertyAddress === "string" ? input.propertyAddress : "",
  };
}

function normalizeConditionsDocumentPackage(input) {
  if (!input || typeof input !== "object") return null;
  const rootRelativePath = normalizeStoredRelativePath(input.rootRelativePath);
  if (!isSafeStoredRelativePath(rootRelativePath)) return null;
  const files = Array.isArray(input.files)
    ? input.files.map((file, index) => normalizeConditionsDocumentPackageFile(file, index)).filter(Boolean)
    : [];
  return {
    id:
      typeof input.id === "string" && input.id.trim()
        ? input.id.trim()
        : `conditions-package-${Number(input.createdAt) || Date.now()}`,
    createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : null,
    rootRelativePath,
    manifestRelativePath: isSafeStoredRelativePath(normalizeStoredRelativePath(input.manifestRelativePath))
      ? normalizeStoredRelativePath(input.manifestRelativePath)
      : null,
    documentCount:
      Number.isFinite(Number(input.documentCount)) && Number(input.documentCount) >= 0
        ? Number(input.documentCount)
        : files.length,
    files,
  };
}

async function persistBorrowerConditionsDocumentPackage(loanId, submission, options = {}) {
  const createdAt =
    Number.isFinite(Number(options.createdAt)) && Number(options.createdAt) > 0 ? Number(options.createdAt) : Date.now();
  const packageId = `${createdAt}-${Math.random().toString(16).slice(2, 8)}`;
  const safeLoanId = sanitizePathSegment(loanId, "loan");
  const packageDir = path.join(conditionsDocumentsDir, safeLoanId, sanitizePathSegment(packageId, String(createdAt)));
  await fs.mkdir(packageDir, { recursive: true });

  let docCounter = 0;
  const packageFiles = [];
  const ensureSectionDir = async (sectionPath) => {
    const absoluteSectionDir = path.join(packageDir, sectionPath);
    await fs.mkdir(absoluteSectionDir, { recursive: true });
    return absoluteSectionDir;
  };

  const saveDocument = async ({ document, section, subDir, label, category, subcategory, docType, projectIndex, propertyAddress }) => {
    if (!document || typeof document !== "object") return;
    const parsed = parseDataUrlToBuffer(document.dataUrl);
    if (!parsed || !Buffer.isBuffer(parsed.buffer)) return;
    const sectionDir = await ensureSectionDir(subDir);
    docCounter += 1;
    const originalName = typeof document.name === "string" && document.name.trim() ? document.name.trim() : `${section}-${docCounter}`;
    const originalBase = path.basename(originalName, path.extname(originalName));
    const safeBase = sanitizePathSegment(originalBase, `${section}-${docCounter}`);
    const extension = inferFileExtension(originalName, parsed.mimeType);
    const savedAs = `${String(docCounter).padStart(3, "0")}-${safeBase}${extension}`;
    const absolutePath = path.join(sectionDir, savedAs);
    await fs.writeFile(absolutePath, parsed.buffer);

    packageFiles.push({
      id: `conditions-doc-${docCounter}`,
      section,
      label,
      name: originalName,
      savedAs,
      relativePath: toStoredRelativePath(absolutePath),
      mimeType: parsed.mimeType || document.contentType || "application/octet-stream",
      bytes: parsed.buffer.byteLength,
      category: typeof category === "string" ? category : "",
      subcategory: typeof subcategory === "string" ? subcategory : "",
      docType: typeof docType === "string" ? docType : "",
      projectIndex: Number.isFinite(Number(projectIndex)) ? Number(projectIndex) : null,
      propertyAddress: typeof propertyAddress === "string" ? propertyAddress : "",
    });
  };

  for (const doc of Array.isArray(submission.proofOfLiquidityDocs) ? submission.proofOfLiquidityDocs : []) {
    const category = typeof doc?.category === "string" ? doc.category : "";
    const subcategory = typeof doc?.subcategory === "string" ? doc.subcategory : "";
    const categoryLabel = getConditionsLiquidityCategoryLabel(category);
    const subcategoryLabel = getConditionsLiquiditySubcategoryLabel(category, subcategory);
    const label = subcategoryLabel
      ? `Proof of Liquidity - ${categoryLabel} / ${subcategoryLabel}`
      : `Proof of Liquidity - ${categoryLabel}`;
    await saveDocument({
      document: doc,
      section: "proof_of_liquidity",
      subDir: "proof-of-liquidity",
      label,
      category,
      subcategory,
    });
  }

  for (const doc of Array.isArray(submission.llcDocs) ? submission.llcDocs : []) {
    const docType = typeof doc?.docType === "string" ? doc.docType : "";
    await saveDocument({
      document: doc,
      section: "llc_documents",
      subDir: "llc-documents",
      label: `LLC Document - ${getLlcDocLabel(docType)}`,
      docType,
    });
  }

  const projects = Array.isArray(submission.pastProjects) ? submission.pastProjects : [];
  for (const [projectIndex, project] of projects.entries()) {
    const propertyAddress = typeof project?.propertyAddress === "string" ? project.propertyAddress.trim() : "";
    const photos = Array.isArray(project?.photos) ? project.photos : [];
    for (const photo of photos) {
      await saveDocument({
        document: photo,
        section: "past_projects",
        subDir: `past-projects/project-${projectIndex + 1}`,
        label: `Past Project Photo - ${propertyAddress || `Project ${projectIndex + 1}`}`,
        projectIndex: projectIndex + 1,
        propertyAddress,
      });
    }
  }

  if (packageFiles.length === 0) {
    await fs.rm(packageDir, { recursive: true, force: true }).catch(() => {});
    throw new Error("No condition documents were saved.");
  }

  const manifestPath = path.join(packageDir, "manifest.json");
  const rootRelativePath = toStoredRelativePath(packageDir);
  const manifestRelativePath = toStoredRelativePath(manifestPath);
  const documentPackage = {
    id: packageId,
    createdAt,
    rootRelativePath,
    manifestRelativePath,
    documentCount: packageFiles.length,
    files: packageFiles,
  };
  await fs.writeFile(manifestPath, JSON.stringify(documentPackage, null, 2), "utf8");
  return documentPackage;
}

function buildLenderEmailDocumentGroups(application) {
  const purchase = application?.purchaseDetails && typeof application.purchaseDetails === "object" ? application.purchaseDetails : null;
  if (!purchase) return [];
  const groups = [];
  for (const [groupKey, label] of Object.entries(lenderDocumentPreviewGroups)) {
    const raw = Array.isArray(purchase[groupKey]) ? purchase[groupKey] : [];
    if (raw.length === 0) continue;
    const files = [];
    for (let index = 0; index < raw.length; index += 1) {
      const normalized = normalizeUploadedDocumentForPreview(raw[index], {
        fallbackName: `${groupKey}-${index + 1}`,
      });
      if (!normalized) continue;
      files.push({
        ...normalized,
        index,
        previewLink: normalized.dataUrl ? buildLenderDocumentPreviewLink(application.id, groupKey, index) : null,
        viewerLink: normalized.dataUrl ? buildLenderDocumentViewerLink(application.id, groupKey, index) : null,
        isImage: normalized.contentType.startsWith("image/"),
      });
    }
    if (files.length > 0) {
      const shownFiles = files.slice(0, lenderEmailDocumentPreviewMaxFilesPerGroup);
      groups.push({
        key: groupKey,
        label,
        files: shownFiles,
        totalFiles: files.length,
        hiddenFileCount: Math.max(files.length - shownFiles.length, 0),
      });
    }
  }
  return groups;
}

function getLenderPreviewDocument(application, group, index) {
  const purchase = application?.purchaseDetails && typeof application.purchaseDetails === "object" ? application.purchaseDetails : null;
  if (!purchase) return null;
  if (!Object.prototype.hasOwnProperty.call(lenderDocumentPreviewGroups, group)) return null;
  const rawFiles = Array.isArray(purchase[group]) ? purchase[group] : [];
  if (!Number.isInteger(index) || index < 0 || index >= rawFiles.length) return null;
  const normalized = normalizeUploadedDocumentForPreview(rawFiles[index], {
    fallbackName: `${group}-${index + 1}`,
  });
  if (!normalized || !normalized.dataUrl) return null;
  return normalized;
}

function buildBorrowerPortalLink(params = {}) {
  let url;
  try {
    url = new URL(borrowerPortalBaseUrlRaw, defaultBorrowerPortalOrigin);
  } catch {
    url = new URL(defaultBorrowerPortalOrigin);
  }
  url.pathname = "/borrower/applications";
  url.search = "";
  url.hash = "";
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function buildBorrowerConditionsLink(params = {}) {
  let url;
  try {
    url = new URL(borrowerPortalBaseUrlRaw, defaultBorrowerPortalOrigin);
  } catch {
    url = new URL(defaultBorrowerPortalOrigin);
  }
  url.pathname = "/borrower/conditions";
  url.search = "";
  url.hash = "";
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}
const makeThreadId = () => `thr-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const requiredLlcDocTypes = [
  "CERTIFICATE_OF_GOOD_STANDING",
  "OPERATING_AGREEMENT",
  "ARTICLES_OF_ORGANIZATION",
  "EIN",
];
const conditionsLiquidityDocumentOptions = [
  {
    category: "BANK_STATEMENTS",
    label: "Bank statements",
    subcategories: [
      { value: "CHECKING_ACCOUNTS", label: "Checking accounts" },
      { value: "SAVINGS_ACCOUNTS", label: "Savings accounts" },
      { value: "MONEY_MARKET_ACCOUNTS", label: "Money market accounts" },
    ],
  },
  {
    category: "BROKERAGE_INVESTMENT_ACCOUNTS",
    label: "Brokerage / investment accounts",
    subcategories: [
      { value: "STOCKS", label: "Stocks" },
      { value: "ETFS", label: "ETFs" },
      { value: "MUTUAL_FUNDS", label: "Mutual funds" },
    ],
  },
  {
    category: "RETIREMENT_ACCOUNTS",
    label: "Retirement accounts",
    subcategories: [
      { value: "RETIREMENT_401K", label: "401(k)" },
      { value: "RETIREMENT_IRA", label: "IRA" },
      { value: "RETIREMENT_ROTH_IRA", label: "Roth IRA" },
      { value: "BONDS", label: "Bonds" },
    ],
  },
  {
    category: "LINES_OF_CREDIT_UNUSED",
    label: "Lines of credit (unused portion)",
    subcategories: [
      { value: "HELOC", label: "HELOC" },
      { value: "BUSINESS_LINE_OF_CREDIT", label: "Business line of credit" },
      { value: "MARGIN_ACCOUNT", label: "Margin account" },
    ],
  },
  {
    category: "CRYPTOCURRENCY",
    label: "Cryptocurrency",
    subcategories: [
      { value: "BITCOIN", label: "Bitcoin" },
      { value: "ETHEREUM", label: "Ethereum" },
      { value: "STABLECOINS", label: "Stablecoins" },
    ],
  },
  {
    category: "CASH_VALUE_LIFE_INSURANCE",
    label: "Cash value life insurance",
    subcategories: [{ value: "BORROWABLE_POLICY_VALUE", label: "Borrow against policy value" }],
  },
];
const conditionsLiquidityCategoryMap = new Map(
  conditionsLiquidityDocumentOptions.map((option) => [option.category, option])
);
const llcDocLabels = {
  CERTIFICATE_OF_GOOD_STANDING: "Certificate of Good Standing",
  OPERATING_AGREEMENT: "Operating Agreement",
  ARTICLES_OF_ORGANIZATION: "Articles of Organization",
  EIN: "EIN",
};
const requiredLiquidityProofDocTypes = ["BANK_STATEMENT", "OTHER_ACCOUNT"];
const liquidityOwnershipTypes = ["BORROWER", "LLC", "PARTNER_LLC_MEMBER"];
const borrowerAccessStatuses = ["NOT_CREATED", "ACCESS_CREATED", "PROFILE_COMPLETED"];
const loanTypesRequiringPurchaseDetails = new Set([
  "Fix & Flip Loan (Rehab Loan)",
  "Bridge Loan",
  "Ground-Up Construction Loan",
  "Transactional Funding (Double Close / Wholesale)",
  "Land Loan",
  "Purchase",
]);
const borrowerProfileDefaults = {
  firstName: "Michael",
  middleName: "",
  lastName: "Chen",
  email: "michael.chen@email.com",
  homePhone: "",
  workPhone: "",
  mobilePhone: "(512) 555-0142",
  dateOfBirth: "",
  socialSecurityNumber: "",
  civilStatus: "",
  presentAddress: { street: "", city: "", state: "", zip: "" },
  timeAtResidence: "",
  mailingSameAsPresent: true,
  mailingAddress: { street: "", city: "", state: "", zip: "" },
  noBusinessAddress: false,
  businessAddress: { street: "", city: "", state: "", zip: "" },
  emergencyContacts: [
    { name: "", email: "", phone: "" },
    { name: "", email: "", phone: "" },
    { name: "", email: "", phone: "" },
  ],
  guarantors: [],
  guarantorContacts: [],
  liquidityProofDocs: [],
  creditScore: 742,
  liquidityAmount: "250000",
  llcName: "MC Capital Ventures LLC",
  llcDocs: requiredLlcDocTypes.map((docType) => ({
    name: `${docType.toLowerCase().replace(/_/g, "-")}.pdf`,
    contentType: "application/pdf",
    dataUrl: "",
    docType,
  })),
  mortgageLenders: ["Lima One Capital", "Kiavi"],
  referral: {
    name: "Sarah Johnson",
    phone: "(512) 555-0188",
    email: "sarah.johnson@example.com",
  },
  pastProjects: [
    { propertyName: "210 Barton Creek, Austin, TX", photoLabel: "Barton-Creek.jpg" },
    { propertyName: "901 New St, Austin, TX", photoLabel: "New-Street.jpg" },
  ],
};

const requiresPurchaseDetails = (type) =>
  typeof type === "string" && loanTypesRequiringPurchaseDetails.has(type);

const valuationInputFields = [
  { key: "assessorValue", label: "Assessor Value" },
  { key: "attomAvmValue", label: "AVM (ATTOM)", optional: true },
  { key: "zillowValue", label: "Zillow Value" },
  { key: "realtorComValue", label: "Realtor.com Value" },
  { key: "narprValue", label: "NARRPR Value" },
  { key: "propelioMedianValue", label: "Propelio Median Value" },
  { key: "propelioHighValue", label: "Propelio High Value" },
  { key: "propelioLowValue", label: "Propelio Low Value" },
  { key: "economicValue", label: "Economic Value" },
  { key: "rentometerEstimate", label: "Rentometer Estimate" },
  { key: "zillowRentEstimate", label: "Zillow Rent Estimate" },
  { key: "currentOwner", label: "Current Owner" },
  { key: "lastSaleDate", label: "Last Sale Date" },
  { key: "lastSalePrice", label: "Last Sale Price" },
  { key: "bankruptcyRecord", label: "Bankruptcy Record" },
  { key: "internalWatchlist", label: "Internal Watchlist" },
  { key: "forecasaStatus", label: "Forecasa Status" },
  { key: "activeLoansCount", label: "Number of Active Loans" },
  { key: "negativeDeedRecords", label: "Register of Deeds - High-Risk Negative Records" },
];
const valuationInputFieldKeys = valuationInputFields.map((field) => field.key);
const valuationInputRoles = new Set(["LOAN_OFFICER", "EVALUATOR"]);
const underwritingValuationEditableStatuses = new Set(["In-underwriting", "UW for Review", "Under Review"]);

const evaluatorInputFields = [
  { key: "cmaAvgSalePrice", label: "Avg Sale Price" },
  { key: "cmaPricePerSqFt", label: "Price / Sq Ft" },
  { key: "cmaDaysOnMarket", label: "Days on Market" },
  { key: "cmaSubjectSqFt", label: "Subject Sq Ft" },
  { key: "keyFindingLtv", label: "LTV" },
  { key: "keyFindingApplication", label: "Application" },
  { key: "keyFindingScore", label: "Score" },
  { key: "asIsValue", label: "As-Is Value" },
  { key: "arv", label: "ARV" },
  { key: "currentLtv", label: "Current LTV" },
  { key: "ltvAfterRepairs", label: "LTV After Repairs" },
  { key: "recommendation", label: "Recommendation" },
  { key: "confidence", label: "Confidence" },
  { key: "riskLevel", label: "Risk Level" },
  { key: "professionalAssessment", label: "Professional Assessment" },
];
const evaluatorInputFieldKeys = evaluatorInputFields.map((field) => field.key);
const evaluatorInputRoles = new Set(["EVALUATOR"]);

function getLlcDocLabel(docType) {
  if (typeof docType !== "string") return "LLC document";
  return llcDocLabels[docType] || docType.replace(/_/g, " ");
}

function getConditionsLiquidityCategory(category) {
  if (typeof category !== "string") return null;
  return conditionsLiquidityCategoryMap.get(category) || null;
}

function isValidConditionsLiquiditySubcategory(category, subcategory) {
  const categoryOption = getConditionsLiquidityCategory(category);
  if (!categoryOption || typeof subcategory !== "string") return false;
  return categoryOption.subcategories.some((option) => option.value === subcategory);
}

const makeCommunication = ({
  from,
  channel,
  type,
  message,
  subject = "",
  readByBorrower,
  attachments = [],
  threadId,
}) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  threadId: threadId || makeThreadId(),
  from,
  channel,
  type,
  subject,
  message,
  attachments,
  createdAt: Date.now(),
  readByBorrower,
});

const normalizeApplication = (application) => {
  const borrowerEmail = application.borrowerEmail || borrowerProfileDefaults.email;
  const borrowerProfile = normalizeBorrowerProfile(application.borrowerProfile, {
    fallbackEmail: borrowerEmail,
    fallbackLlcName: application?.underwritingIntake?.formData?.llcName || borrowerProfileDefaults.llcName,
    fallbackName: application.borrowerName || "",
  });
  const borrowerAccess = normalizeBorrowerAccess(application.borrowerAccess, {
    borrowerEmail,
    isProfileComplete: isBorrowerProfileComplete(borrowerProfile),
  });
  const llcName =
    typeof application.llcName === "string" && application.llcName.trim()
      ? application.llcName.trim()
      : borrowerProfile.llcName;
  const llcStateRecorded =
    typeof application.llcStateRecorded === "string" ? application.llcStateRecorded.trim() : "";
  const llcSameAsOnFile =
    typeof application.llcSameAsOnFile === "boolean" ? application.llcSameAsOnFile : true;
  const llcDocs = normalizeLlcDocs(application.llcDocs);
  const conditionsForm =
    application.conditionsForm && typeof application.conditionsForm === "object"
      ? normalizeBorrowerConditionsForm(application.conditionsForm)
      : null;
  const valuationInputTrail = normalizeValuationInputTrail(application.valuationInputTrail);

  return {
    ...application,
    borrowerEmail,
    borrowerProfile,
    borrowerAccess,
    llcName,
    llcStateRecorded,
    llcSameAsOnFile,
    llcDocs,
    conditionsForm,
    valuationInputTrail,
    underwritingIntake: normalizeUnderwritingIntake(application.underwritingIntake),
    underwritingSummary: normalizeUnderwritingSummary(application.underwritingSummary),
    communications: Array.isArray(application.communications)
      ? application.communications.map((entry) => ({
          ...entry,
          threadId: entry.threadId || `legacy-${entry.id || Date.now()}`,
          subject: typeof entry.subject === "string" ? entry.subject : "",
          attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
        }))
      : [],
    lenderComments: Array.isArray(application.lenderComments)
      ? application.lenderComments
          .filter((entry) => entry && typeof entry === "object")
          .map((entry) => ({
            id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : `comment-${Date.now()}`,
            message: typeof entry.message === "string" ? entry.message : "",
            createdAt: typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
            createdBy: typeof entry.createdBy === "string" ? entry.createdBy : "LENDER",
          }))
      : [],
  };
};

function normalizeAddress(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    street: typeof source.street === "string" ? source.street.trim() : "",
    city: typeof source.city === "string" ? source.city.trim() : "",
    state: typeof source.state === "string" ? source.state.trim() : "",
    zip: typeof source.zip === "string" ? source.zip.trim() : "",
  };
}

function normalizeEmergencyContacts(input) {
  const contacts = Array.isArray(input) ? input : [];
  const normalized = contacts
    .filter((contact) => contact && typeof contact === "object")
    .map((contact) => ({
      name: typeof contact.name === "string" ? contact.name.trim() : "",
      email: typeof contact.email === "string" ? contact.email.trim() : "",
      phone: typeof contact.phone === "string" ? contact.phone.trim() : "",
    }));
  while (normalized.length < 3) {
    normalized.push({ name: "", email: "", phone: "" });
  }
  return normalized.slice(0, 3);
}

function normalizeGuarantors(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const normalized = [];
  for (const entry of input) {
    const value = typeof entry === "string" ? entry.trim() : "";
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}

function normalizeGuarantorContacts(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((contact) => contact && typeof contact === "object")
    .map((contact) => ({
      firstName: typeof contact.firstName === "string" ? contact.firstName.trim() : "",
      lastName: typeof contact.lastName === "string" ? contact.lastName.trim() : "",
      email: typeof contact.email === "string" ? contact.email.trim() : "",
      phone: typeof contact.phone === "string" ? contact.phone.trim() : "",
    }))
    .filter((contact) => contact.firstName || contact.lastName || contact.email || contact.phone);
}

function normalizeLiquidityProofDocs(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((doc) => doc && typeof doc === "object")
    .map((doc, index) => ({
      name:
        typeof doc.name === "string" && doc.name.trim()
          ? doc.name.trim()
          : `liquidity-proof-${index + 1}.pdf`,
      contentType: typeof doc.contentType === "string" ? doc.contentType : "application/octet-stream",
      dataUrl: typeof doc.dataUrl === "string" ? doc.dataUrl : "",
      docType:
        typeof doc.docType === "string" && requiredLiquidityProofDocTypes.includes(doc.docType)
          ? doc.docType
          : "OTHER_ACCOUNT",
      statementName: typeof doc.statementName === "string" ? doc.statementName.trim() : "",
      ownershipType:
        typeof doc.ownershipType === "string" && liquidityOwnershipTypes.includes(doc.ownershipType)
          ? doc.ownershipType
          : "BORROWER",
      partnerIsGuarantor: Boolean(doc.partnerIsGuarantor),
      partnerGuarantorName: typeof doc.partnerGuarantorName === "string" ? doc.partnerGuarantorName.trim() : "",
      partnerIsLlcMember: Boolean(doc.partnerIsLlcMember),
      uploadedAt: Number.isFinite(Number(doc.uploadedAt)) ? Number(doc.uploadedAt) : null,
    }));
}

function normalizeLiquidityProofDocType(value) {
  return value === "BANK_STATEMENT" ? "BANK_STATEMENT" : "OTHER_ACCOUNT";
}

function isLiquidityProofDocUsable(doc, options = {}) {
  const hasDataUrl = typeof doc?.dataUrl === "string" && doc.dataUrl.trim().length > 0;
  if (!hasDataUrl) return false;
  if (!options.requireFresh) return true;
  const uploadedAt = Number(doc?.uploadedAt);
  const referenceTime = Number.isFinite(Number(options.referenceTime)) ? Number(options.referenceTime) : Date.now();
  return Number.isFinite(uploadedAt) && referenceTime - uploadedAt <= THIRTY_DAYS_MS;
}

function getUsableLiquidityProofDocs(profileOrDocs, options = {}) {
  const docs = Array.isArray(profileOrDocs)
    ? profileOrDocs
    : Array.isArray(profileOrDocs?.liquidityProofDocs)
      ? profileOrDocs.liquidityProofDocs
      : [];
  return docs
    .filter((doc) => isLiquidityProofDocUsable(doc, options))
    .sort((a, b) => Number(b?.uploadedAt || 0) - Number(a?.uploadedAt || 0));
}

function getLatestLiquidityProofUploadedAt(docs) {
  const latest = (Array.isArray(docs) ? docs : [])
    .filter((doc) => isLiquidityProofDocUsable(doc))
    .reduce((currentLatest, doc) => {
      const uploadedAt = Number(doc?.uploadedAt);
      if (!Number.isFinite(uploadedAt)) return currentLatest;
      return uploadedAt > currentLatest ? uploadedAt : currentLatest;
    }, Number.NEGATIVE_INFINITY);
  return Number.isFinite(latest) ? latest : null;
}

function hasRequiredLiquidityProofDocs(profile, options = {}) {
  return getUsableLiquidityProofDocs(profile, options).length > 0;
}

function normalizeComparableName(value) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

function normalizeBorrowerEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function namesLikelyMatch(left, right) {
  const normalizedLeft = normalizeComparableName(left);
  const normalizedRight = normalizeComparableName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function getBorrowerFullName(profile) {
  return [profile?.firstName, profile?.middleName, profile?.lastName]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part.trim())
    .join(" ");
}

function getGuarantorContactFullName(contact) {
  return [contact?.firstName, contact?.lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function getLiquidityDocLabel(docType) {
  if (docType === "BANK_STATEMENT") return "Bank Statement";
  if (docType === "OTHER_ACCOUNT") return "Other Account Statement";
  return "Liquidity Statement";
}

function validateLiquidityProofOwnershipRules(profile, options = {}) {
  const docs = getUsableLiquidityProofDocs(profile, options);
  const borrowerName = getBorrowerFullName(profile);
  const llcName = typeof profile?.llcName === "string" ? profile.llcName.trim() : "";
  const guarantorSet = new Set(
    (Array.isArray(profile?.guarantors) ? profile.guarantors : [])
      .map((name) => normalizeComparableName(name))
      .filter(Boolean)
  );
  const guarantorContacts = Array.isArray(profile?.guarantorContacts) ? profile.guarantorContacts : [];

  const errors = [];
  for (const matchingDoc of docs) {
    const normalizedDocType = normalizeLiquidityProofDocType(matchingDoc?.docType);
    const label = getLiquidityDocLabel(normalizedDocType);
    const statementName = typeof matchingDoc.statementName === "string" ? matchingDoc.statementName.trim() : "";
    if (!statementName) {
      errors.push(`Name shown on ${label} is required.`);
      continue;
    }

    const matchesBorrowerName = namesLikelyMatch(statementName, borrowerName);
    const matchesLlcName = namesLikelyMatch(statementName, llcName);
    if (matchesBorrowerName || matchesLlcName) continue;

    if (!matchingDoc.partnerIsGuarantor) {
      errors.push(`Confirm ${statementName} is a guarantor for ${label}.`);
    }
    if (!matchingDoc.partnerIsLlcMember) {
      errors.push(`Confirm ${statementName} is an LLC member for ${label}.`);
    }
    if (!guarantorSet.has(normalizeComparableName(statementName))) {
      errors.push(`Add ${statementName} as a guarantor before submitting underwriting.`);
    }
    const matchingGuarantorContact = guarantorContacts.find(
      (contact) =>
        normalizeComparableName(getGuarantorContactFullName(contact)) === normalizeComparableName(statementName)
    );
    if (
      !matchingGuarantorContact ||
      !matchingGuarantorContact.firstName ||
      !matchingGuarantorContact.lastName ||
      !matchingGuarantorContact.email ||
      !matchingGuarantorContact.phone
    ) {
      errors.push(`Add guarantor details for ${statementName}: first name, last name, email, and phone.`);
    }
    if (!isLiquidityProofDocUsable(matchingDoc, { requireFresh: true, referenceTime: options.referenceTime })) {
      errors.push(`Re-upload ${label} after confirming ${statementName} as guarantor and LLC member.`);
    }
  }
  return errors;
}

function splitName(name) {
  if (!name || typeof name !== "string") return { firstName: "", middleName: "", lastName: "" };
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: "", middleName: "", lastName: "" };
  if (tokens.length === 1) return { firstName: tokens[0], middleName: "", lastName: "" };
  if (tokens.length === 2) return { firstName: tokens[0], middleName: "", lastName: tokens[1] };
  return {
    firstName: tokens[0],
    middleName: tokens.slice(1, -1).join(" "),
    lastName: tokens[tokens.length - 1],
  };
}

function normalizeBorrowerProfile(input, options = {}) {
  const source = input && typeof input === "object" ? input : {};
  const fallbackNameParts = splitName(options.fallbackName || "");
  const presentAddress = normalizeAddress(source.presentAddress || borrowerProfileDefaults.presentAddress);
  const mailingSameAsPresent =
    typeof source.mailingSameAsPresent === "boolean"
      ? source.mailingSameAsPresent
      : borrowerProfileDefaults.mailingSameAsPresent;
  const rawMailing = normalizeAddress(source.mailingAddress || borrowerProfileDefaults.mailingAddress);
  const mailingAddress = mailingSameAsPresent ? presentAddress : rawMailing;
  const noBusinessAddress =
    typeof source.noBusinessAddress === "boolean"
      ? source.noBusinessAddress
      : borrowerProfileDefaults.noBusinessAddress;
  return {
    firstName:
      typeof source.firstName === "string" && source.firstName.trim()
        ? source.firstName.trim()
        : fallbackNameParts.firstName || borrowerProfileDefaults.firstName,
    middleName:
      typeof source.middleName === "string"
        ? source.middleName.trim()
        : fallbackNameParts.middleName || borrowerProfileDefaults.middleName,
    lastName:
      typeof source.lastName === "string" && source.lastName.trim()
        ? source.lastName.trim()
        : fallbackNameParts.lastName || borrowerProfileDefaults.lastName,
    llcName:
      typeof source.llcName === "string" && source.llcName.trim()
        ? source.llcName.trim()
        : options.fallbackLlcName || borrowerProfileDefaults.llcName,
    email:
      typeof source.email === "string" && source.email.trim()
        ? source.email.trim()
        : options.fallbackEmail || borrowerProfileDefaults.email,
    homePhone: typeof source.homePhone === "string" ? source.homePhone.trim() : borrowerProfileDefaults.homePhone,
    workPhone: typeof source.workPhone === "string" ? source.workPhone.trim() : borrowerProfileDefaults.workPhone,
    mobilePhone:
      typeof source.mobilePhone === "string" ? source.mobilePhone.trim() : borrowerProfileDefaults.mobilePhone,
    dateOfBirth:
      typeof source.dateOfBirth === "string" ? source.dateOfBirth.trim() : borrowerProfileDefaults.dateOfBirth,
    socialSecurityNumber:
      typeof source.socialSecurityNumber === "string"
        ? source.socialSecurityNumber.trim()
        : borrowerProfileDefaults.socialSecurityNumber,
    civilStatus:
      typeof source.civilStatus === "string" ? source.civilStatus.trim() : borrowerProfileDefaults.civilStatus,
    presentAddress,
    timeAtResidence:
      typeof source.timeAtResidence === "string" ? source.timeAtResidence.trim() : borrowerProfileDefaults.timeAtResidence,
    mailingSameAsPresent,
    mailingAddress,
    noBusinessAddress,
    businessAddress: normalizeAddress(source.businessAddress || borrowerProfileDefaults.businessAddress),
    emergencyContacts: normalizeEmergencyContacts(source.emergencyContacts || borrowerProfileDefaults.emergencyContacts),
    guarantors: normalizeGuarantors(source.guarantors || borrowerProfileDefaults.guarantors),
    guarantorContacts: normalizeGuarantorContacts(
      source.guarantorContacts || borrowerProfileDefaults.guarantorContacts
    ),
    liquidityProofDocs: normalizeLiquidityProofDocs(source.liquidityProofDocs || borrowerProfileDefaults.liquidityProofDocs),
  };
}

function getBorrowerProfileValidationErrors(profileInput) {
  const profile = normalizeBorrowerProfile(profileInput);
  const errors = [];
  if (!profile.firstName) errors.push("Borrower first name is required.");
  if (!profile.lastName) errors.push("Borrower last name is required.");
  if (!profile.llcName) errors.push("Borrower LLC name is required.");
  if (!profile.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    errors.push("Valid borrower email is required.");
  }
  if (!profile.homePhone) errors.push("Home phone is required.");
  if (!profile.workPhone) errors.push("Work phone is required.");
  if (!profile.mobilePhone) errors.push("Mobile phone is required.");
  if (!profile.dateOfBirth) errors.push("Date of birth is required.");
  if (!profile.socialSecurityNumber) errors.push("Social security number is required.");
  if (!profile.civilStatus) errors.push("Civil status is required.");
  if (!profile.presentAddress.street || !profile.presentAddress.city || !profile.presentAddress.state || !profile.presentAddress.zip) {
    errors.push("Present address is required.");
  }
  if (!profile.timeAtResidence) errors.push("Time at residence is required.");
  if (!profile.mailingSameAsPresent) {
    if (!profile.mailingAddress.street || !profile.mailingAddress.city || !profile.mailingAddress.state || !profile.mailingAddress.zip) {
      errors.push("Mailing address is required when not same as present.");
    }
  }
  if (
    !profile.noBusinessAddress &&
    (!profile.businessAddress.street || !profile.businessAddress.city || !profile.businessAddress.state || !profile.businessAddress.zip)
  ) {
    errors.push("Business address is required.");
  }
  const contacts = Array.isArray(profile.emergencyContacts) ? profile.emergencyContacts : [];
  for (let index = 0; index < 3; index += 1) {
    const contact = contacts[index] || { name: "", email: "", phone: "" };
    if (!contact.name || !contact.email || !contact.phone) {
      errors.push(`Emergency contact ${index + 1} requires name, email, and phone.`);
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      errors.push(`Emergency contact ${index + 1} requires valid email.`);
    }
  }
  return errors;
}

function isBorrowerProfileComplete(profileInput) {
  return getBorrowerProfileValidationErrors(profileInput).length === 0;
}

function normalizeBorrowerAccess(input, options = {}) {
  const source = input && typeof input === "object" ? input : {};
  const isProfileComplete = Boolean(options.isProfileComplete);
  let status = borrowerAccessStatuses.includes(source.status) ? source.status : "NOT_CREATED";
  const createdAt = typeof source.createdAt === "number" ? source.createdAt : null;
  if (status === "NOT_CREATED" && createdAt) {
    status = "ACCESS_CREATED";
  }
  if (status === "PROFILE_COMPLETED" && !isProfileComplete) {
    status = "ACCESS_CREATED";
  }
  if (status === "ACCESS_CREATED" && isProfileComplete) {
    status = "PROFILE_COMPLETED";
  }
  return {
    status,
    email:
      typeof source.email === "string" && source.email.trim()
        ? source.email.trim()
        : options.borrowerEmail || borrowerProfileDefaults.email,
    invitedAt: typeof source.invitedAt === "number" ? source.invitedAt : null,
    createdAt,
    profileCompletedAt: typeof source.profileCompletedAt === "number" ? source.profileCompletedAt : null,
  };
}

async function sendRequestInfoEmail({ borrowerEmail, borrowerName, loanId, question, subject, portalLinkOverride }) {
  const portalLink =
    typeof portalLinkOverride === "string" && portalLinkOverride.trim()
      ? portalLinkOverride.trim()
      : buildBorrowerPortalLink({ loanId, continue: 1, createAccess: 1 });
  const resolvedSubject = subject || `Action Required: Loan ${loanId} – Additional Information Requested`;
  const safeBorrowerName = escapeHtml(borrowerName || "Borrower");
  const safeQuestion = escapeHtml(question);
  const safePortalLink = escapeHtml(portalLink);
  const text = [
    `Hi ${borrowerName || "Borrower"},`,
    "",
    "Your lender requested additional information for your loan application.",
    "",
    `Question: ${question}`,
    "",
    `Please click this link to continue your application: ${portalLink}`,
  ].join("\n");
  const html = `
    <p>Hi ${safeBorrowerName},</p>
    <p>Your lender requested additional information for your loan application.</p>
    <p><strong>Question:</strong> ${safeQuestion}</p>
    <p><a href="${safePortalLink}">Please click this link to continue your application.</a></p>
  `;
  await sendBorrowerWorkflowEmail({
    email: borrowerEmail,
    name: borrowerName,
    loanId,
    subject: resolvedSubject,
    text,
    html,
  });
}

async function sendWorkflowEmail({ recipients, loanId, subject, text, html, logTargetLabel = "recipient(s)" }) {
  const normalizedRecipients = Array.isArray(recipients)
    ? recipients
        .filter((recipient) => recipient && typeof recipient.email === "string")
        .map((recipient) => ({
          email: recipient.email.trim(),
          name: typeof recipient.name === "string" && recipient.name.trim() ? recipient.name.trim() : undefined,
        }))
        .filter((recipient) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email))
    : [];
  if (normalizedRecipients.length === 0) {
    console.log(`[workflow-api] email skipped for ${loanId} (no valid recipients configured)`);
    return;
  }

  const sendgridKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  if (!sendgridKey || !fromEmail || sendgridKey.startsWith("your_")) {
    console.log(`[workflow-api] email skipped for ${loanId} (SENDGRID_API_KEY/EMAIL_FROM not configured)`);
    return;
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: normalizedRecipients }],
        from: { email: fromEmail },
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[workflow-api] sendgrid email failed for ${loanId}: ${response.status} ${errorText}`);
    } else {
      console.log(`[workflow-api] email sent for ${loanId} to ${logTargetLabel}`);
    }
  } catch (error) {
    console.warn(`[workflow-api] sendgrid request failed for ${loanId}:`, error instanceof Error ? error.message : error);
  }
}

async function sendBorrowerWorkflowEmail({ email, name, loanId, subject, text, html }) {
  await sendWorkflowEmail({
    recipients: [{ email, name }],
    loanId,
    subject,
    text,
    html,
    logTargetLabel: email,
  });
}

async function sendBorrowerSubmissionPreApprovalEmail({ borrowerEmail, borrowerName, loanId, property }) {
  const propertyLabel = typeof property === "string" && property.trim() ? property.trim() : "your property";
  const subject = `Application received: ${loanId} - Pre-approval review started`;
  const safeBorrowerName = escapeHtml(borrowerName || "Borrower");
  const safePropertyLabel = escapeHtml(propertyLabel);
  const text = [
    `Hi ${borrowerName || "Borrower"},`,
    "",
    `We received your loan application for ${propertyLabel}.`,
    "Your request is now in pre-approval review.",
    "",
    "If pre-approved, your next steps are:",
    "1) Create borrower portal access",
    "2) Complete the borrower information form",
  ].join("\n");
  const html = `
    <p>Hi ${safeBorrowerName},</p>
    <p>We received your loan application for <strong>${safePropertyLabel}</strong>.</p>
    <p>Your request is now in pre-approval review.</p>
    <p>If pre-approved, your next steps are:</p>
    <ol>
      <li>Create borrower portal access</li>
      <li>Complete the borrower information form</li>
    </ol>
  `;
  await sendBorrowerWorkflowEmail({
    email: borrowerEmail,
    name: borrowerName,
    loanId,
    subject,
    text,
    html,
  });
}

async function sendBorrowerPreApprovalAccessEmail({ borrowerEmail, borrowerName, loanId, property, portalLink }) {
  const resolvedPortalLink =
    typeof portalLink === "string" && portalLink.trim()
      ? portalLink.trim()
      : buildBorrowerPortalLink({ loanId, createAccess: 1, continue: 1 });
  const propertyLabel = typeof property === "string" && property.trim() ? property.trim() : "your property";
  const subject = `Pre-approved: ${loanId} - Create borrower portal access`;
  const safeBorrowerName = escapeHtml(borrowerName || "Borrower");
  const safePropertyLabel = escapeHtml(propertyLabel);
  const safePortalLink = escapeHtml(resolvedPortalLink);
  const text = [
    `Hi ${borrowerName || "Borrower"},`,
    "",
    `Good news. Your loan request for ${propertyLabel} is pre-approved.`,
    "",
    "Next steps:",
    "1) Complete borrower information form",
    "2) Create borrower portal login (email + password)",
    "3) Submit underwriting continuation details",
    "",
    `Create access: ${resolvedPortalLink}`,
  ].join("\n");
  const html = `
    <p>Hi ${safeBorrowerName},</p>
    <p>Good news. Your loan request for <strong>${safePropertyLabel}</strong> is pre-approved.</p>
    <p>Next steps:</p>
    <ol>
      <li>Complete borrower information form</li>
      <li>Create borrower portal login (email + password)</li>
      <li>Submit underwriting continuation details</li>
    </ol>
    <p><a href="${safePortalLink}">Create borrower access</a></p>
  `;
  await sendBorrowerWorkflowEmail({
    email: borrowerEmail,
    name: borrowerName,
    loanId,
    subject,
    text,
    html,
  });
}

async function sendBorrowerUnderwritingConditionsEmail({ borrowerEmail, borrowerName, loanId, property, portalLink }) {
  const resolvedPortalLink =
    typeof portalLink === "string" && portalLink.trim()
      ? portalLink.trim()
      : buildBorrowerPortalLink({ loanId, continue: 1, createAccess: 1 });
  const propertyLabel = typeof property === "string" && property.trim() ? property.trim() : "your property";
  const subject = `Action Required: ${loanId} - Underwriting conditions`;
  const safeBorrowerName = escapeHtml(borrowerName || "Borrower");
  const safePropertyLabel = escapeHtml(propertyLabel);
  const safePortalLink = escapeHtml(resolvedPortalLink);
  const text = [
    `Hi ${borrowerName || "Borrower"},`,
    "",
    `Your loan for ${propertyLabel} is now in underwriting.`,
    "Please provide the following to fulfill underwriting conditions:",
    "1) Credit Score",
    "2) Proof of Liquidity",
    "3) LLC Documents (EIN, Certificate of Good Standing, Operating Agreement, and Articles of Organization)",
    "4) Referral details (name, email, and phone number of the person who referred you)",
    "5) Past projects (property address and photos)",
    "6) Current mortgage loans with other lenders (number of loans and total amount)",
    "",
    `Continue in borrower portal: ${resolvedPortalLink}`,
  ].join("\n");
  const html = `
    <p>Hi ${safeBorrowerName},</p>
    <p>Your loan for <strong>${safePropertyLabel}</strong> is now in underwriting.</p>
    <p>Please provide the following to fulfill underwriting conditions:</p>
    <ol>
      <li>Credit Score</li>
      <li>Proof of Liquidity</li>
      <li>LLC Documents (EIN, Certificate of Good Standing, Operating Agreement, and Articles of Organization)</li>
      <li>Referral details (name, email, and phone number of the person who referred you)</li>
      <li>Past projects (property address and photos)</li>
      <li>Current mortgage loans with other lenders (number of loans and total amount)</li>
    </ol>
    <p><a href="${safePortalLink}">Continue in borrower portal</a></p>
  `;
  await sendBorrowerWorkflowEmail({
    email: borrowerEmail,
    name: borrowerName,
    loanId,
    subject,
    text,
    html,
  });
}

async function sendBorrowerConditionsFormRequestEmail({ borrowerEmail, borrowerName, loanId, property, portalLink }) {
  const resolvedPortalLink =
    typeof portalLink === "string" && portalLink.trim()
      ? portalLink.trim()
      : buildBorrowerConditionsLink({ loanId, fromApp: 1 });
  const propertyLabel = typeof property === "string" && property.trim() ? property.trim() : "your property";
  const subject = `Action Required: ${loanId} - Complete conditions form`;
  const safeBorrowerName = escapeHtml(borrowerName || "Borrower");
  const safePropertyLabel = escapeHtml(propertyLabel);
  const safePortalLink = escapeHtml(resolvedPortalLink);
  const text = [
    `Hi ${borrowerName || "Borrower"},`,
    "",
    `We received your underwriting form submission for ${propertyLabel}.`,
    "Please upload and complete the conditions form with the following:",
    "1) Credit Score",
    "2) Proof of Liquidity",
    "3) LLC Documents (EIN, Certificate of Good Standing, Operating Agreement, and Articles of Organization)",
    "4) Referral details (name, email, and phone number of the person who referred you)",
    "5) Past projects (property address and photos)",
    "6) Current mortgage loans with other lenders (number of loans and total amount)",
    "",
    `Open conditions form: ${resolvedPortalLink}`,
  ].join("\n");
  const html = `
    <p>Hi ${safeBorrowerName},</p>
    <p>We received your underwriting form submission for <strong>${safePropertyLabel}</strong>.</p>
    <p>Please upload and complete the conditions form with the following:</p>
    <ol>
      <li>Credit Score</li>
      <li>Proof of Liquidity</li>
      <li>LLC Documents (EIN, Certificate of Good Standing, Operating Agreement, and Articles of Organization)</li>
      <li>Referral details (name, email, and phone number of the person who referred you)</li>
      <li>Past projects (property address and photos)</li>
      <li>Current mortgage loans with other lenders (number of loans and total amount)</li>
    </ol>
    <p><a href="${safePortalLink}">Open conditions form</a></p>
  `;
  await sendBorrowerWorkflowEmail({
    email: borrowerEmail,
    name: borrowerName,
    loanId,
    subject,
    text,
    html,
  });
}

async function sendBorrowerDirectMessageEmail({ borrowerEmail, borrowerName, loanId, subject, message }) {
  const portalLink = buildBorrowerPortalLink({ loanId, continue: 1, createAccess: 1 });
  const resolvedSubject = subject || `Message from lender: Loan ${loanId}`;
  const safeBorrowerName = escapeHtml(borrowerName || "Borrower");
  const safeMessage = escapeHtml(message);
  const safePortalLink = escapeHtml(portalLink);
  const text = [
    `Hi ${borrowerName || "Borrower"},`,
    "",
    "Your lender sent you a message regarding your loan request.",
    "",
    message,
    "",
    `Reply in borrower portal: ${portalLink}`,
  ].join("\n");
  const html = `
    <p>Hi ${safeBorrowerName},</p>
    <p>Your lender sent you a message regarding your loan request.</p>
    <p style="white-space: pre-line;"><strong>Message:</strong><br/>${safeMessage}</p>
    <p><a href="${safePortalLink}">Open borrower portal to reply</a></p>
  `;
  await sendBorrowerWorkflowEmail({
    email: borrowerEmail,
    name: borrowerName,
    loanId,
    subject: resolvedSubject,
    text,
    html,
  });
}

async function sendLenderNewRequestEmail(application) {
  if (!Array.isArray(lenderNotificationRecipients) || lenderNotificationRecipients.length === 0) {
    console.log(`[workflow-api] lender notification skipped for ${application.id} (no lender recipient configured)`);
    return;
  }

  const requestedAmount = toNumber(application.amount);
  const requestedAmountLabel = typeof requestedAmount === "number" ? formatCurrencyLabel(requestedAmount) : "N/A";
  const purchase = application.purchaseDetails && typeof application.purchaseDetails === "object" ? application.purchaseDetails : null;
  const lenderDashboardLink = buildLenderPortalLink({ loanId: application.id });
  const approveLink = buildLenderEmailActionLink(application.id, "approve");
  const commentLink = buildLenderEmailActionLink(application.id, "comment");
  const messageBorrowerLink = buildLenderEmailActionLink(application.id, "message");
  const denyLink = buildLenderEmailActionLink(application.id, "deny");
  const documentGroups = buildLenderEmailDocumentGroups(application);

  const safeLoanId = escapeHtml(application.id);
  const safeBorrower = escapeHtml(application.borrowerName || "Borrower");
  const safeBorrowerEmail = escapeHtml(application.borrowerEmail || "N/A");
  const safeProperty = escapeHtml(application.property || "N/A");
  const safeType = escapeHtml(application.type || "N/A");
  const safeAmount = escapeHtml(requestedAmountLabel);
  const safeDashboardLink = escapeHtml(lenderDashboardLink);
  const safeApproveLink = escapeHtml(approveLink);
  const safeCommentLink = escapeHtml(commentLink);
  const safeMessageBorrowerLink = escapeHtml(messageBorrowerLink);
  const safeDenyLink = escapeHtml(denyLink);
  const purchasePreviewLines = purchase
    ? [
        `Purchase Price: ${purchase.purchasePrice || "N/A"}`,
        `Rehab Budget: ${purchase.rehabBudget || "N/A"}`,
        `ARV: ${purchase.arv || "N/A"}`,
        `Exit Strategy: ${purchase.exitStrategy || "N/A"}`,
        `Target Closing Date: ${purchase.targetClosingDate || "N/A"}`,
      ]
    : [];
  const documentPreviewTextLines = documentGroups.length
    ? [
        "",
        "Uploaded Documents (Preview Links):",
        ...documentGroups.flatMap((group) => {
          const lines = [`${group.label}:`];
          if (group.key === "propertyPhotos") {
            const firstPhoto = group.files.find((file) => file.viewerLink);
            if (firstPhoto) {
              lines.push(`- Preview photos: ${firstPhoto.viewerLink}`);
            } else {
              lines.push("- Preview unavailable");
            }
          } else {
            lines.push(
              ...group.files.map((file) =>
                file.viewerLink ? `- ${file.name}: ${file.viewerLink}` : `- ${file.name}: Preview unavailable`
              )
            );
          }
          if (group.hiddenFileCount > 0) {
            lines.push(`- and ${group.hiddenFileCount} more file${group.hiddenFileCount === 1 ? "" : "s"}`);
          }
          return lines;
        }),
      ]
    : [];
  const text = [
    "New loan request submitted.",
    "",
    `Loan ID: ${application.id}`,
    `Borrower: ${application.borrowerName || "Borrower"} (${application.borrowerEmail || "N/A"})`,
    `Property: ${application.property || "N/A"}`,
    `Loan Type: ${application.type || "N/A"}`,
    `Requested Amount: ${requestedAmountLabel}`,
    ...(purchasePreviewLines.length ? ["", "Quick Preview:", ...purchasePreviewLines] : []),
    ...documentPreviewTextLines,
    "",
    `Approve: ${approveLink}`,
    `Leave Comment: ${commentLink}`,
    `Message Borrower: ${messageBorrowerLink}`,
    `Deny with Notes: ${denyLink}`,
    "",
    `Open Lender Dashboard: ${lenderDashboardLink}`,
  ].join("\n");

  const purchasePreviewHtml = purchase
    ? `
      <tr><td style="padding:6px 0;color:#4b5563;">Purchase Price</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(purchase.purchasePrice || "N/A")}</td></tr>
      <tr><td style="padding:6px 0;color:#4b5563;">Rehab Budget</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(purchase.rehabBudget || "N/A")}</td></tr>
      <tr><td style="padding:6px 0;color:#4b5563;">ARV</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(purchase.arv || "N/A")}</td></tr>
      <tr><td style="padding:6px 0;color:#4b5563;">Exit Strategy</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(purchase.exitStrategy || "N/A")}</td></tr>
      <tr><td style="padding:6px 0;color:#4b5563;">Target Closing</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(purchase.targetClosingDate || "N/A")}</td></tr>
    `
    : "";
  const documentPreviewHtml = documentGroups.length
    ? `
      <div style="margin:0 0 16px;">
        <h3 style="margin:0 0 8px;">Uploaded Documents</h3>
        ${documentGroups
          .map((group) => {
            const hiddenCountNote =
              group.hiddenFileCount > 0
                ? `<p style="margin:6px 0 0;color:#64748b;font-size:12px;">and ${group.hiddenFileCount} more file${group.hiddenFileCount === 1 ? "" : "s"}</p>`
                : "";
            if (group.key === "propertyPhotos") {
              const firstPhoto = group.files.find((file) => file.viewerLink);
              const total = Math.max(Number(group.totalFiles) || 0, 0);
              const currentLink = firstPhoto
                ? firstPhoto.viewerLink
                : buildLenderDocumentViewerLink(application.id, group.key, 0);
              return `
                <div style="margin:0 0 10px;">
                  <p style="margin:0 0 6px;font-weight:600;">${escapeHtml(group.label)}</p>
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <a href="${escapeHtml(currentLink)}" style="display:inline-block;padding:6px 12px;border:1px solid #f59e0b;border-radius:999px;background:#fef3c7;color:#1d4ed8;text-decoration:underline;font-weight:700;">Preview Photos${total > 0 ? ` (${total})` : ""}</a>
                  </div>
                  ${hiddenCountNote}
                </div>
              `;
            }

            const docLinks = group.files
              .map(
                (file) => `
                  ${
                    file.viewerLink
                      ? `<a href="${escapeHtml(file.viewerLink)}" style="display:inline-block;padding:6px 12px;border:1px solid #f59e0b;border-radius:999px;background:#fef3c7;color:#1d4ed8;text-decoration:underline;font-weight:700;">${escapeHtml(file.name)}</a>`
                      : `<span style="display:inline-block;padding:6px 12px;border:1px solid #cbd5e1;border-radius:999px;background:#f8fafc;color:#64748b;">${escapeHtml(file.name)}</span>`
                  }
                `
              )
              .join("");
            return `
              <div style="margin:0 0 10px;">
                <p style="margin:0 0 6px;font-weight:600;">${escapeHtml(group.label)}</p>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">${docLinks}</div>
                ${hiddenCountNote}
              </div>
            `;
          })
          .join("")}
      </div>
    `
    : "";
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.45;">
      <h2 style="margin:0 0 12px;">New Loan Request Submitted</h2>
      <p style="margin:0 0 16px;">A new request is ready for lender review.</p>
      <table style="border-collapse:collapse;width:100%;max-width:640px;margin-bottom:18px;">
        <tr><td style="padding:6px 0;color:#4b5563;">Loan ID</td><td style="padding:6px 0;font-weight:600;">${safeLoanId}</td></tr>
        <tr><td style="padding:6px 0;color:#4b5563;">Borrower</td><td style="padding:6px 0;font-weight:600;">${safeBorrower}</td></tr>
        <tr><td style="padding:6px 0;color:#4b5563;">Borrower Email</td><td style="padding:6px 0;font-weight:600;">${safeBorrowerEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#4b5563;">Property</td><td style="padding:6px 0;font-weight:600;">${safeProperty}</td></tr>
        <tr><td style="padding:6px 0;color:#4b5563;">Loan Type</td><td style="padding:6px 0;font-weight:600;">${safeType}</td></tr>
        <tr><td style="padding:6px 0;color:#4b5563;">Requested Amount</td><td style="padding:6px 0;font-weight:600;">${safeAmount}</td></tr>
        ${purchasePreviewHtml}
      </table>
      ${documentPreviewHtml}
      <div style="margin-bottom:14px;">
        <a href="${safeApproveLink}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;margin-right:8px;margin-bottom:8px;">Approve</a>
        <a href="${safeCommentLink}" style="display:inline-block;background:#1f2937;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;margin-right:8px;margin-bottom:8px;">Leave Comment</a>
        <a href="${safeMessageBorrowerLink}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;margin-right:8px;margin-bottom:8px;">Message Borrower</a>
        <a href="${safeDenyLink}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;margin-right:8px;margin-bottom:8px;">Deny with Notes</a>
      </div>
      <p style="margin:0;"><a href="${safeDashboardLink}">Open lender dashboard</a></p>
    </div>
  `;

  await sendWorkflowEmail({
    recipients: lenderNotificationRecipients,
    loanId: application.id,
    subject: `New loan request: ${application.id} - ${application.property || "Property"}`,
    text,
    html,
    logTargetLabel: lenderNotificationRecipients.map((recipient) => recipient.email).join(", "),
  });
}

const seedApplications = [
  {
    id: "LA-2024-1247",
    borrowerName: "Michael Chen",
    property: "789 Maple Dr",
    type: "Purchase",
    amount: 450000,
    currentStageIndex: 3,
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    lastEventAt: Date.now() - 2 * 60 * 60 * 1000,
    history: ["APPLICATION_SUBMITTED", "DOCUMENTS_VERIFIED", "PROCESSING_COMPLETED"],
    preApprovalDecision: "PENDING",
    decisionNotes: null,
    purchaseDetails: {
      purchasePrice: "385000",
      rehabBudget: "60000",
      arv: "575000",
      compsValidationNote: "Borrower provided COMPS.",
      compsFiles: ["comp-1.pdf"],
      propertyPhotos: ["front.jpg", "kitchen.jpg"],
      purchaseContractFiles: ["purchase-contract.pdf"],
      scopeOfWorkFiles: ["itemized-rehab-scope.pdf"],
      exitStrategy: "Fix and Flip",
      targetClosingDate: "2026-03-31",
    },
  },
  {
    id: "LA-2024-1501",
    borrowerName: "Michael Chen",
    property: "123 Main St",
    type: "Purchase",
    amount: 450000,
    currentStageIndex: 5,
    createdAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
    lastEventAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    history: [
      "APPLICATION_SUBMITTED",
      "DOCUMENTS_VERIFIED",
      "PROCESSING_COMPLETED",
      "UNDERWRITING_APPROVED",
      "FUNDING_COMPLETED",
    ],
    preApprovalDecision: "PRE_APPROVE",
    decisionNotes: null,
    purchaseDetails: null,
  },
  {
    id: "LA-2024-1502",
    borrowerName: "Michael Chen",
    property: "456 Oak Ave",
    type: "Refinance",
    amount: 285000,
    currentStageIndex: 5,
    createdAt: Date.now() - 48 * 24 * 60 * 60 * 1000,
    lastEventAt: Date.now() - 9 * 24 * 60 * 60 * 1000,
    history: [
      "APPLICATION_SUBMITTED",
      "DOCUMENTS_VERIFIED",
      "PROCESSING_COMPLETED",
      "UNDERWRITING_APPROVED",
      "FUNDING_COMPLETED",
    ],
    preApprovalDecision: "PRE_APPROVE",
    decisionNotes: null,
    purchaseDetails: null,
  },
];

app.use(express.json({ limit: workflowApiBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: workflowApiBodyLimit }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});
app.use("/uploads", express.static(uploadsDir));
app.use("/api/insurance", insuranceRouter);

app.get("/api/rentometer/summary", async (req, res) => {
  if (!rentometerApiKey) {
    return res.status(500).json({ error: "Rentometer API key is not configured." });
  }
  const ip = getClientIp(req);
  if (isRateLimited(ip, rentometerRateLimit, RENTOMETER_RATE_LIMIT_MAX, RENTOMETER_RATE_LIMIT_WINDOW_MS)) {
    return res.status(429).json({ error: "Rate limit exceeded. Please wait before retrying." });
  }

  let address;
  let bedrooms;
  let baths;
  let buildingType;
  let lookBack;
  try {
    address = normalizeRentometerAddress(req.query.address);
    bedrooms = convertBedroomsForRentometer(req.query.bedrooms);
    baths = convertBathsForRentometer(req.query.baths ?? req.query.bathrooms);
    buildingType =
      typeof req.query.building_type === "string" || typeof req.query.buildingType === "string"
        ? (req.query.building_type || req.query.buildingType || "").trim().toLowerCase()
        : "";
    if (!["", "apartment", "house"].includes(buildingType)) buildingType = "";
    lookBack = clampLookBackDays(req.query.look_back_days);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Invalid input" });
  }

  const cacheKey = [
    address.toUpperCase(),
    bedrooms,
    baths || "",
    buildingType,
    lookBack,
  ].join("|");
  const now = Date.now();
  const cached = rentometerCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return res.json(cached.payload);
  }

  try {
    const params = new URLSearchParams();
    params.set("api_key", rentometerApiKey);
    params.set("address", address);
    params.set("bedrooms", String(bedrooms));
    params.set("look_back_days", String(lookBack));
    if (baths) params.set("baths", baths);
    if (buildingType) params.set("building_type", buildingType);

    const url = `https://www.rentometer.com/api/v1/summary?${params.toString()}`;
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const text = await response.text();
    if (!response.ok) {
      return res.status(502).json({ error: `Rentometer request failed (${response.status})` });
    }
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return res.status(502).json({ error: "Rentometer returned invalid JSON." });
    }
    const mean = Number(data?.mean);
    if (!Number.isFinite(mean)) {
      return res.status(502).json({ error: "Rentometer response missing mean." });
    }
    const samples = Number(data?.samples);
    const payload = {
      average_rent: mean,
      median_rent: Number.isFinite(Number(data?.median)) ? Number(data.median) : null,
      p25: Number.isFinite(Number(data?.percentile_25)) ? Number(data.percentile_25) : null,
      p75: Number.isFinite(Number(data?.percentile_75)) ? Number(data.percentile_75) : null,
      samples: Number.isFinite(samples) ? samples : null,
      quickview_url: typeof data?.quickview_url === "string" ? data.quickview_url : null,
      warning: Number.isFinite(samples) && samples < 5 ? "Low sample size" : null,
    };
    rentometerCache.set(cacheKey, { payload, expiresAt: now + RENTOMETER_CACHE_TTL_MS });
    return res.json(payload);
  } catch (error) {
    return res.status(502).json({ error: "Rentometer lookup failed." });
  }
});

const toNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getStatus = (stageIndex) => {
  if (stageIndex >= stages.length - 1) return "Approved";
  if (stageIndex === 3) return "In-underwriting";
  if (stageIndex >= 4) return "Under Review";
  return "In Progress";
};

const getApplicationStatus = (application) => {
  const stageStatus = getStatus(application.currentStageIndex);
  if (stageStatus === "Approved") return stageStatus;
  const intake = normalizeUnderwritingIntake(application.underwritingIntake);
  if (intake.status === "SUBMITTED") return "UW for Review";
  if (intake.status === "PENDING") return "In-underwriting";
  return stageStatus;
};

const getNextEvent = (currentStageIndex) => {
  if (currentStageIndex <= 1) return "DOCUMENTS_VERIFIED";
  if (currentStageIndex === 2) return "PROCESSING_COMPLETED";
  if (currentStageIndex === 3) return "UNDERWRITING_APPROVED";
  if (currentStageIndex === 4) return "FUNDING_COMPLETED";
  return null;
};

const withComputed = (application, applications = []) => {
  const comparisonSet = applications.length ? applications : [application];
  const normalizedIntake = normalizeUnderwritingIntake(application.underwritingIntake);
  const liveContinuation =
    normalizedIntake.formData && typeof normalizedIntake.formData === "object" ? normalizedIntake.formData : null;
  const normalizedConditionsForm =
    application.conditionsForm && typeof application.conditionsForm === "object"
      ? normalizeBorrowerConditionsForm(application.conditionsForm)
      : null;
  const computedConditionsForm =
    normalizedConditionsForm && hasBorrowerConditionsContent(normalizedConditionsForm)
      ? normalizedConditionsForm
      : buildBorrowerConditionsPrefill(application, comparisonSet);

  return {
    ...application,
    conditionsForm: computedConditionsForm,
    underwritingIntake: normalizedIntake,
    underwritingSummary: buildUnderwritingSummary(application, liveContinuation),
    underwritingPrefill: buildUnderwritingPrefill(application, comparisonSet),
    communications: application.communications || [],
    unreadBorrowerMessageCount: (application.communications || []).filter(
      (entry) => entry.from === "LENDER" && !entry.readByBorrower
    ).length,
    progress: Math.round(((application.currentStageIndex + 1) / stages.length) * 100),
    status: getApplicationStatus(application),
    currentStage: stages[application.currentStageIndex],
    nextEvent: getNextEvent(application.currentStageIndex),
    stages,
  };
};

const ensureUploadArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .filter((item) => typeof item.name === "string" && item.name.trim())
    .map((item) => ({
      name: item.name,
      contentType: typeof item.contentType === "string" ? item.contentType : "application/octet-stream",
      dataUrl: typeof item.dataUrl === "string" ? item.dataUrl : "",
    }))
    .filter((item) => item.dataUrl.startsWith("data:"));
};

function normalizeUnderwritingIntake(input) {
  const source = input && typeof input === "object" ? input : {};
  const status = source.status === "PENDING" || source.status === "SUBMITTED" ? source.status : "LOCKED";
  const submissionHistory = Array.isArray(source.submissionHistory)
    ? source.submissionHistory
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({
          submittedAt: typeof entry.submittedAt === "number" ? entry.submittedAt : null,
          formData: entry.formData && typeof entry.formData === "object" ? entry.formData : null,
        }))
        .filter((entry) => entry.formData)
    : [];
  return {
    status,
    requestedAt: typeof source.requestedAt === "number" ? source.requestedAt : null,
    submittedAt: typeof source.submittedAt === "number" ? source.submittedAt : null,
    notificationSentAt: typeof source.notificationSentAt === "number" ? source.notificationSentAt : null,
    formData: source.formData && typeof source.formData === "object" ? source.formData : null,
    submissionHistory,
  };
}

function normalizeUnderwritingSummary(input) {
  if (!input || typeof input !== "object") return null;
  return {
    generatedAt: typeof input.generatedAt === "number" ? input.generatedAt : Date.now(),
    loanRequest: input.loanRequest && typeof input.loanRequest === "object" ? input.loanRequest : {},
    continuation: input.continuation && typeof input.continuation === "object" ? input.continuation : {},
    conditions: input.conditions && typeof input.conditions === "object" ? input.conditions : {},
    aiAssessment: input.aiAssessment && typeof input.aiAssessment === "object" ? input.aiAssessment : {},
    combinedNarrative: typeof input.combinedNarrative === "string" ? input.combinedNarrative : "",
  };
}

function normalizeLlcDocs(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((doc) => doc && typeof doc === "object")
    .map((doc, index) => {
      const name = typeof doc.name === "string" && doc.name.trim() ? doc.name.trim() : `llc-doc-${index + 1}.pdf`;
      const docType =
        typeof doc.docType === "string" && requiredLlcDocTypes.includes(doc.docType) ? doc.docType : "OTHER";
      return {
        name,
        contentType: typeof doc.contentType === "string" ? doc.contentType : "application/octet-stream",
        dataUrl: typeof doc.dataUrl === "string" ? doc.dataUrl : "",
        docType,
      };
    });
}

function normalizePastProjects(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((project) => project && typeof project === "object")
    .map((project, index) => ({
      propertyName:
        typeof project.propertyName === "string" && project.propertyName.trim()
          ? project.propertyName.trim()
          : `Project ${index + 1}`,
      photoLabel:
        typeof project.photoLabel === "string" && project.photoLabel.trim()
          ? project.photoLabel.trim()
          : `project-${index + 1}.jpg`,
      photo: project.photo && typeof project.photo === "object" ? ensureUploadArray([project.photo])[0] || null : null,
    }));
}

function normalizeConditionsPastProjects(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((project) => project && typeof project === "object")
    .map((project) => ({
      propertyAddress: typeof project.propertyAddress === "string" ? project.propertyAddress.trim() : "",
      photos: ensureUploadArray(project.photos),
    }));
}

function normalizeConditionsProofOfLiquidityDocs(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((doc) => doc && typeof doc === "object")
    .map((doc, index) => {
      const normalized = {
        name:
          typeof doc.name === "string" && doc.name.trim()
            ? doc.name.trim()
            : `proof-of-liquidity-${index + 1}.pdf`,
        contentType: typeof doc.contentType === "string" ? doc.contentType : "application/octet-stream",
        dataUrl: typeof doc.dataUrl === "string" ? doc.dataUrl : "",
      };
      const category = typeof doc.category === "string" ? doc.category.trim() : "";
      const subcategory = typeof doc.subcategory === "string" ? doc.subcategory.trim() : "";
      return {
        ...normalized,
        category: getConditionsLiquidityCategory(category) ? category : "",
        subcategory: isValidConditionsLiquiditySubcategory(category, subcategory) ? subcategory : "",
      };
    })
    .filter((doc) => doc.dataUrl.startsWith("data:"));
}

function normalizeBorrowerConditionsForm(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const parsedCreditScore = Number(source.creditScore);
  const creditScore = Number.isFinite(parsedCreditScore) && parsedCreditScore > 0 ? Math.round(parsedCreditScore) : null;
  const parsedOtherMortgageLoansCount = Number(source.otherMortgageLoansCount);
  const otherMortgageLoansCount =
    Number.isFinite(parsedOtherMortgageLoansCount) && parsedOtherMortgageLoansCount >= 0
      ? Math.floor(parsedOtherMortgageLoansCount)
      : null;
  return {
    creditScore,
    proofOfLiquidityAmount:
      typeof source.proofOfLiquidityAmount === "string" ? source.proofOfLiquidityAmount.trim() : "",
    proofOfLiquidityDocs: normalizeConditionsProofOfLiquidityDocs(source.proofOfLiquidityDocs),
    desktopAppraisalValue:
      typeof source.desktopAppraisalValue === "string" ? source.desktopAppraisalValue.trim() : "",
    desktopAppraisalDocs: ensureUploadArray(source.desktopAppraisalDocs),
    llcDocs: normalizeLlcDocs(source.llcDocs),
    referral:
      source.referral && typeof source.referral === "object"
        ? {
            name: typeof source.referral.name === "string" ? source.referral.name.trim() : "",
            email: typeof source.referral.email === "string" ? source.referral.email.trim() : "",
            phone: typeof source.referral.phone === "string" ? source.referral.phone.trim() : "",
          }
        : { name: "", email: "", phone: "" },
    pastProjects: normalizeConditionsPastProjects(source.pastProjects),
    otherMortgageLoansCount,
    otherMortgageTotalAmount:
      typeof source.otherMortgageTotalAmount === "string" ? source.otherMortgageTotalAmount.trim() : "",
    submittedAt: typeof source.submittedAt === "number" ? source.submittedAt : null,
    updatedAt: typeof source.updatedAt === "number" ? source.updatedAt : null,
    documentPackage: normalizeConditionsDocumentPackage(source.documentPackage),
    reuseMeta:
      source.reuseMeta && typeof source.reuseMeta === "object"
        ? {
            sourceLoanId:
              typeof source.reuseMeta.sourceLoanId === "string" ? source.reuseMeta.sourceLoanId : "",
            sourceUpdatedAt:
              Number.isFinite(Number(source.reuseMeta.sourceUpdatedAt)) ? Number(source.reuseMeta.sourceUpdatedAt) : null,
            within30Days: Boolean(source.reuseMeta.within30Days),
          }
        : null,
  };
}

function hasBorrowerConditionsContent(form) {
  if (!form || typeof form !== "object") return false;
  const referral = form.referral && typeof form.referral === "object" ? form.referral : {};
  const pastProjects = Array.isArray(form.pastProjects) ? form.pastProjects : [];
  const hasPastProjects = pastProjects.some((project) => {
    if (!project || typeof project !== "object") return false;
    const hasAddress = typeof project.propertyAddress === "string" && project.propertyAddress.trim();
    const hasPhotos = Array.isArray(project.photos) && project.photos.length > 0;
    return Boolean(hasAddress || hasPhotos);
  });
  return Boolean(
    Number.isFinite(Number(form.creditScore)) ||
      (typeof form.proofOfLiquidityAmount === "string" && form.proofOfLiquidityAmount.trim()) ||
      (Array.isArray(form.proofOfLiquidityDocs) && form.proofOfLiquidityDocs.length > 0) ||
      (Array.isArray(form.llcDocs) && form.llcDocs.length > 0) ||
      referral.name ||
      referral.email ||
      referral.phone ||
      hasPastProjects ||
      Number.isFinite(Number(form.otherMortgageLoansCount)) ||
      (typeof form.otherMortgageTotalAmount === "string" && form.otherMortgageTotalAmount.trim()) ||
      (typeof form.desktopAppraisalValue === "string" && form.desktopAppraisalValue.trim()) ||
      (Array.isArray(form.desktopAppraisalDocs) && form.desktopAppraisalDocs.length > 0) ||
      Number.isFinite(Number(form.submittedAt)) ||
      Number.isFinite(Number(form.updatedAt)) ||
      (form.documentPackage && Array.isArray(form.documentPackage.files) && form.documentPackage.files.length > 0)
  );
}

function getBorrowerConditionsReferenceTime(application, form) {
  if (Number.isFinite(Number(form?.updatedAt))) return Number(form.updatedAt);
  if (Number.isFinite(Number(form?.submittedAt))) return Number(form.submittedAt);
  if (Number.isFinite(Number(application?.lastEventAt))) return Number(application.lastEventAt);
  if (Number.isFinite(Number(application?.createdAt))) return Number(application.createdAt);
  return null;
}

function getLatestBorrowerConditionsSource(application, applications) {
  const borrowerEmail = normalizeBorrowerEmail(application?.borrowerEmail);
  if (!borrowerEmail) return null;
  const candidates = applications
    .filter((item) => item?.id !== application?.id)
    .filter((item) => normalizeBorrowerEmail(item?.borrowerEmail) === borrowerEmail)
    .map((item) => {
      const form = normalizeBorrowerConditionsForm(item?.conditionsForm);
      return {
        application: item,
        form,
        referenceTime: getBorrowerConditionsReferenceTime(item, form) || 0,
      };
    })
    .filter((item) => hasBorrowerConditionsContent(item.form))
    .sort((a, b) => b.referenceTime - a.referenceTime);

  return candidates[0] || null;
}

function buildBorrowerConditionsPrefill(application, applications) {
  const source = getLatestBorrowerConditionsSource(application, applications);
  if (!source) return null;

  const referenceTime = Number(source.referenceTime);
  const within30Days = Number.isFinite(referenceTime) && Date.now() - referenceTime <= THIRTY_DAYS_MS;
  const sourceForm = source.form;
  const normalized = normalizeBorrowerConditionsForm({
    creditScore: within30Days ? sourceForm.creditScore : null,
    proofOfLiquidityAmount: within30Days ? sourceForm.proofOfLiquidityAmount : "",
    proofOfLiquidityDocs: within30Days ? sourceForm.proofOfLiquidityDocs : [],
    llcDocs: sourceForm.llcDocs,
    referral: sourceForm.referral,
    pastProjects: sourceForm.pastProjects,
    otherMortgageLoansCount: within30Days ? sourceForm.otherMortgageLoansCount : null,
    otherMortgageTotalAmount: within30Days ? sourceForm.otherMortgageTotalAmount : "",
    submittedAt: null,
    updatedAt: null,
    documentPackage: null,
    reuseMeta: {
      sourceLoanId: source.application.id,
      sourceUpdatedAt: Number.isFinite(referenceTime) ? referenceTime : null,
      within30Days,
    },
  });

  return hasBorrowerConditionsContent(normalized) ? normalized : null;
}

function validateBorrowerConditionsSubmission(submission) {
  const errors = [];
  if (!Number.isFinite(Number(submission.creditScore)) || Number(submission.creditScore) <= 0) {
    errors.push("Credit score is required.");
  }
  const liquidityAmount = toNumber(submission.proofOfLiquidityAmount);
  if (!Number.isFinite(Number(liquidityAmount)) || Number(liquidityAmount) <= 0) {
    errors.push("Proof of liquidity amount is required.");
  }
  const liquidityDocs = Array.isArray(submission.proofOfLiquidityDocs) ? submission.proofOfLiquidityDocs : [];
  if (liquidityDocs.length === 0) {
    errors.push("Upload at least one proof of liquidity document.");
  } else {
    for (const [index, doc] of liquidityDocs.entries()) {
      const category = typeof doc?.category === "string" ? doc.category : "";
      const subcategory = typeof doc?.subcategory === "string" ? doc.subcategory : "";
      if (!getConditionsLiquidityCategory(category)) {
        errors.push(`Select a valid proof of liquidity category for document ${index + 1}.`);
        continue;
      }
      if (!isValidConditionsLiquiditySubcategory(category, subcategory)) {
        errors.push(`Select a valid proof of liquidity subcategory for document ${index + 1}.`);
      }
    }
  }
  const llcDocs = Array.isArray(submission.llcDocs) ? submission.llcDocs : [];
  const submittedLlcDocTypes = new Set(
    llcDocs
      .map((doc) => (typeof doc?.docType === "string" ? doc.docType : ""))
      .filter((docType) => requiredLlcDocTypes.includes(docType))
  );
  for (const requiredDocType of requiredLlcDocTypes) {
    if (!submittedLlcDocTypes.has(requiredDocType)) {
      errors.push(`Upload LLC document: ${getLlcDocLabel(requiredDocType)}.`);
    }
  }
  const referral = submission.referral && typeof submission.referral === "object" ? submission.referral : {};
  if (!referral.name || !referral.email || !referral.phone) {
    errors.push("Referral name, email, and phone are required.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referral.email)) {
    errors.push("Referral email must be valid.");
  }
  if (!Array.isArray(submission.pastProjects) || submission.pastProjects.length === 0) {
    errors.push("At least one past project is required.");
  } else {
    for (const [index, project] of submission.pastProjects.entries()) {
      if (!project.propertyAddress) {
        errors.push(`Past project ${index + 1} property address is required.`);
      }
      if (!Array.isArray(project.photos) || project.photos.length === 0) {
        errors.push(`Past project ${index + 1} requires at least one photo.`);
      }
    }
  }
  if (
    !Number.isFinite(Number(submission.otherMortgageLoansCount)) ||
    Number(submission.otherMortgageLoansCount) < 0
  ) {
    errors.push("Current mortgage loans count with other lenders is required.");
  }
  const otherMortgageTotalAmount = toNumber(submission.otherMortgageTotalAmount);
  if (!Number.isFinite(Number(otherMortgageTotalAmount)) || Number(otherMortgageTotalAmount) < 0) {
    errors.push("Current mortgage loans total amount with other lenders is required.");
  }
  return errors;
}

function normalizeUnderwritingSubmission(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const rawCredit = Number(source.creditScore);
  const creditScore = Number.isFinite(rawCredit) && rawCredit > 0 ? Math.round(rawCredit) : null;
  const otherMortgageLenders = Array.isArray(source.otherMortgageLenders)
    ? source.otherMortgageLenders
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const newMortgageLenders = Array.isArray(source.newMortgageLenders)
    ? source.newMortgageLenders
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const activeLoans = Array.isArray(source.activeLoans)
    ? source.activeLoans
        .filter((loan) => loan && typeof loan === "object" && typeof loan.loanId === "string" && loan.loanId.trim())
        .map((loan) => ({
          loanId: loan.loanId.trim(),
          status: typeof loan.status === "string" ? loan.status.trim() : "",
          expectedCompletionDate:
            typeof loan.expectedCompletionDate === "string" ? loan.expectedCompletionDate.trim() : "",
          payoffDate: typeof loan.payoffDate === "string" ? loan.payoffDate.trim() : "",
          monthlyPayment:
            Number.isFinite(Number(loan.monthlyPayment)) && Number(loan.monthlyPayment) > 0
              ? Number(loan.monthlyPayment)
              : null,
          notes: typeof loan.notes === "string" ? loan.notes.trim() : "",
        }))
    : [];

  return {
    bed: typeof source.bed === "string" ? source.bed.trim() : "",
    bath: typeof source.bath === "string" ? source.bath.trim() : "",
    closingCompany: typeof source.closingCompany === "string" ? source.closingCompany.trim() : "",
    closingAgentName: typeof source.closingAgentName === "string" ? source.closingAgentName.trim() : "",
    closingAgentEmail: typeof source.closingAgentEmail === "string" ? source.closingAgentEmail.trim() : "",
    useCreditScoreOnFile: Boolean(source.useCreditScoreOnFile),
    creditScore,
    useLiquidityOnFile: Boolean(source.useLiquidityOnFile),
    proofOfLiquidityAmount:
      typeof source.proofOfLiquidityAmount === "string" ? source.proofOfLiquidityAmount.trim() : "",
    llcName: typeof source.llcName === "string" ? source.llcName.trim() : "",
    llcStateRecorded: typeof source.llcStateRecorded === "string" ? source.llcStateRecorded.trim() : "",
    llcSameAsOnFile: Boolean(source.llcSameAsOnFile),
    useLlcDocsOnFile: Boolean(source.useLlcDocsOnFile),
    llcDocs: normalizeLlcDocs(source.llcDocs),
    newLlcInfoCompleted: Boolean(source.newLlcInfoCompleted),
    useExistingMortgageLoans: Boolean(source.useExistingMortgageLoans),
    otherMortgageLoansCount: Number.isFinite(Number(source.otherMortgageLoansCount))
      ? Number(source.otherMortgageLoansCount)
      : null,
    otherMortgageLenders,
    otherMortgageTotalMonthlyInterest:
      Number.isFinite(Number(source.otherMortgageTotalMonthlyInterest)) &&
      Number(source.otherMortgageTotalMonthlyInterest) >= 0
        ? Number(source.otherMortgageTotalMonthlyInterest)
        : null,
    hasNewMortgageLoans: Boolean(source.hasNewMortgageLoans),
    newMortgageLenders,
    activeLoans,
    useProfileReferral: Boolean(source.useProfileReferral),
    referral:
      source.referral && typeof source.referral === "object"
        ? {
            name: typeof source.referral.name === "string" ? source.referral.name.trim() : "",
            phone: typeof source.referral.phone === "string" ? source.referral.phone.trim() : "",
            email: typeof source.referral.email === "string" ? source.referral.email.trim() : "",
          }
        : { name: "", phone: "", email: "" },
    useProfileProjects: Boolean(source.useProfileProjects),
    pastProjects: normalizePastProjects(source.pastProjects),
    borrowerProfile: normalizeBorrowerProfile(source.borrowerProfile, {
      fallbackEmail: source.borrowerEmail || borrowerProfileDefaults.email,
      fallbackLlcName:
        typeof source.llcName === "string" && source.llcName.trim() ? source.llcName.trim() : borrowerProfileDefaults.llcName,
      fallbackName:
        typeof source.borrowerName === "string" && source.borrowerName.trim()
          ? source.borrowerName.trim()
          : `${borrowerProfileDefaults.firstName} ${borrowerProfileDefaults.lastName}`,
    }),
  };
}

function getLatestPriorApplication(application, applications) {
  const applicationEmail = normalizeBorrowerEmail(application?.borrowerEmail);
  if (!applicationEmail) return undefined;
  return applications
    .filter((item) => item.id !== application.id)
    .filter((item) => normalizeBorrowerEmail(item?.borrowerEmail) === applicationEmail)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

function buildLlcOptionsOnFile(application, applications) {
  const borrowerEmail = normalizeBorrowerEmail(application?.borrowerEmail);
  const relatedApplications = borrowerEmail
    ? applications.filter((item) => normalizeBorrowerEmail(item?.borrowerEmail) === borrowerEmail)
    : [];
  const optionMap = new Map();

  const addLlcOption = (name, stateRecorded = "") => {
    const normalizedName = typeof name === "string" ? name.trim() : "";
    if (!normalizedName) return;
    const normalizedState = typeof stateRecorded === "string" ? stateRecorded.trim() : "";
    const key = normalizeComparableName(normalizedName);
    if (!key) return;

    const existing = optionMap.get(key);
    if (!existing) {
      optionMap.set(key, { name: normalizedName, stateRecorded: normalizedState });
      return;
    }
    if (!existing.stateRecorded && normalizedState) {
      optionMap.set(key, { ...existing, stateRecorded: normalizedState });
    }
  };

  const addFromIntakeForm = (formData) => {
    if (!formData || typeof formData !== "object") return;
    addLlcOption(formData.llcName, formData.llcStateRecorded);
  };

  for (const item of relatedApplications) {
    addLlcOption(item?.llcName || item?.borrowerProfile?.llcName, item?.llcStateRecorded || "");
    const intake = normalizeUnderwritingIntake(item?.underwritingIntake);
    addFromIntakeForm(intake.formData);
    if (Array.isArray(intake.submissionHistory)) {
      for (const entry of intake.submissionHistory) {
        addFromIntakeForm(entry?.formData);
      }
    }
  }

  if (optionMap.size === 0) {
    addLlcOption(application?.borrowerProfile?.llcName, "");
  }
  if (optionMap.size === 0) {
    addLlcOption(borrowerProfileDefaults.llcName, "");
  }

  return Array.from(optionMap.values());
}

function buildUnderwritingPrefill(application, applications) {
  const prior = getLatestPriorApplication(application, applications);
  const now = Date.now();
  const priorWithin30Days = prior && now - prior.createdAt <= THIRTY_DAYS_MS;
  const priorForm = prior?.underwritingIntake?.formData || null;
  const isNewBorrower = !prior;
  const borrowerEmailKey = normalizeBorrowerEmail(application?.borrowerEmail);

  const priorActiveLoanMap = new Map(
    Array.isArray(priorForm?.activeLoans)
      ? priorForm.activeLoans
          .filter((loan) => loan && typeof loan === "object" && typeof loan.loanId === "string")
          .map((loan) => [loan.loanId, loan])
      : []
  );

  const activeLoansWithUs = borrowerEmailKey
    ? applications
        .filter((item) => normalizeBorrowerEmail(item?.borrowerEmail) === borrowerEmailKey)
        .filter((item) => item.id !== application.id && item.currentStageIndex >= 4)
        .map((item) => {
          const priorLoan = priorActiveLoanMap.get(item.id);
          const activeLoanAmount =
            Number.isFinite(Number(item.amount)) && Number(item.amount) > 0 ? Number(item.amount) : null;
          const estimatedMonthlyInterestPayment =
            typeof activeLoanAmount === "number"
              ? Math.round(activeLoanAmount * (underwritingDecisionRules.assumedAnnualInterestRate / 12) * 100) / 100
              : null;
          const monthlyPayment =
            Number.isFinite(Number(priorLoan?.monthlyPayment)) && Number(priorLoan.monthlyPayment) > 0
              ? Number(priorLoan.monthlyPayment)
              : estimatedMonthlyInterestPayment;
          return {
            loanId: item.id,
            property: item.property,
            amount: activeLoanAmount,
            status: typeof priorLoan?.status === "string" ? priorLoan.status : "",
            expectedCompletionDate:
              typeof priorLoan?.expectedCompletionDate === "string" ? priorLoan.expectedCompletionDate : "",
            payoffDate: typeof priorLoan?.payoffDate === "string" ? priorLoan.payoffDate : "",
            monthlyPayment,
            notes: typeof priorLoan?.notes === "string" ? priorLoan.notes : "",
          };
        })
    : [];

  const profileProjects =
    Array.isArray(priorForm?.pastProjects) && priorForm.pastProjects.length > 0
      ? normalizePastProjects(priorForm.pastProjects)
      : normalizePastProjects(borrowerProfileDefaults.pastProjects);

  const creditScoreOnFile = Number.isFinite(Number(priorForm?.creditScore))
    ? Number(priorForm.creditScore)
    : borrowerProfileDefaults.creditScore;
  const liquidityOnFile =
    typeof priorForm?.proofOfLiquidityAmount === "string" && priorForm.proofOfLiquidityAmount.trim()
      ? priorForm.proofOfLiquidityAmount.trim()
      : borrowerProfileDefaults.liquidityAmount;
  const llcDocsOnFile =
    priorForm?.llcDocs?.length > 0 ? normalizeLlcDocs(priorForm.llcDocs) : normalizeLlcDocs(borrowerProfileDefaults.llcDocs);
  const llcOptionsOnFile = buildLlcOptionsOnFile(application, applications);
  const preferredLlcNameOnFile =
    (typeof priorForm?.llcName === "string" && priorForm.llcName.trim()) ||
    (typeof application?.borrowerProfile?.llcName === "string" && application.borrowerProfile.llcName.trim()) ||
    borrowerProfileDefaults.llcName;
  const selectedLlcOptionOnFile =
    llcOptionsOnFile.find((option) => namesLikelyMatch(option.name, preferredLlcNameOnFile)) || llcOptionsOnFile[0] || null;
  const profileSourceForLiquidity =
    (priorForm?.borrowerProfile && typeof priorForm.borrowerProfile === "object" ? priorForm.borrowerProfile : null) ||
    (prior?.borrowerProfile && typeof prior.borrowerProfile === "object" ? prior.borrowerProfile : null) ||
    application.borrowerProfile;
  const baseIdentitySource = normalizeBorrowerProfile(profileSourceForLiquidity, {
    fallbackEmail: application.borrowerEmail || borrowerProfileDefaults.email,
    fallbackLlcName: selectedLlcOptionOnFile?.name || borrowerProfileDefaults.llcName,
    fallbackName: application.borrowerName || "",
  });
  const liquidityProofDocsWithFallbackFreshness = (baseIdentitySource.liquidityProofDocs || []).map((doc) => {
    const uploadedAt = Number(doc?.uploadedAt);
    if (Number.isFinite(uploadedAt)) return doc;
    if (!priorWithin30Days || !Number.isFinite(Number(prior?.createdAt))) return doc;
    return { ...doc, uploadedAt: Number(prior.createdAt) };
  });
  const identitySource = {
    ...baseIdentitySource,
    liquidityProofDocs: liquidityProofDocsWithFallbackFreshness,
  };
  const latestLiquidityProofUploadedAt = getLatestLiquidityProofUploadedAt(identitySource.liquidityProofDocs);
  const hasFreshLiquidityProofDocs = hasRequiredLiquidityProofDocs(identitySource, {
    requireFresh: true,
    referenceTime: now,
  });
  const freshLiquidityOwnershipErrors = validateLiquidityProofOwnershipRules(identitySource, {
    requireFresh: true,
    referenceTime: now,
  });
  const canReuseLiquidity = hasFreshLiquidityProofDocs && freshLiquidityOwnershipErrors.length === 0;
  const existingMortgageLendersOnFile =
    priorForm?.otherMortgageLenders?.length > 0 ? priorForm.otherMortgageLenders : borrowerProfileDefaults.mortgageLenders;
  const otherMortgageTotalMonthlyInterestOnFile =
    Number.isFinite(Number(priorForm?.otherMortgageTotalMonthlyInterest)) &&
    Number(priorForm.otherMortgageTotalMonthlyInterest) > 0
      ? Number(priorForm.otherMortgageTotalMonthlyInterest)
      : null;
  const canReuseMortgageLoans =
    Boolean(priorWithin30Days) &&
    Array.isArray(existingMortgageLendersOnFile) &&
    existingMortgageLendersOnFile.length > 0 &&
    Number.isFinite(Number(otherMortgageTotalMonthlyInterestOnFile)) &&
    Number(otherMortgageTotalMonthlyInterestOnFile) > 0;

  return {
    isNewBorrower,
    canReuseCreditScore: Boolean(priorWithin30Days),
    creditScoreOnFile,
    creditScoreOnFileDate: prior?.createdAt || null,
    canReuseLiquidity,
    liquidityOnFile,
    liquidityOnFileDate: latestLiquidityProofUploadedAt,
    canReuseMortgageLoans,
    mortgageLoansOnFileDate: prior?.createdAt || null,
    llcNameOnFile: selectedLlcOptionOnFile?.name || borrowerProfileDefaults.llcName,
    llcOptionsOnFile,
    hasLlcDocsOnFile: llcDocsOnFile.length > 0,
    llcDocsOnFile,
    existingMortgageLenders: existingMortgageLendersOnFile,
    otherMortgageTotalMonthlyInterestOnFile,
    referralOnFile: priorForm?.referral?.name ? priorForm.referral : borrowerProfileDefaults.referral,
    pastProjectsOnFile: profileProjects,
    activeLoansWithUs,
    borrowerLiquidityProofDocsOnFile: identitySource.liquidityProofDocs,
    borrowerGuarantorsOnFile: identitySource.guarantors,
    borrowerGuarantorContactsOnFile: identitySource.guarantorContacts,
    borrowerIdentityOnFile: {
      firstName: identitySource.firstName,
      middleName: identitySource.middleName,
      lastName: identitySource.lastName,
      llcName: identitySource.llcName,
      email: identitySource.email,
    },
  };
}

function buildUnderwritingChecklistMessage(loanId, property) {
  const propertyLabel = typeof property === "string" && property.trim() ? property.trim() : "Subject Property";
  return [
    `Your loan ${loanId} - ${propertyLabel} is now in underwriting.`,
    "Please provide the following to fulfill underwriting conditions:",
    "1) Credit Score",
    "2) Proof of Liquidity",
    "3) LLC Documents",
    "4) Referral details (name, email, and phone number of the person who referred you)",
    "5) Past projects (property address and photos)",
    "6) Current mortgage loans with other lenders (number of loans and total amount)",
  ].join("\n");
}

function validateUnderwritingSubmission(submission, prefill) {
  const errors = [];
  if (!submission.bed) errors.push("Bed is required.");
  if (!submission.bath) errors.push("Bath is required.");
  if (!submission.closingCompany) errors.push("Closing Company is required.");
  if (!submission.closingAgentName) errors.push("Name of Closing Agent is required.");
  if (!submission.closingAgentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.closingAgentEmail)) {
    errors.push("Valid closing agent email is required.");
  }
  const profile = submission.borrowerProfile || normalizeBorrowerProfile(null);

  if (!submission.llcName) errors.push("LLC name is required.");
  if (!submission.llcSameAsOnFile && !submission.llcStateRecorded) {
    errors.push("State where the LLC is recorded is required for a new LLC.");
  }
  if (submission.llcSameAsOnFile && Array.isArray(prefill.llcOptionsOnFile) && prefill.llcOptionsOnFile.length > 0) {
    const hasMatchingOnFileLlc = prefill.llcOptionsOnFile.some((option) => namesLikelyMatch(option.name, submission.llcName));
    if (!hasMatchingOnFileLlc) {
      errors.push("Select an LLC on file or choose New LLC.");
    }
  }

  for (const loan of prefill.activeLoansWithUs) {
    const matching = submission.activeLoans.find((item) => item.loanId === loan.loanId);
    if (!matching || !matching.status) {
      errors.push(`Active loan status is required for ${loan.loanId}.`);
      continue;
    }
    if (!Number.isFinite(Number(matching.monthlyPayment)) || Number(matching.monthlyPayment) <= 0) {
      errors.push(`Monthly payment is required for ${loan.loanId}.`);
      continue;
    }
    const statusLower = matching.status.toLowerCase();
    if ((statusLower.includes("rehab") || statusLower.includes("construction")) && !matching.expectedCompletionDate) {
      errors.push(`Target completion date is required for ${loan.loanId}.`);
    }
    if (statusLower.includes("refinanc") && !matching.payoffDate) {
      errors.push(`Estimated closing date is required for ${loan.loanId}.`);
    }
  }

  if (prefill.isNewBorrower) {
    errors.push(...getBorrowerProfileValidationErrors(profile));
  }

  return errors;
}

function normalizeValuationInputValue(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalizeEvaluatorInputValue(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function extractValuationInputValues(source) {
  const input = source && typeof source === "object" ? source : {};
  return valuationInputFields.reduce((accumulator, field) => {
    accumulator[field.key] = normalizeValuationInputValue(input[field.key]);
    return accumulator;
  }, {});
}

function normalizeEvaluatorInputValues(source) {
  const input = source && typeof source === "object" ? source : {};
  return evaluatorInputFields.reduce((accumulator, field) => {
    accumulator[field.key] = normalizeEvaluatorInputValue(input[field.key]);
    return accumulator;
  }, {});
}

function extractValuationInputPatch(source) {
  const input = source && typeof source === "object" ? source : {};
  return valuationInputFields.reduce((accumulator, field) => {
    if (!Object.prototype.hasOwnProperty.call(input, field.key)) return accumulator;
    accumulator[field.key] = normalizeValuationInputValue(input[field.key]);
    return accumulator;
  }, {});
}

function extractEvaluatorInputPatch(source) {
  const input = source && typeof source === "object" ? source : {};
  return evaluatorInputFields.reduce((accumulator, field) => {
    if (!Object.prototype.hasOwnProperty.call(input, field.key)) return accumulator;
    accumulator[field.key] = normalizeEvaluatorInputValue(input[field.key]);
    return accumulator;
  }, {});
}

const defaultTitleAgentForm = {
  sellerType: "INDIVIDUAL",
  sellerName: "",
  sellerLlcName: "",
  sellerMembers: [],
  hasAssignor: false,
  assignorType: "INDIVIDUAL",
  assignorName: "",
  assignorLlcName: "",
  assignorMembers: [],
  assignmentFees: "",
  purchaseAgreements: [],
  assignmentAgreements: [],
  updatedAt: null,
};

function normalizeTitleAgentForm(form) {
  const source = form && typeof form === "object" ? form : {};
  return {
    sellerType: source.sellerType === "LLC" ? "LLC" : "INDIVIDUAL",
    sellerName: typeof source.sellerName === "string" ? source.sellerName.trim() : "",
    sellerLlcName: typeof source.sellerLlcName === "string" ? source.sellerLlcName.trim() : "",
    sellerMembers: Array.isArray(source.sellerMembers)
      ? source.sellerMembers.map((name) => (typeof name === "string" ? name.trim() : "")).filter(Boolean)
      : [],
    hasAssignor: Boolean(source.hasAssignor),
    assignorType: source.assignorType === "LLC" ? "LLC" : "INDIVIDUAL",
    assignorName: typeof source.assignorName === "string" ? source.assignorName.trim() : "",
    assignorLlcName: typeof source.assignorLlcName === "string" ? source.assignorLlcName.trim() : "",
    assignorMembers: Array.isArray(source.assignorMembers)
      ? source.assignorMembers.map((name) => (typeof name === "string" ? name.trim() : "")).filter(Boolean)
      : [],
    assignmentFees: typeof source.assignmentFees === "string" ? source.assignmentFees.trim() : "",
    purchaseAgreements: ensureUploadArray(source.purchaseAgreements),
    assignmentAgreements: ensureUploadArray(source.assignmentAgreements),
    updatedAt:
      Number.isFinite(Number(source.updatedAt)) && Number(source.updatedAt) > 0 ? Number(source.updatedAt) : Date.now(),
  };
}

function getValuationInputMissingLabels(values) {
  return valuationInputFields
    .filter((field) => !field.optional && !normalizeValuationInputValue(values[field.key]))
    .map((field) => field.label);
}

function getEvaluatorInputMissingLabels(values) {
  return evaluatorInputFields
    .filter((field) => !normalizeEvaluatorInputValue(values[field.key]))
    .map((field) => field.label);
}

function normalizeValuationInputTrail(trail) {
  if (!Array.isArray(trail)) return [];
  return trail
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => {
      const updatedAt = Number(entry.updatedAt);
      const values = extractValuationInputValues(entry.values);
      const updatedBy = typeof entry.updatedBy === "string" ? entry.updatedBy.trim() : "";
      return {
        id:
          typeof entry.id === "string" && entry.id.trim()
            ? entry.id.trim()
            : `valuation-input-${updatedAt || Date.now()}-${index + 1}`,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
        updatedBy: valuationInputRoles.has(updatedBy) ? updatedBy : "LOAN_OFFICER",
        values,
      };
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

const normalizePurchaseDetails = (details) => {
  const source = details && typeof details === "object" ? details : {};
  return {
    purchasePrice: typeof source.purchasePrice === "string" ? source.purchasePrice.trim() : "",
    rehabBudget: typeof source.rehabBudget === "string" ? source.rehabBudget.trim() : "",
    arv: typeof source.arv === "string" ? source.arv.trim() : "",
    currentOwner: typeof source.currentOwner === "string" ? source.currentOwner.trim() : "",
    lastSaleDate: typeof source.lastSaleDate === "string" ? source.lastSaleDate.trim() : "",
    lastSalePrice: typeof source.lastSalePrice === "string" ? source.lastSalePrice.trim() : "",
    assessorValue: typeof source.assessorValue === "string" ? source.assessorValue.trim() : "",
    attomAvmValue: typeof source.attomAvmValue === "string" ? source.attomAvmValue.trim() : "",
    zillowValue: typeof source.zillowValue === "string" ? source.zillowValue.trim() : "",
    realtorComValue: typeof source.realtorComValue === "string" ? source.realtorComValue.trim() : "",
    narprValue: typeof source.narprValue === "string" ? source.narprValue.trim() : "",
    propelioMedianValue:
      typeof source.propelioMedianValue === "string" ? source.propelioMedianValue.trim() : "",
    propelioHighValue: typeof source.propelioHighValue === "string" ? source.propelioHighValue.trim() : "",
    propelioLowValue: typeof source.propelioLowValue === "string" ? source.propelioLowValue.trim() : "",
    economicValue: typeof source.economicValue === "string" ? source.economicValue.trim() : "",
    rentometerEstimate:
      typeof source.rentometerEstimate === "string" ? source.rentometerEstimate.trim() : "",
    zillowRentEstimate:
      typeof source.zillowRentEstimate === "string" ? source.zillowRentEstimate.trim() : "",
    compsValidationNote:
      typeof source.compsValidationNote === "string" ? source.compsValidationNote.trim() : "Borrower provided COMPS.",
    compsFiles: ensureUploadArray(source.compsFiles),
    propertyPhotos: ensureUploadArray(source.propertyPhotos),
    purchaseContractFiles: ensureUploadArray(source.purchaseContractFiles),
    scopeOfWorkFiles: ensureUploadArray(source.scopeOfWorkFiles),
    exitStrategy: typeof source.exitStrategy === "string" ? source.exitStrategy.trim() : "",
    targetClosingDate: typeof source.targetClosingDate === "string" ? source.targetClosingDate.trim() : "",
  };
};

const getMissingPurchaseItems = (details) => {
  const missing = [];
  if (!details.purchasePrice) missing.push("purchase price");
  if (!details.rehabBudget) missing.push("rehab budget");
  if (!details.arv) missing.push("ARV");
  if (!details.exitStrategy) missing.push("exit strategy");
  if (!details.targetClosingDate) missing.push("target closing date");
  if (!details.compsFiles.length) missing.push("comps");
  if (!details.propertyPhotos.length) missing.push("property photos");
  if (!details.purchaseContractFiles.length) missing.push("purchase contract");
  if (!details.scopeOfWorkFiles.length) missing.push("itemized rehab scope");
  return missing;
};

const buildAiAssessment = (application) => {
  const acceptableArvLtvMax = 0.75;
  const details = application.purchaseDetails;
  const purchasePrice = toNumber(details?.purchasePrice);
  const rehabBudget = toNumber(details?.rehabBudget);
  const arv = toNumber(details?.arv);
  const amount = toNumber(application.amount) || 0;

  const costBasis = purchasePrice && rehabBudget ? purchasePrice + rehabBudget : null;
  const ltc = costBasis ? amount / costBasis : null;
  const arvLtv = arv ? amount / arv : null;
  const docsScore = details
    ? (details.compsFiles?.length >= 1 ? 25 : 0) +
      (details.propertyPhotos?.length ? 25 : 0) +
      (details.purchaseContractFiles?.length ? 25 : 0) +
      (details.scopeOfWorkFiles?.length ? 25 : 0)
    : 60;

  const ltvAcceptable = arvLtv !== null && arvLtv <= acceptableArvLtvMax;
  const completeApplication = Boolean(
    details &&
      typeof details.purchasePrice === "string" &&
      details.purchasePrice.trim() &&
      typeof details.rehabBudget === "string" &&
      details.rehabBudget.trim() &&
      typeof details.arv === "string" &&
      details.arv.trim() &&
      typeof details.exitStrategy === "string" &&
      details.exitStrategy.trim() &&
      typeof details.targetClosingDate === "string" &&
      details.targetClosingDate.trim() &&
      Array.isArray(details.compsFiles) &&
      details.compsFiles.length > 0 &&
      Array.isArray(details.propertyPhotos) &&
      details.propertyPhotos.length > 0 &&
      Array.isArray(details.purchaseContractFiles) &&
      details.purchaseContractFiles.length > 0 &&
      Array.isArray(details.scopeOfWorkFiles) &&
      details.scopeOfWorkFiles.length > 0
  );

  const ltvPoints = ltvAcceptable ? 50 : 0;
  const completenessPoints = completeApplication ? 50 : 0;
  const confidence = ltvPoints + completenessPoints;
  const reasons = [
    arvLtv === null
      ? "LTV: N/A"
      : `LTV: ${(arvLtv * 100).toFixed(1)}% (${ltvAcceptable ? "Pass" : "Fail"})`,
    `Application: ${completeApplication ? "Complete" : "Incomplete"}`,
    `Score: ${confidence}/100`,
  ];

  let recommendation = "REVIEW";
  if (confidence === 100) {
    recommendation = "PRE_APPROVE";
  } else if (!ltvAcceptable) {
    recommendation = "DECLINE";
  }

  return {
    recommendation,
    confidence,
    reasons,
    metrics: {
      ltc,
      arvLtv,
      docsScore,
    },
  };
};

const resolveBorrowerSnapshot = (application, continuationInput) => {
  const continuation = continuationInput && typeof continuationInput === "object" ? continuationInput : null;
  const continuationBorrowerProfile =
    continuation?.borrowerProfile && typeof continuation.borrowerProfile === "object"
      ? continuation.borrowerProfile
      : null;
  const fallbackLlcName =
    (typeof continuation?.llcName === "string" && continuation.llcName.trim()) ||
    application?.borrowerProfile?.llcName ||
    borrowerProfileDefaults.llcName;
  const profile = normalizeBorrowerProfile(continuationBorrowerProfile || application.borrowerProfile, {
    fallbackEmail: application.borrowerEmail || borrowerProfileDefaults.email,
    fallbackLlcName,
    fallbackName: application.borrowerName || "",
  });
  const fullName = getBorrowerFullName(profile) || application.borrowerName || "Borrower";
  const email =
    (typeof profile.email === "string" && profile.email.trim()) ||
    application.borrowerEmail ||
    borrowerProfileDefaults.email;
  const entityName =
    (typeof continuation?.llcName === "string" && continuation.llcName.trim()) ||
    profile.llcName ||
    borrowerProfileDefaults.llcName;
  return { profile, fullName, email, entityName };
};

const buildUnderwritingSummary = (application, continuationInput) => {
  const continuation = continuationInput && typeof continuationInput === "object" ? continuationInput : {};
  const borrowerSnapshot = resolveBorrowerSnapshot(application, continuation);
  const conditions = normalizeBorrowerConditionsForm(application.conditionsForm);
  const aiAssessment = buildAiAssessment(application);
  const titleAgentForm = normalizeTitleAgentForm(application.titleAgentForm || defaultTitleAgentForm);
  const purchase = application.purchaseDetails || null;
  const activeLoans = Array.isArray(continuation.activeLoans) ? continuation.activeLoans : [];
  const otherLenders = Array.isArray(continuation.otherMortgageLenders) ? continuation.otherMortgageLenders : [];
  const continuationOtherMortgageTotalMonthlyInterest =
    Number.isFinite(Number(continuation.otherMortgageTotalMonthlyInterest)) &&
    Number(continuation.otherMortgageTotalMonthlyInterest) >= 0
      ? Number(continuation.otherMortgageTotalMonthlyInterest)
      : null;
  const conditionsOtherMortgageTotalAmount =
    Number.isFinite(Number(conditions?.otherMortgageTotalAmount)) &&
    Number(conditions.otherMortgageTotalAmount) >= 0
      ? Number(conditions.otherMortgageTotalAmount)
      : null;
  const otherMortgageTotalMonthlyInterest =
    continuationOtherMortgageTotalMonthlyInterest ?? conditionsOtherMortgageTotalAmount;
  const continuationReferral = continuation.referral && typeof continuation.referral === "object" ? continuation.referral : {};
  const conditionsReferral = conditions?.referral && typeof conditions.referral === "object" ? conditions.referral : {};
  const referral = {
    name: continuationReferral.name || conditionsReferral.name || "",
    phone: continuationReferral.phone || conditionsReferral.phone || "",
    email: continuationReferral.email || conditionsReferral.email || "",
  };
  const continuationCreditScore =
    Number.isFinite(Number(continuation?.creditScore)) && Number(continuation.creditScore) > 0
      ? Number(continuation.creditScore)
      : null;
  const conditionsCreditScore =
    Number.isFinite(Number(conditions?.creditScore)) && Number(conditions.creditScore) > 0
      ? Number(conditions.creditScore)
      : null;
  const mergedCreditScore = continuationCreditScore ?? conditionsCreditScore;
  const continuationLiquidityAmount =
    typeof continuation?.proofOfLiquidityAmount === "string" && continuation.proofOfLiquidityAmount.trim()
      ? continuation.proofOfLiquidityAmount.trim()
      : "";
  const conditionsLiquidityAmount =
    typeof conditions?.proofOfLiquidityAmount === "string" && conditions.proofOfLiquidityAmount.trim()
      ? conditions.proofOfLiquidityAmount.trim()
      : "";
  const mergedLiquidityAmount = continuationLiquidityAmount || conditionsLiquidityAmount;
  const continuationOtherMortgageLoanCount = Number.isFinite(Number(continuation?.otherMortgageLoansCount))
    ? Number(continuation.otherMortgageLoansCount)
    : null;
  const conditionsOtherMortgageLoanCount = Number.isFinite(Number(conditions?.otherMortgageLoansCount))
    ? Number(conditions.otherMortgageLoansCount)
    : null;
  const conditionsDesktopAppraisalValue =
    typeof conditions?.desktopAppraisalValue === "string" && conditions.desktopAppraisalValue.trim()
      ? conditions.desktopAppraisalValue.trim()
      : "";
  const conditionsDesktopAppraisalDocs = Array.isArray(conditions?.desktopAppraisalDocs)
    ? conditions.desktopAppraisalDocs
    : [];
  const mergedOtherMortgageLoansCount = continuationOtherMortgageLoanCount ?? conditionsOtherMortgageLoanCount ?? 0;
  const continuationPastProjectsCount = Array.isArray(continuation?.pastProjects) ? continuation.pastProjects.length : 0;
  const conditionsPastProjectsCount = Array.isArray(conditions?.pastProjects) ? conditions.pastProjects.length : 0;
  const mergedPastProjectsCount = continuationPastProjectsCount > 0 ? continuationPastProjectsCount : conditionsPastProjectsCount;
  const conditionsProofOfLiquidityDocsCount = Array.isArray(conditions?.proofOfLiquidityDocs)
    ? conditions.proofOfLiquidityDocs.length
    : 0;
  const conditionsLlcDocsCount = Array.isArray(conditions?.llcDocs) ? conditions.llcDocs.length : 0;
  const conditionsSubmittedAt =
    Number.isFinite(Number(conditions?.updatedAt)) && Number(conditions.updatedAt) > 0
      ? Number(conditions.updatedAt)
      : Number.isFinite(Number(conditions?.submittedAt)) && Number(conditions.submittedAt) > 0
        ? Number(conditions.submittedAt)
        : null;
  const hasConditionsSubmission = hasBorrowerConditionsContent(conditions);
  const mergedConditions = {
    submitted: hasConditionsSubmission,
    latestSubmittedAt: conditionsSubmittedAt,
    creditScore: conditionsCreditScore,
    proofOfLiquidityAmount: conditionsLiquidityAmount,
    proofOfLiquidityDocsCount: conditionsProofOfLiquidityDocsCount,
    llcDocsCount: conditionsLlcDocsCount,
    desktopAppraisalValue: conditionsDesktopAppraisalValue,
    desktopAppraisalDocsCount: conditionsDesktopAppraisalDocs.length,
    referral,
    pastProjectsCount: conditionsPastProjectsCount,
    otherMortgageLoansCount: conditionsOtherMortgageLoanCount,
    otherMortgageTotalAmount: conditionsOtherMortgageTotalAmount,
  };

  const combinedNarrative = [
    `Loan ${application.id} (${application.property}) submitted for ${application.type} at ${application.amount}.`,
    purchase
      ? `Loan request details: Purchase Price ${purchase.purchasePrice || "N/A"}, Rehab Budget ${purchase.rehabBudget || "N/A"}, ARV ${purchase.arv || "N/A"}, Exit Strategy ${purchase.exitStrategy || "N/A"}, Target Closing ${purchase.targetClosingDate || "N/A"}.`
      : "Loan request details: No purchase-specific details on file.",
    `Underwriting continuation details: Bed ${continuation.bed || "N/A"}, Bath ${continuation.bath || "N/A"}, Closing Company ${continuation.closingCompany || "N/A"}, Closing Agent ${continuation.closingAgentName || "N/A"} (${continuation.closingAgentEmail || "N/A"}), Credit Score ${continuationCreditScore || "N/A"}, Liquidity ${continuationLiquidityAmount || "N/A"}, LLC ${continuation.llcName || "N/A"}.`,
    `Conditions details: Submitted ${hasConditionsSubmission ? "Yes" : "No"}, Credit Score ${conditionsCreditScore || "N/A"}, Liquidity ${conditionsLiquidityAmount || "N/A"}, Liquidity Docs ${conditionsProofOfLiquidityDocsCount}, LLC Docs ${conditionsLlcDocsCount}, Referral ${referral.name || "N/A"}, Past Projects ${conditionsPastProjectsCount}, Other Mortgage Loans ${conditionsOtherMortgageLoanCount ?? "N/A"} (Total ${conditionsOtherMortgageTotalAmount !== null ? formatCurrencyLabel(conditionsOtherMortgageTotalAmount) : "N/A"}).`,
    `Other mortgage lenders: ${otherLenders.length ? otherLenders.join(", ") : "None provided"} (Monthly interest total: ${otherMortgageTotalMonthlyInterest !== null ? formatCurrencyLabel(otherMortgageTotalMonthlyInterest) : "N/A"}). Active loans updated: ${activeLoans.length}. Referral: ${referral.name || "N/A"}.`,
    `AI assessment: Recommendation ${aiAssessment.recommendation}, Confidence ${aiAssessment.confidence}%, Reasons: ${(aiAssessment.reasons || []).join("; ")}.`,
  ].join(" ");

  return {
    generatedAt: Date.now(),
    loanRequest: {
      loanId: application.id,
      borrower: borrowerSnapshot.fullName,
      borrowerEmail: borrowerSnapshot.email,
      property: application.property,
      type: application.type,
      requestedAmount: application.amount,
      purchaseDetails: purchase,
    },
    titleAgentForm,
    continuation: {
      bed: continuation.bed || "",
      bath: continuation.bath || "",
      closingCompany: continuation.closingCompany || "",
      closingAgentName: continuation.closingAgentName || "",
      closingAgentEmail: continuation.closingAgentEmail || "",
      creditScore: mergedCreditScore,
      proofOfLiquidityAmount: mergedLiquidityAmount,
      llcName: continuation.llcName || "",
      otherMortgageLoansCount: mergedOtherMortgageLoansCount,
      otherMortgageLenders: otherLenders,
      otherMortgageTotalMonthlyInterest,
      activeLoans,
      referral,
      pastProjectsCount: mergedPastProjectsCount,
    },
    conditions: mergedConditions,
    aiAssessment,
    combinedNarrative,
  };
};

const underwritingDecisionRuleDefaults = {
  maxLtv: 0.75,
  maxLtc: 0.9,
  minCreditScore: 680,
  minLiquidityToLoanRatio: 0.1,
  acceptableLiquidityRatio: 2,
  excellentLiquidityRatio: 4,
  maxOtherMortgageLoans: 5,
  liquidityMonths: 6,
  assumedAnnualInterestRate: 0.12,
  prepaidInterestAnnualRate: 0.13,
  perDiemDayCountBasis: 360,
  originationFeePercent: 5,
  monthlyServiceFee: 950,
  documentPreparationFee: 250,
  closingCostEstimate: 6000,
  estimatedOtherLenderMonthlyPaymentFactor: 0.75,
  estimatedOtherLenderLoanFactor: 0.75,
  shortClosingTimelineDays: 14,
  declineCreditScore: 620,
  declineLtv: 0.82,
};

let underwritingDecisionRules = { ...underwritingDecisionRuleDefaults };

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizePercentRatioSetting = (value, fallback, options = {}) => {
  const { min = 0, max = 1 } = options;
  const parsed = toFiniteNumber(value);
  if (parsed === null) return fallback;
  let ratio = parsed;
  if (ratio > 1 && ratio <= 100) ratio /= 100;
  if (!Number.isFinite(ratio)) return fallback;
  return Math.min(max, Math.max(min, ratio));
};

const normalizeNumberSetting = (value, fallback, options = {}) => {
  const { min = 0, max = Number.POSITIVE_INFINITY } = options;
  const parsed = toFiniteNumber(value);
  if (parsed === null) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const normalizeIntegerSetting = (value, fallback, options = {}) => {
  const normalized = normalizeNumberSetting(value, fallback, options);
  return Math.round(normalized);
};

function normalizeUnderwritingDecisionRules(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  return {
    maxLtv: normalizePercentRatioSetting(source.maxLtv, underwritingDecisionRuleDefaults.maxLtv),
    maxLtc: normalizePercentRatioSetting(source.maxLtc, underwritingDecisionRuleDefaults.maxLtc),
    minCreditScore: normalizeIntegerSetting(source.minCreditScore, underwritingDecisionRuleDefaults.minCreditScore, {
      min: 300,
      max: 900,
    }),
    minLiquidityToLoanRatio: normalizeNumberSetting(
      source.minLiquidityToLoanRatio,
      underwritingDecisionRuleDefaults.minLiquidityToLoanRatio,
      { min: 0 }
    ),
    acceptableLiquidityRatio: normalizeNumberSetting(
      source.acceptableLiquidityRatio,
      underwritingDecisionRuleDefaults.acceptableLiquidityRatio,
      { min: 0.1 }
    ),
    excellentLiquidityRatio: normalizeNumberSetting(
      source.excellentLiquidityRatio,
      underwritingDecisionRuleDefaults.excellentLiquidityRatio,
      { min: 0.1 }
    ),
    maxOtherMortgageLoans: normalizeIntegerSetting(
      source.maxOtherMortgageLoans,
      underwritingDecisionRuleDefaults.maxOtherMortgageLoans,
      { min: 0 }
    ),
    liquidityMonths: normalizeIntegerSetting(source.liquidityMonths, underwritingDecisionRuleDefaults.liquidityMonths, {
      min: 1,
    }),
    assumedAnnualInterestRate: normalizePercentRatioSetting(
      source.assumedAnnualInterestRate,
      underwritingDecisionRuleDefaults.assumedAnnualInterestRate
    ),
    prepaidInterestAnnualRate: normalizePercentRatioSetting(
      source.prepaidInterestAnnualRate,
      underwritingDecisionRuleDefaults.prepaidInterestAnnualRate
    ),
    perDiemDayCountBasis: normalizeIntegerSetting(
      source.perDiemDayCountBasis,
      underwritingDecisionRuleDefaults.perDiemDayCountBasis,
      { min: 1 }
    ),
    originationFeePercent: normalizeNumberSetting(
      source.originationFeePercent,
      underwritingDecisionRuleDefaults.originationFeePercent,
      { min: 0 }
    ),
    monthlyServiceFee: normalizeNumberSetting(source.monthlyServiceFee, underwritingDecisionRuleDefaults.monthlyServiceFee, {
      min: 0,
    }),
    documentPreparationFee: normalizeNumberSetting(
      source.documentPreparationFee,
      underwritingDecisionRuleDefaults.documentPreparationFee,
      { min: 0 }
    ),
    closingCostEstimate: normalizeNumberSetting(
      source.closingCostEstimate,
      underwritingDecisionRuleDefaults.closingCostEstimate,
      { min: 0 }
    ),
    estimatedOtherLenderMonthlyPaymentFactor: normalizePercentRatioSetting(
      source.estimatedOtherLenderMonthlyPaymentFactor,
      underwritingDecisionRuleDefaults.estimatedOtherLenderMonthlyPaymentFactor
    ),
    estimatedOtherLenderLoanFactor: normalizePercentRatioSetting(
      source.estimatedOtherLenderLoanFactor,
      underwritingDecisionRuleDefaults.estimatedOtherLenderLoanFactor
    ),
    shortClosingTimelineDays: normalizeIntegerSetting(
      source.shortClosingTimelineDays,
      underwritingDecisionRuleDefaults.shortClosingTimelineDays,
      { min: 0 }
    ),
    declineCreditScore: normalizeIntegerSetting(source.declineCreditScore, underwritingDecisionRuleDefaults.declineCreditScore, {
      min: 300,
      max: 900,
    }),
    declineLtv: normalizePercentRatioSetting(source.declineLtv, underwritingDecisionRuleDefaults.declineLtv),
  };
}

const isUsableDocumentUrl = (value) =>
  typeof value === "string" && (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/"));

const normalizeDocumentLink = (value, options = {}) => {
  const {
    prefix = "document",
    index = 0,
    label = "Document",
    source = "internal",
    required = false,
    idSuffix = "",
  } = options;
  if (typeof value === "string") {
    return {
      id: `${prefix}-${index + 1}${idSuffix ? `-${idSuffix}` : ""}`,
      label,
      name: value || `${prefix}-${index + 1}`,
      url: null,
      source,
      required,
    };
  }

  if (!value || typeof value !== "object") return null;
  const name = typeof value.name === "string" && value.name.trim() ? value.name.trim() : `${prefix}-${index + 1}`;
  const url = isUsableDocumentUrl(value.dataUrl) ? value.dataUrl : null;
  return {
    id: `${prefix}-${index + 1}${idSuffix ? `-${idSuffix}` : ""}`,
    label,
    name,
    url,
    source,
    required,
  };
};

const normalizeDocumentGroup = (items, options = {}) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => normalizeDocumentLink(item, { ...options, index }))
    .filter(Boolean);
};

const normalizeLenderViewerDocumentGroup = (items, options = {}) => {
  const { groupKey = "", loanId = "" } = options;
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const normalizedLink = normalizeDocumentLink(item, { ...options, index });
      if (!normalizedLink) return null;
      if (!groupKey || !loanId) return normalizedLink;
      const previewable = normalizeUploadedDocumentForPreview(item, {
        fallbackName: normalizedLink.name || `${groupKey}-${index + 1}`,
      });
      if (previewable && previewable.dataUrl) {
        return {
          ...normalizedLink,
          url: buildLenderDocumentViewerLink(loanId, groupKey, index),
        };
      }
      return normalizedLink;
    })
    .filter(Boolean);
};

const parseYearsFromValue = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatPercentLabel = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
};

const formatCurrencyLabel = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
};

const calculateDaysUntil = (dateValue) => {
  if (typeof dateValue !== "string" || !dateValue.trim()) return null;
  const parsed = Date.parse(dateValue);
  if (!Number.isFinite(parsed)) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.ceil((parsed - Date.now()) / dayMs);
};

const parseIsoDateToUtcTimestamp = (dateValue) => {
  if (typeof dateValue !== "string" || !dateValue.trim()) return null;
  const match = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    if (
      Number.isInteger(year) &&
      Number.isInteger(monthIndex) &&
      Number.isInteger(day) &&
      monthIndex >= 0 &&
      monthIndex <= 11 &&
      day >= 1 &&
      day <= 31
    ) {
      return Date.UTC(year, monthIndex, day);
    }
  }
  const parsed = Date.parse(dateValue);
  if (!Number.isFinite(parsed)) return null;
  const date = new Date(parsed);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const calculateDaysToFirstDayOfFollowingMonth = (dateValue) => {
  const utcTimestamp = parseIsoDateToUtcTimestamp(dateValue);
  if (utcTimestamp === null) return null;
  const date = new Date(utcTimestamp);
  const firstDayOfFollowingMonthUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((firstDayOfFollowingMonthUtc - utcTimestamp) / dayMs));
};

const resolveExecutiveStatus = (application) => {
  if (application.preApprovalDecision === "DECLINE") return "Declined";
  if (application.currentStageIndex >= stages.length - 2 && application.preApprovalDecision === "PRE_APPROVE") return "Approved";
  const intake = normalizeUnderwritingIntake(application.underwritingIntake);
  if (intake.status === "SUBMITTED" || intake.status === "PENDING" || application.currentStageIndex >= 3) return "In Review";
  return "Draft";
};

const resolveProductLabel = (application) => {
  const exit = (application.purchaseDetails?.exitStrategy || "").toLowerCase();
  if (exit.includes("flip")) return "Fix & Flip";
  if (application.type === "Refinance" || application.type === "Cash-Out Refinance") return "DSCR";
  return "Bridge";
};

const toSafeNumber = (value) => {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildQuickDecision = ({ creditScore, ltv, flags, liquidityCoverage }) => {
  const issueFlags = flags.filter((flag) => flag.state === "issue");
  const pendingFlags = flags.filter((flag) => flag.state === "pending");
  const highRiskCount = flags.filter((flag) => flag.severity === "high").length;

  let recommendation = "Approve";
  if (
    (typeof creditScore === "number" && creditScore < underwritingDecisionRules.declineCreditScore) ||
    (typeof ltv === "number" && ltv > underwritingDecisionRules.declineLtv) ||
    highRiskCount >= 2
  ) {
    recommendation = "Decline";
  } else if (issueFlags.length > 0 || pendingFlags.length > 0) {
    recommendation = "Conditional";
  }

  const reasons = [];
  if (typeof creditScore === "number") {
    reasons.push(
      creditScore >= underwritingDecisionRules.minCreditScore
        ? `Credit score ${creditScore} meets minimum threshold`
        : `Credit score ${creditScore} is below preferred threshold`
    );
  } else {
    reasons.push("Credit score is missing");
  }

  if (typeof ltv === "number") {
    reasons.push(
      ltv <= underwritingDecisionRules.maxLtv
        ? `LTV ${formatPercentLabel(ltv)} is within policy limit`
        : `LTV ${formatPercentLabel(ltv)} exceeds policy limit`
    );
  } else {
    reasons.push("LTV cannot be computed from current inputs");
  }

  if (liquidityCoverage && typeof liquidityCoverage.isEnough === "boolean") {
    if (liquidityCoverage.isEnough) {
      reasons.push(
        `Liquidity covers modeled exposure (${formatPercentLabel(liquidityCoverage.coverageRatio)} coverage ratio)`
      );
    } else {
      reasons.push(
        `Liquidity shortfall of ${formatCurrencyLabel(Math.abs(liquidityCoverage.remainingLiquidity || 0))} vs modeled exposure`
      );
    }
  } else {
    reasons.push("Liquidity coverage could not be modeled from current data");
  }

  if (issueFlags.length > 0) {
    reasons.push(`${issueFlags.length} issue flag${issueFlags.length === 1 ? "" : "s"} require review`);
  } else if (pendingFlags.length > 0) {
    reasons.push(`${pendingFlags.length} pending item${pendingFlags.length === 1 ? "" : "s"} remain open`);
  } else {
    reasons.push("No blocking issues detected in borrower-provided data");
  }

  const conditions = [
    ...new Set(
      flags
        .filter((flag) => flag.state === "issue" || flag.state === "pending")
        .map((flag) => flag.label)
    ),
  ];

  return {
    recommendation,
    reasons: reasons.slice(0, 3),
    conditions,
  };
};

const sanitizeContinuationPayload = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const form = payload;
  return {
    bed: form.bed || "",
    bath: form.bath || "",
    closingCompany: form.closingCompany || "",
    closingAgentName: form.closingAgentName || "",
    closingAgentEmail: form.closingAgentEmail || "",
    useCreditScoreOnFile: Boolean(form.useCreditScoreOnFile),
    creditScore: Number.isFinite(Number(form.creditScore)) ? Number(form.creditScore) : null,
    useLiquidityOnFile: Boolean(form.useLiquidityOnFile),
    proofOfLiquidityAmount: form.proofOfLiquidityAmount || "",
    llcName: form.llcName || "",
    llcStateRecorded: form.llcStateRecorded || "",
    llcSameAsOnFile: Boolean(form.llcSameAsOnFile),
    useLlcDocsOnFile: Boolean(form.useLlcDocsOnFile),
    llcDocs: Array.isArray(form.llcDocs)
      ? form.llcDocs.map((doc, index) => ({
          name: typeof doc?.name === "string" ? doc.name : `llc-doc-${index + 1}.pdf`,
          docType: typeof doc?.docType === "string" ? doc.docType : "OTHER",
        }))
      : [],
    newLlcInfoCompleted: Boolean(form.newLlcInfoCompleted),
    useExistingMortgageLoans: Boolean(form.useExistingMortgageLoans),
    otherMortgageLoansCount: Number.isFinite(Number(form.otherMortgageLoansCount))
      ? Number(form.otherMortgageLoansCount)
      : null,
    otherMortgageLenders: Array.isArray(form.otherMortgageLenders) ? form.otherMortgageLenders : [],
    otherMortgageTotalMonthlyInterest:
      Number.isFinite(Number(form.otherMortgageTotalMonthlyInterest)) && Number(form.otherMortgageTotalMonthlyInterest) >= 0
        ? Number(form.otherMortgageTotalMonthlyInterest)
        : null,
    hasNewMortgageLoans: Boolean(form.hasNewMortgageLoans),
    newMortgageLenders: Array.isArray(form.newMortgageLenders) ? form.newMortgageLenders : [],
    activeLoans: Array.isArray(form.activeLoans)
      ? form.activeLoans.map((loan) => ({
          loanId: loan?.loanId || "",
          status: loan?.status || "",
          expectedCompletionDate: loan?.expectedCompletionDate || "",
          payoffDate: loan?.payoffDate || "",
          monthlyPayment:
            Number.isFinite(Number(loan?.monthlyPayment)) && Number(loan?.monthlyPayment) > 0
              ? Number(loan.monthlyPayment)
              : null,
          notes: loan?.notes || "",
        }))
      : [],
    useProfileReferral: Boolean(form.useProfileReferral),
    referral:
      form.referral && typeof form.referral === "object"
        ? {
            name: form.referral.name || "",
            phone: form.referral.phone || "",
            email: form.referral.email || "",
          }
        : { name: "", phone: "", email: "" },
    useProfileProjects: Boolean(form.useProfileProjects),
    pastProjects: Array.isArray(form.pastProjects)
      ? form.pastProjects.map((project, index) => ({
          propertyName: project?.propertyName || `Project ${index + 1}`,
          photoLabel: project?.photoLabel || `project-${index + 1}.jpg`,
          photoName: project?.photo?.name || null,
        }))
      : [],
    borrowerProfile:
      form.borrowerProfile && typeof form.borrowerProfile === "object"
        ? {
            firstName: form.borrowerProfile.firstName || "",
            middleName: form.borrowerProfile.middleName || "",
            lastName: form.borrowerProfile.lastName || "",
            llcName: form.borrowerProfile.llcName || "",
            email: form.borrowerProfile.email || "",
            homePhone: form.borrowerProfile.homePhone || "",
            workPhone: form.borrowerProfile.workPhone || "",
            mobilePhone: form.borrowerProfile.mobilePhone || "",
            dateOfBirth: form.borrowerProfile.dateOfBirth || "",
            socialSecurityNumber: form.borrowerProfile.socialSecurityNumber || "",
            civilStatus: form.borrowerProfile.civilStatus || "",
            presentAddress: form.borrowerProfile.presentAddress || { street: "", city: "", state: "", zip: "" },
            timeAtResidence: form.borrowerProfile.timeAtResidence || "",
            mailingSameAsPresent:
              typeof form.borrowerProfile.mailingSameAsPresent === "boolean"
                ? form.borrowerProfile.mailingSameAsPresent
                : true,
            mailingAddress: form.borrowerProfile.mailingAddress || { street: "", city: "", state: "", zip: "" },
            noBusinessAddress: Boolean(form.borrowerProfile.noBusinessAddress),
            businessAddress: form.borrowerProfile.businessAddress || { street: "", city: "", state: "", zip: "" },
            emergencyContacts: Array.isArray(form.borrowerProfile.emergencyContacts)
              ? form.borrowerProfile.emergencyContacts
              : [],
            guarantors: Array.isArray(form.borrowerProfile.guarantors)
              ? form.borrowerProfile.guarantors
                  .map((name) => (typeof name === "string" ? name.trim() : ""))
                  .filter(Boolean)
              : [],
            guarantorContacts: Array.isArray(form.borrowerProfile.guarantorContacts)
              ? form.borrowerProfile.guarantorContacts
                  .filter((contact) => contact && typeof contact === "object")
                  .map((contact) => ({
                    firstName: typeof contact?.firstName === "string" ? contact.firstName.trim() : "",
                    lastName: typeof contact?.lastName === "string" ? contact.lastName.trim() : "",
                    email: typeof contact?.email === "string" ? contact.email.trim() : "",
                    phone: typeof contact?.phone === "string" ? contact.phone.trim() : "",
                  }))
                  .filter((contact) => contact.firstName || contact.lastName || contact.email || contact.phone)
              : [],
            liquidityProofDocs: Array.isArray(form.borrowerProfile.liquidityProofDocs)
              ? form.borrowerProfile.liquidityProofDocs.map((doc, index) => ({
                  name: typeof doc?.name === "string" ? doc.name : `liquidity-proof-${index + 1}.pdf`,
                  docType:
                    typeof doc?.docType === "string" && requiredLiquidityProofDocTypes.includes(doc.docType)
                      ? doc.docType
                      : "OTHER_ACCOUNT",
                  contentType: typeof doc?.contentType === "string" ? doc.contentType : "application/octet-stream",
                  dataUrl: typeof doc?.dataUrl === "string" ? doc.dataUrl : "",
                  statementName: typeof doc?.statementName === "string" ? doc.statementName : "",
                  ownershipType:
                    typeof doc?.ownershipType === "string" && liquidityOwnershipTypes.includes(doc.ownershipType)
                      ? doc.ownershipType
                      : "BORROWER",
                  partnerIsGuarantor: Boolean(doc?.partnerIsGuarantor),
                  partnerGuarantorName: typeof doc?.partnerGuarantorName === "string" ? doc.partnerGuarantorName : "",
                  partnerIsLlcMember: Boolean(doc?.partnerIsLlcMember),
                  uploadedAt: Number.isFinite(Number(doc?.uploadedAt)) ? Number(doc.uploadedAt) : null,
                }))
              : [],
          }
        : null,
  };
};

const sanitizeConditionsPayload = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const form = normalizeBorrowerConditionsForm(payload);
  const proofOfLiquidityDocs = Array.isArray(form.proofOfLiquidityDocs)
    ? form.proofOfLiquidityDocs.map((doc, index) => ({
        name: typeof doc?.name === "string" ? doc.name : `proof-of-liquidity-${index + 1}.pdf`,
        category: typeof doc?.category === "string" ? doc.category : "",
        subcategory: typeof doc?.subcategory === "string" ? doc.subcategory : "",
      }))
    : [];
  const desktopAppraisalDocs = Array.isArray(form.desktopAppraisalDocs)
    ? form.desktopAppraisalDocs.map((doc, index) => ({
        name: typeof doc?.name === "string" ? doc.name : `desktop-appraisal-${index + 1}.pdf`,
      }))
    : [];
  const llcDocs = Array.isArray(form.llcDocs)
    ? form.llcDocs.map((doc, index) => ({
        name: typeof doc?.name === "string" ? doc.name : `llc-doc-${index + 1}.pdf`,
        docType: typeof doc?.docType === "string" ? doc.docType : "OTHER",
      }))
    : [];
  const pastProjects = Array.isArray(form.pastProjects)
    ? form.pastProjects.map((project, index) => ({
        propertyAddress:
          typeof project?.propertyAddress === "string" && project.propertyAddress.trim()
            ? project.propertyAddress.trim()
            : `Project ${index + 1}`,
        photos: Array.isArray(project?.photos)
          ? project.photos.map((photo, photoIndex) => ({
              name:
                typeof photo?.name === "string" && photo.name.trim()
                  ? photo.name.trim()
                  : `project-${index + 1}-photo-${photoIndex + 1}`,
            }))
          : [],
      }))
    : [];

  return {
    creditScore: form.creditScore,
    proofOfLiquidityAmount: form.proofOfLiquidityAmount || "",
    proofOfLiquidityDocs,
    desktopAppraisalValue: form.desktopAppraisalValue || "",
    desktopAppraisalDocs,
    llcDocs,
    referral:
      form.referral && typeof form.referral === "object"
        ? {
            name: form.referral.name || "",
            email: form.referral.email || "",
            phone: form.referral.phone || "",
          }
        : { name: "", email: "", phone: "" },
    pastProjects,
    otherMortgageLoansCount:
      Number.isFinite(Number(form.otherMortgageLoansCount)) ? Number(form.otherMortgageLoansCount) : null,
    otherMortgageTotalAmount:
      Number.isFinite(Number(form.otherMortgageTotalAmount)) && Number(form.otherMortgageTotalAmount) >= 0
        ? Number(form.otherMortgageTotalAmount)
        : null,
    submittedAt: form.submittedAt || null,
    updatedAt: form.updatedAt || null,
    documentPackage:
      form.documentPackage && typeof form.documentPackage === "object"
        ? {
            id: form.documentPackage.id,
            createdAt: form.documentPackage.createdAt || null,
            rootRelativePath: form.documentPackage.rootRelativePath || "",
            documentCount: Number(form.documentPackage.documentCount || 0),
          }
        : null,
    reuseMeta:
      form.reuseMeta && typeof form.reuseMeta === "object"
        ? {
            sourceLoanId: form.reuseMeta.sourceLoanId || "",
            sourceUpdatedAt: form.reuseMeta.sourceUpdatedAt || null,
            within30Days: Boolean(form.reuseMeta.within30Days),
          }
        : null,
  };
};

const resolveActiveLoansWithUs = (application, allApplications, continuation) => {
  const applications = Array.isArray(allApplications) ? allApplications : [];
  if (applications.length === 0) return [];

  const continuationLoanMap = new Map(
    (Array.isArray(continuation?.activeLoans) ? continuation.activeLoans : [])
      .filter((loan) => loan && typeof loan === "object" && typeof loan.loanId === "string")
      .map((loan) => [loan.loanId.trim(), loan])
  );

  const explicitLoanIds = new Set(
    (Array.isArray(continuation?.activeLoans) ? continuation.activeLoans : [])
      .map((loan) => (typeof loan?.loanId === "string" ? loan.loanId.trim() : ""))
      .filter(Boolean)
  );

  const normalizedBorrowerEmail =
    typeof application?.borrowerEmail === "string" ? application.borrowerEmail.trim().toLowerCase() : "";

  let candidateLoans = [];
  if (explicitLoanIds.size > 0) {
    candidateLoans = applications.filter((item) => explicitLoanIds.has(item.id));
  } else if (normalizedBorrowerEmail) {
    candidateLoans = applications.filter((item) => {
      const itemEmail = typeof item.borrowerEmail === "string" ? item.borrowerEmail.trim().toLowerCase() : "";
      return item.id !== application.id && itemEmail === normalizedBorrowerEmail && item.currentStageIndex >= 4;
    });
  }

  const uniqueById = new Map();
  for (const item of candidateLoans) {
    if (!item || item.id === application.id) continue;
    if (uniqueById.has(item.id)) continue;
    const amount = toSafeNumber(item.amount);
    const continuationLoan = continuationLoanMap.get(item.id);
    const monthlyPayment =
      Number.isFinite(Number(continuationLoan?.monthlyPayment)) && Number(continuationLoan.monthlyPayment) > 0
        ? Number(continuationLoan.monthlyPayment)
        : null;
    uniqueById.set(item.id, {
      loanId: item.id,
      amount: typeof amount === "number" ? amount : 0,
      property: item.property || "",
      monthlyPayment,
    });
  }

  return [...uniqueById.values()];
};

const buildUnderwritingCaseSummary = (application, allApplications = []) => {
  const intake = normalizeUnderwritingIntake(application.underwritingIntake);
  const continuation = intake.formData && typeof intake.formData === "object" ? intake.formData : null;
  const conditionsForm = normalizeBorrowerConditionsForm(application.conditionsForm);
  const conditionsDocumentPackage = normalizeConditionsDocumentPackage(conditionsForm?.documentPackage);
  const purchase = application.purchaseDetails && typeof application.purchaseDetails === "object" ? application.purchaseDetails : null;
  const aiAssessment = buildAiAssessment(application);
  const borrowerSnapshot = resolveBorrowerSnapshot(application, continuation);
  const borrowerProfile = borrowerSnapshot.profile;
  const combinedSummary = buildUnderwritingSummary(application, continuation);

  const loanAmount = toSafeNumber(application.amount) || 0;
  const purchasePrice = toSafeNumber(purchase?.purchasePrice);
  const rehabBudget = toSafeNumber(purchase?.rehabBudget);
  const arv = toSafeNumber(purchase?.arv);
  const totalProjectCost =
    typeof purchasePrice === "number" && typeof rehabBudget === "number" ? purchasePrice + rehabBudget : null;
  const ltv = typeof arv === "number" && arv > 0 ? loanAmount / arv : null;
  const ltc = typeof totalProjectCost === "number" && totalProjectCost > 0 ? loanAmount / totalProjectCost : null;
  const borrowerCashToClose =
    typeof totalProjectCost === "number" ? Math.max(totalProjectCost - loanAmount, 0) : null;

  const creditScore =
    Number.isFinite(Number(continuation?.creditScore))
      ? Number(continuation.creditScore)
      : Number.isFinite(Number(conditionsForm?.creditScore))
        ? Number(conditionsForm.creditScore)
        : null;
  const liquidityAmount =
    toSafeNumber(continuation?.proofOfLiquidityAmount) ?? toSafeNumber(conditionsForm?.proofOfLiquidityAmount);
  const liquidityRatio = typeof liquidityAmount === "number" && loanAmount > 0 ? liquidityAmount / loanAmount : null;
  const withUsActiveLoans = resolveActiveLoansWithUs(application, allApplications, continuation);
  const liquidityMonths = underwritingDecisionRules.liquidityMonths;
  const monthlyInterestRate = underwritingDecisionRules.assumedAnnualInterestRate / 12;
  const sixMonthInterest = loanAmount > 0 ? loanAmount * monthlyInterestRate * liquidityMonths : 0;
  const withUsMonthlyPaymentTotal = withUsActiveLoans.reduce((sum, loan) => {
    const providedPayment = toSafeNumber(loan.monthlyPayment);
    if (typeof providedPayment === "number" && providedPayment > 0) return sum + providedPayment;
    const loanAmountForEstimate = toSafeNumber(loan.amount);
    if (typeof loanAmountForEstimate === "number" && loanAmountForEstimate > 0) {
      return sum + loanAmountForEstimate * monthlyInterestRate;
    }
    return sum;
  }, 0);
  const declaredOtherMortgageCount = Number.isFinite(Number(continuation?.otherMortgageLoansCount))
    ? Math.max(Number(continuation.otherMortgageLoansCount), 0)
    : Number.isFinite(Number(conditionsForm?.otherMortgageLoansCount))
      ? Math.max(Number(conditionsForm.otherMortgageLoansCount), 0)
      : 0;
  const listedOtherLenderCount = Array.isArray(continuation?.otherMortgageLenders)
    ? continuation.otherMortgageLenders.filter((item) => typeof item === "string" && item.trim()).length
    : 0;
  const listedNewOtherLenderCount = Array.isArray(continuation?.newMortgageLenders)
    ? continuation.newMortgageLenders.filter((item) => typeof item === "string" && item.trim()).length
    : 0;
  const otherLenderLoanCount = Math.max(declaredOtherMortgageCount, listedOtherLenderCount + listedNewOtherLenderCount);
  const providedOtherLenderMonthlyInterest = toSafeNumber(continuation?.otherMortgageTotalMonthlyInterest);
  const providedOtherLenderTotalAmount = toSafeNumber(conditionsForm?.otherMortgageTotalAmount);
  const estimatedOtherLenderMonthlyPayment =
    loanAmount > 0
      ? otherLenderLoanCount *
        loanAmount *
        monthlyInterestRate *
        underwritingDecisionRules.estimatedOtherLenderMonthlyPaymentFactor
      : 0;
  const withUsExposure = withUsMonthlyPaymentTotal * liquidityMonths;
  const estimatedOtherLenderExposure =
    typeof providedOtherLenderTotalAmount === "number" && providedOtherLenderTotalAmount > 0
      ? providedOtherLenderTotalAmount * liquidityMonths
      : (typeof providedOtherLenderMonthlyInterest === "number" && providedOtherLenderMonthlyInterest > 0
          ? providedOtherLenderMonthlyInterest
          : estimatedOtherLenderMonthlyPayment) * liquidityMonths;
  const otherLoansMonthlyPaymentsSixMonth = withUsExposure + estimatedOtherLenderExposure;
  const serviceFee = underwritingDecisionRules.monthlyServiceFee;
  const documentPreparationFee = underwritingDecisionRules.documentPreparationFee;
  const closingCostEstimate = underwritingDecisionRules.closingCostEstimate;
  const originationFeePercent = underwritingDecisionRules.originationFeePercent;
  const originationFee = loanAmount > 0 ? (loanAmount / 100) * originationFeePercent : 0;
  const perDiemDayCountBasis = underwritingDecisionRules.perDiemDayCountBasis;
  const prepaidInterestDays = calculateDaysToFirstDayOfFollowingMonth(purchase?.targetClosingDate) ?? 0;
  const prepaidInterestAnnualRatePct = underwritingDecisionRules.prepaidInterestAnnualRate * 100;
  const prepaidInterestPerDiem =
    loanAmount > 0 && perDiemDayCountBasis > 0
      ? ((loanAmount / 100) * prepaidInterestAnnualRatePct) / perDiemDayCountBasis
      : 0;
  const prepaidInterest = prepaidInterestPerDiem * prepaidInterestDays;
  const requiredLiquidity =
    sixMonthInterest +
    serviceFee +
    documentPreparationFee +
    closingCostEstimate +
    withUsExposure +
    estimatedOtherLenderExposure +
    originationFee +
    prepaidInterest;
  const liquidityCoverageRatio =
    typeof liquidityAmount === "number" && requiredLiquidity > 0 ? liquidityAmount / requiredLiquidity : null;
  const remainingLiquidity =
    typeof liquidityAmount === "number" && requiredLiquidity > 0 ? liquidityAmount - requiredLiquidity : null;
  const isLiquidityCoverageEnough =
    typeof remainingLiquidity === "number" ? remainingLiquidity >= 0 : null;
  const externalFactorPct = Math.round(underwritingDecisionRules.estimatedOtherLenderMonthlyPaymentFactor * 100);
  const annualInterestPct = Math.round(underwritingDecisionRules.assumedAnnualInterestRate * 100);
  const externalLoanPaymentsFormulaSegment =
    typeof providedOtherLenderTotalAmount === "number" && providedOtherLenderTotalAmount > 0
      ? `External (borrower-provided amount): ${formatCurrencyLabel(providedOtherLenderTotalAmount)} x ${liquidityMonths} = ${formatCurrencyLabel(estimatedOtherLenderExposure)}`
      : typeof providedOtherLenderMonthlyInterest === "number" && providedOtherLenderMonthlyInterest > 0
        ? `External (borrower-provided monthly): ${formatCurrencyLabel(providedOtherLenderMonthlyInterest)} x ${liquidityMonths} = ${formatCurrencyLabel(estimatedOtherLenderExposure)}`
        : `External (estimated): ${formatCurrencyLabel(estimatedOtherLenderMonthlyPayment)} x ${liquidityMonths} = ${formatCurrencyLabel(estimatedOtherLenderExposure)}`;
  const liquidityCoverageFormula =
    `Required Liquidity = 6-Month Interest (${formatCurrencyLabel(loanAmount)} x ${annualInterestPct}% / 12 x ${liquidityMonths} = ${formatCurrencyLabel(sixMonthInterest)}) + ` +
    `Service Fee (${formatCurrencyLabel(serviceFee)}) + ` +
    `Document Preparation Fee (${formatCurrencyLabel(documentPreparationFee)}) + ` +
    `Closing Cost Estimate (${formatCurrencyLabel(closingCostEstimate)}) + ` +
    `Sum of Other-Loan Monthly Payments (${formatCurrencyLabel(withUsMonthlyPaymentTotal)} x ${liquidityMonths} = ${formatCurrencyLabel(withUsExposure)}) + ` +
    `Total Other Mortgage Exposure (${externalLoanPaymentsFormulaSegment}) + ` +
    `Origination Fee (((Loan Amount / 100) x ${originationFeePercent}) = ${formatCurrencyLabel(originationFee)}) + ` +
    `Prepaid Interest (Per Diem (((Loan Amount / 100) x ${prepaidInterestAnnualRatePct}) / ${perDiemDayCountBasis}) = ${formatCurrencyLabel(prepaidInterestPerDiem)}; ` +
    `${prepaidInterestDays} day${prepaidInterestDays === 1 ? "" : "s"} = ${formatCurrencyLabel(prepaidInterest)}) = ` +
    `${formatCurrencyLabel(requiredLiquidity)}`;
  const liquidityCoverageAssumption = [
    `Uses a fixed ${annualInterestPct}% annual interest assumption for monthly-interest estimates.`,
    `Origination fee is modeled as ((loan amount / 100) x ${originationFeePercent}).`,
    `Prepaid interest uses per diem (((loan amount / 100) x ${prepaidInterestAnnualRatePct}) / ${perDiemDayCountBasis}) multiplied by days from target closing date to the first day of the following month.`,
    `When a with-us monthly payment is not provided, it is estimated from that loan amount.`,
    typeof providedOtherLenderTotalAmount === "number" && providedOtherLenderTotalAmount > 0
      ? "External-loan exposure uses the borrower-provided other mortgage amount from conditions form and applies a 6-month multiplier."
      : typeof providedOtherLenderMonthlyInterest === "number" && providedOtherLenderMonthlyInterest > 0
        ? "External-loan monthly payments use the borrower-provided total monthly interest value."
        : `External-loan monthly payments are modeled at ${externalFactorPct}% of the current-loan monthly-interest estimate.`,
  ].join(" ");
  const liquidityCoverage = {
    formula: liquidityCoverageFormula,
    availableLiquidity: liquidityAmount,
    requiredLiquidity: requiredLiquidity > 0 ? requiredLiquidity : null,
    withUsExposure: withUsExposure > 0 ? withUsExposure : 0,
    estimatedOtherLenderExposure: estimatedOtherLenderExposure > 0 ? estimatedOtherLenderExposure : 0,
    otherLenderLoanCount,
    monthlyInterestSixMonth: sixMonthInterest > 0 ? sixMonthInterest : 0,
    serviceFeesSixMonth: serviceFee,
    originationFee,
    documentPreparationFee,
    closingCostEstimate,
    perDiemDayCountBasis,
    otherLoansMonthlyPaymentsSixMonth: otherLoansMonthlyPaymentsSixMonth > 0 ? otherLoansMonthlyPaymentsSixMonth : 0,
    prepaidInterestPerDiem,
    prepaidInterestDays,
    prepaidInterest,
    coverageRatio: liquidityCoverageRatio,
    remainingLiquidity,
    isEnough: isLiquidityCoverageEnough,
    assumptionNote: liquidityCoverageAssumption,
  };
  const daysUntilClosing = calculateDaysUntil(purchase?.targetClosingDate);

  const compsDocs = normalizeLenderViewerDocumentGroup(purchase?.compsFiles, {
    groupKey: "compsFiles",
    loanId: application.id,
    prefix: "comps",
    label: "COMPS",
    source: "new_loan_request",
    required: true,
  });
  const propertyPhotoDocs = normalizeDocumentGroup(purchase?.propertyPhotos, {
    prefix: "property-photo",
    label: "Property Photo",
    source: "new_loan_request",
    required: true,
  });
  const contractDocs = normalizeLenderViewerDocumentGroup(purchase?.purchaseContractFiles, {
    groupKey: "purchaseContractFiles",
    loanId: application.id,
    prefix: "purchase-contract",
    label: "Purchase Contract",
    source: "new_loan_request",
    required: true,
  });
  const scopeDocs = normalizeLenderViewerDocumentGroup(purchase?.scopeOfWorkFiles, {
    groupKey: "scopeOfWorkFiles",
    loanId: application.id,
    prefix: "scope-of-work",
    label: "Scope of Work",
    source: "new_loan_request",
    required: true,
  });
  const llcDocs = normalizeDocumentGroup(continuation?.llcDocs, {
    prefix: "llc-doc",
    label: "LLC Document",
    source: "continuation_form",
    required: true,
  });
  const conditionProofDocs = normalizeDocumentGroup(conditionsForm?.proofOfLiquidityDocs, {
    prefix: "conditions-proof",
    label: "Conditions - Proof of Liquidity",
    source: "continuation_form",
    required: false,
  });
  const conditionDesktopAppraisalDocs = normalizeDocumentGroup(conditionsForm?.desktopAppraisalDocs, {
    prefix: "conditions-desktop-appraisal",
    label: "Conditions - Desktop Appraisal",
    source: "continuation_form",
    required: false,
  });
  const conditionLlcDocs = normalizeDocumentGroup(conditionsForm?.llcDocs, {
    prefix: "conditions-llc",
    label: "Conditions - LLC Document",
    source: "continuation_form",
    required: false,
  });
  const conditionProjectPhotos = normalizeDocumentGroup(
    Array.isArray(conditionsForm?.pastProjects)
      ? conditionsForm.pastProjects.flatMap((project) => (Array.isArray(project?.photos) ? project.photos : []))
      : [],
    {
      prefix: "conditions-project-photo",
      label: "Conditions - Past Project Photo",
      source: "continuation_form",
      required: false,
    }
  );

  const continuationPastProjects = Array.isArray(continuation?.pastProjects)
    ? continuation.pastProjects.map((project, index) => ({
        propertyName: project?.propertyName || `Project ${index + 1}`,
        photoLabel: project?.photoLabel || `project-${index + 1}.jpg`,
        photoUrl: isUsableDocumentUrl(project?.photo?.dataUrl) ? project.photo.dataUrl : null,
      }))
    : [];
  const conditionsPastProjects = Array.isArray(conditionsForm?.pastProjects)
    ? conditionsForm.pastProjects.map((project, index) => ({
        propertyName:
          typeof project?.propertyAddress === "string" && project.propertyAddress.trim()
            ? project.propertyAddress.trim()
            : `Project ${index + 1}`,
        photoLabel:
          Array.isArray(project?.photos) && typeof project.photos[0]?.name === "string" && project.photos[0].name.trim()
            ? project.photos[0].name.trim()
            : `project-${index + 1}.jpg`,
        photoUrl:
          Array.isArray(project?.photos) && isUsableDocumentUrl(project.photos[0]?.dataUrl)
            ? project.photos[0].dataUrl
            : null,
      }))
    : [];
  const pastProjects = continuationPastProjects.length > 0 ? continuationPastProjects : conditionsPastProjects;

  const conditionsPackageDocuments = Array.isArray(conditionsDocumentPackage?.files)
    ? conditionsDocumentPackage.files.map((file, index) => ({
        id: `conditions-package-${index + 1}`,
        label: file.label || "Conditions Document",
        name: file.name || `conditions-document-${index + 1}`,
        url: buildLenderConditionsDocumentLink(application.id, conditionsDocumentPackage.id, file.id),
        source: "continuation_form",
        required: false,
      }))
    : [];
  const usePackagedConditionsDocuments = conditionsPackageDocuments.length > 0;

  const allDocuments = [
    ...compsDocs,
    ...contractDocs,
    ...scopeDocs,
    ...llcDocs,
    ...(usePackagedConditionsDocuments ? [] : conditionProofDocs),
    ...(usePackagedConditionsDocuments ? [] : conditionDesktopAppraisalDocs),
    ...(usePackagedConditionsDocuments ? [] : conditionLlcDocs),
    ...(usePackagedConditionsDocuments ? [] : conditionProjectPhotos),
    ...conditionsPackageDocuments,
  ];
  const riskFlags = [];
  const pushRisk = (id, label, detail, severity, state) => {
    riskFlags.push({ id, label, detail, severity, state });
  };

  if (requiresPurchaseDetails(application.type)) {
    if (compsDocs.length === 0) pushRisk("missing-comps", "Missing COMPS", "Borrower has not uploaded COMPS.", "high", "issue");
    if (propertyPhotoDocs.length === 0)
      pushRisk("missing-photos", "Missing Property Photos", "No subject property photos uploaded.", "medium", "issue");
    if (contractDocs.length === 0)
      pushRisk("missing-contract", "Missing Purchase Contract", "Purchase contract is required for review.", "high", "issue");
    if (scopeDocs.length === 0)
      pushRisk("missing-scope", "Missing Scope of Work", "Itemized rehab scope has not been uploaded.", "high", "issue");
  }

  const hasCompleteLiquidityProofDocs = hasRequiredLiquidityProofDocs(borrowerProfile);
  const liquidityProofOwnershipErrors = validateLiquidityProofOwnershipRules(borrowerProfile);

  if (!continuation) {
    pushRisk(
      "continuation-not-submitted",
      "Continuation not submitted",
      "Borrower continuation form is required before final underwriting decision.",
      "high",
      "pending"
    );
  } else {
    const llcDocTypes = new Set(
      [...(continuation.llcDocs || []), ...(conditionsForm?.llcDocs || [])]
        .map((doc) => doc?.docType)
        .filter(Boolean)
    );
    for (const requiredDocType of requiredLlcDocTypes) {
      if (!llcDocTypes.has(requiredDocType)) {
        pushRisk(
          `missing-llc-${requiredDocType.toLowerCase()}`,
          `Missing ${requiredDocType.replace(/_/g, " ")}`,
          "Required LLC documentation is incomplete.",
          "medium",
          "issue"
        );
      }
    }

    if (!creditScore) {
      pushRisk("missing-credit", "Credit score missing", "No credit score available from continuation form.", "high", "issue");
    }

    if (!liquidityAmount) {
      pushRisk(
        "missing-liquidity",
        "Liquidity proof missing",
        "Updated liquidity details are required for underwriting review.",
        "medium",
        "pending"
      );
    }
    if (!hasCompleteLiquidityProofDocs) {
      pushRisk(
        "missing-liquidity-documents",
        "Liquidity documents missing",
        "Borrower profile must include at least one proof of liquidity document.",
        "medium",
        "pending"
      );
    }
    if (liquidityProofOwnershipErrors.length > 0) {
      pushRisk(
        "liquidity-statement-ownership",
        "Liquidity statement ownership mismatch",
        liquidityProofOwnershipErrors[0],
        "medium",
        "pending"
      );
    }

    if (continuation.llcName && borrowerProfile.llcName && continuation.llcName !== borrowerProfile.llcName) {
      pushRisk(
        "entity-mismatch",
        "Entity ownership mismatch",
        "Borrower profile entity and continuation LLC name do not match.",
        "medium",
        "pending"
      );
    }
  }

  if (typeof ltv === "number" && ltv > underwritingDecisionRules.maxLtv) {
    pushRisk(
      "high-ltv",
      "High leverage (LTV)",
      `LTV ${formatPercentLabel(ltv)} exceeds policy threshold ${formatPercentLabel(underwritingDecisionRules.maxLtv)}.`,
      "high",
      "issue"
    );
  }

  if (typeof ltc === "number" && ltc > underwritingDecisionRules.maxLtc) {
    pushRisk(
      "high-ltc",
      "High leverage (LTC)",
      `LTC ${formatPercentLabel(ltc)} exceeds policy threshold ${formatPercentLabel(underwritingDecisionRules.maxLtc)}.`,
      "medium",
      "issue"
    );
  }

  if (typeof creditScore === "number" && creditScore < underwritingDecisionRules.minCreditScore) {
    pushRisk(
      "low-credit",
      "Low credit score",
      `Credit score ${creditScore} is below preferred threshold ${underwritingDecisionRules.minCreditScore}.`,
      "high",
      "issue"
    );
  }

  if (typeof liquidityRatio === "number" && liquidityRatio < underwritingDecisionRules.minLiquidityToLoanRatio) {
    pushRisk(
      "low-reserves",
      "Low reserves",
      `Liquidity is ${formatPercentLabel(liquidityRatio)} of requested loan amount.`,
      "medium",
      "issue"
    );
  }

  if (otherLenderLoanCount > underwritingDecisionRules.maxOtherMortgageLoans) {
    pushRisk(
      "high-other-loan-count",
      "High number of other mortgage loans",
      `Other mortgage loans (${otherLenderLoanCount}) exceed threshold ${underwritingDecisionRules.maxOtherMortgageLoans}.`,
      "medium",
      "pending"
    );
  }

  if (isLiquidityCoverageEnough === false) {
    pushRisk(
      "liquidity-coverage-shortfall",
      "Liquidity does not cover combined exposure",
      `Available liquidity ${formatCurrencyLabel(liquidityAmount)} vs modeled requirement ${formatCurrencyLabel(requiredLiquidity)} (shortfall ${formatCurrencyLabel(Math.abs(remainingLiquidity || 0))}).`,
      "high",
      "issue"
    );
  }

  if (typeof daysUntilClosing === "number" && daysUntilClosing <= underwritingDecisionRules.shortClosingTimelineDays) {
    pushRisk(
      "short-closing",
      "Short closing timeline",
      `Target closing is in ${daysUntilClosing} day${daysUntilClosing === 1 ? "" : "s"}.`,
      "medium",
      "pending"
    );
  }

  if (typeof daysUntilClosing === "number" && daysUntilClosing < 0) {
    pushRisk(
      "closing-date-past",
      "Closing timeline expired",
      "Target closing date is in the past and must be updated.",
      "high",
      "issue"
    );
  }

  const hasCompleteLlcDocs = requiredLlcDocTypes.every((requiredType) =>
    [...(continuation?.llcDocs || []), ...(conditionsForm?.llcDocs || [])].some(
      (doc) => doc?.docType === requiredType
    )
  );
  const recordSearchStatus = [
    {
      id: "title-search",
      label: "Title Search",
      status: contractDocs.length > 0 ? "complete" : "pending",
      note: contractDocs.length > 0 ? "Purchase contract on file for title chain review." : "Awaiting purchase contract.",
      updatedAt: continuation ? intake.submittedAt : null,
    },
    {
      id: "valuation-comps",
      label: "Valuation & COMPS",
      status: compsDocs.length > 0 && arv ? "complete" : "pending",
      note:
        compsDocs.length > 0 && arv
          ? "COMPS and ARV values submitted."
          : "COMPS or ARV data missing for valuation validation.",
      updatedAt: continuation ? intake.submittedAt : null,
    },
    {
      id: "entity-standing",
      label: "Entity Standing Check",
      status: hasCompleteLlcDocs ? "complete" : continuation ? "in_review" : "pending",
      note: hasCompleteLlcDocs
        ? "Certificate of good standing, OA, articles, and EIN are present."
        : "Entity package is incomplete or pending review.",
      updatedAt: continuation ? intake.submittedAt : null,
    },
    {
      id: "liquidity-verification",
      label: "Liquidity Verification",
      status:
        liquidityAmount && hasCompleteLiquidityProofDocs && liquidityProofOwnershipErrors.length === 0
          ? "in_review"
          : "pending",
      note: !liquidityAmount
        ? "No liquidity value submitted."
        : !hasCompleteLiquidityProofDocs
          ? "Liquidity amount submitted, but required profile proof documents are missing."
          : liquidityProofOwnershipErrors.length > 0
            ? liquidityProofOwnershipErrors[0]
            : "Liquidity amount and required profile proofs are submitted; pending underwriting verification.",
      updatedAt: continuation ? intake.submittedAt : null,
    },
  ];

  const pendingRecordSearchCount = recordSearchStatus.filter((item) => item.status !== "complete").length;
  if (pendingRecordSearchCount > 0) {
    pushRisk(
      "record-search-pending",
      "Pending record search items",
      `${pendingRecordSearchCount} record check${pendingRecordSearchCount === 1 ? "" : "s"} still pending.`,
      "low",
      "pending"
    );
  }

  const issueCount = riskFlags.filter((flag) => flag.state === "issue").length;
  const pendingCount = riskFlags.filter((flag) => flag.state === "pending").length;
  const highRiskCount = riskFlags.filter((flag) => flag.severity === "high").length;
  const quickDecision = buildQuickDecision({ creditScore, ltv, flags: riskFlags, liquidityCoverage });

  const internalNotes = [];
  if (application.decisionNotes) {
    internalNotes.push({
      id: `${application.id}-decision-note`,
      source: "Decision Note",
      message: application.decisionNotes,
      createdAt: application.lastEventAt || null,
    });
  }
  const lenderMessages = Array.isArray(application.communications)
    ? application.communications.filter((entry) => entry.from === "LENDER")
    : [];
  lenderMessages
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5)
    .forEach((entry) => {
      internalNotes.push({
        id: entry.id || `${application.id}-${entry.createdAt}`,
        source: entry.type === "REQUEST_INFO" ? "Lender Request" : "Lender Reply",
        message: entry.message,
        createdAt: entry.createdAt || null,
      });
    });
  const lenderComments = Array.isArray(application.lenderComments) ? application.lenderComments : [];
  lenderComments
    .slice()
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 5)
    .forEach((entry) => {
      if (!entry || typeof entry.message !== "string" || !entry.message.trim()) return;
      internalNotes.push({
        id: entry.id || `${application.id}-comment-${entry.createdAt || Date.now()}`,
        source: "Lender Comment",
        message: entry.message,
        createdAt: typeof entry.createdAt === "number" ? entry.createdAt : null,
      });
    });

  const submissionHistory = Array.isArray(intake.submissionHistory) ? intake.submissionHistory : [];
  const continuationSubmissions = continuation
    ? [
        ...submissionHistory,
        { submittedAt: intake.submittedAt || null, formData: continuation },
      ]
        .filter((entry) => entry && entry.formData)
        .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))
    : submissionHistory
        .filter((entry) => entry && entry.formData)
        .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  const conditionsSubmitted = hasBorrowerConditionsContent(conditionsForm);
  const conditionsLatestSubmittedAt =
    Number.isFinite(Number(conditionsForm?.updatedAt)) && Number(conditionsForm.updatedAt) > 0
      ? Number(conditionsForm.updatedAt)
      : Number.isFinite(Number(conditionsForm?.submittedAt)) && Number(conditionsForm.submittedAt) > 0
        ? Number(conditionsForm.submittedAt)
        : null;
  const conditionsLatest = sanitizeConditionsPayload(conditionsForm);
  const hasContinuationCredit = Number.isFinite(Number(continuation?.creditScore));
  const hasConditionsCredit = Number.isFinite(Number(conditionsForm?.creditScore));
  const hasContinuationLiquidity = toSafeNumber(continuation?.proofOfLiquidityAmount) !== null;
  const hasConditionsLiquidity = toSafeNumber(conditionsForm?.proofOfLiquidityAmount) !== null;
  const flipsCompleted = Array.isArray(continuation?.pastProjects)
    ? continuation.pastProjects.length
    : Array.isArray(conditionsForm?.pastProjects)
      ? conditionsForm.pastProjects.length
      : null;
  const rentalsOwned = Number.isFinite(Number(continuation?.otherMortgageLoansCount))
    ? Number(continuation.otherMortgageLoansCount)
    : Number.isFinite(Number(conditionsForm?.otherMortgageLoansCount))
      ? Number(conditionsForm.otherMortgageLoansCount)
      : null;
  const openLoanCount = Array.isArray(continuation?.activeLoans)
    ? continuation.activeLoans.length
    : Number.isFinite(Number(continuation?.otherMortgageLoansCount))
      ? Number(continuation.otherMortgageLoansCount)
      : Number.isFinite(Number(conditionsForm?.otherMortgageLoansCount))
        ? Number(conditionsForm.otherMortgageLoansCount)
        : null;
  const creditSource = continuation?.useCreditScoreOnFile
    ? "Prior application (<30 days)"
    : hasContinuationCredit
      ? "Continuation form"
      : hasConditionsCredit
        ? "Conditions form"
        : "Not submitted";
  const liquiditySource = continuation?.useLiquidityOnFile
    ? "Prior application (<30 days)"
    : hasContinuationLiquidity
      ? "Continuation form"
      : hasConditionsLiquidity
        ? "Conditions form"
        : "Not submitted";

  return {
    loanId: application.id,
    stage: stages[application.currentStageIndex],
    workflowStatus: application.currentStageIndex === 0 ? "New Loan Request" : getApplicationStatus(application),
    createdAt: application.createdAt,
    lastEventAt: application.lastEventAt,
    executive: {
      borrowerName: borrowerSnapshot.fullName,
      borrowerEntity: borrowerSnapshot.entityName,
      borrowerEmail: borrowerSnapshot.email,
      propertyAddress: application.property,
      requestedLoanAmount: loanAmount,
      purpose: application.type,
      product: resolveProductLabel(application),
      status: resolveExecutiveStatus(application),
    },
    qualification: {
      creditScore,
      creditSource,
      flipsCompleted,
      rentalsOwned,
      yearsInvesting: parseYearsFromValue(continuation?.borrowerProfile?.timeAtResidence),
      liquidityAmount,
      liquiditySource,
      liquidityCoverage,
      dti: null,
      dscr: null,
      ltv,
      ltc,
      totalProjectCost,
      borrowerCashToClose,
      exitStrategy: purchase?.exitStrategy || "Not provided",
      exitTimeline: purchase?.targetClosingDate || "Not provided",
      openLoanCount,
      occupancyStrategy: purchase?.exitStrategy || application.type,
    },
    riskFlags,
    riskCounts: {
      issues: issueCount,
      pending: pendingCount,
      highRisk: highRiskCount,
    },
    quickDecision,
    recordSearchStatus,
    evaluatorAssessment: {
      title: "Property Evaluator Assessment",
      recommendation: aiAssessment.recommendation,
      confidence: aiAssessment.confidence,
      reasons: aiAssessment.reasons || [],
      notes: [
        typeof ltv === "number"
          ? `Computed LTV is ${formatPercentLabel(ltv)} against max ${formatPercentLabel(underwritingDecisionRules.maxLtv)}.`
          : "LTV cannot be computed due to missing ARV.",
        typeof ltc === "number"
          ? `Computed LTC is ${formatPercentLabel(ltc)} against max ${formatPercentLabel(underwritingDecisionRules.maxLtc)}.`
          : "LTC cannot be computed due to missing purchase and rehab totals.",
        `${liquidityCoverageFormula}.`,
        `Liquidity sufficiency: ${
          isLiquidityCoverageEnough === null ? "Not enough data" : isLiquidityCoverageEnough ? "Enough" : "Not enough"
        }. ${liquidityCoverageAssumption}`,
      ],
      metrics: {
        ltv,
        ltc,
        docsScore: aiAssessment.metrics.docsScore,
      },
    },
    borrowerPortal: {
      newLoanRequest: {
        borrower: {
          fullName: borrowerSnapshot.fullName,
          email: borrowerSnapshot.email,
          entityName: borrowerSnapshot.entityName,
        },
        property: {
          address: application.property,
        },
        loanRequest: {
          type: application.type,
          amount: loanAmount,
          purchasePrice: purchase?.purchasePrice || "",
          rehabBudget: purchase?.rehabBudget || "",
          arv: purchase?.arv || "",
          assessorValue: purchase?.assessorValue || "",
          zillowValue: purchase?.zillowValue || "",
          realtorComValue: purchase?.realtorComValue || "",
          narprValue: purchase?.narprValue || "",
          propelioMedianValue: purchase?.propelioMedianValue || "",
          propelioHighValue: purchase?.propelioHighValue || "",
          propelioLowValue: purchase?.propelioLowValue || "",
          economicValue: purchase?.economicValue || "",
          rentometerEstimate: purchase?.rentometerEstimate || "",
          zillowRentEstimate: purchase?.zillowRentEstimate || "",
          currentOwner: purchase?.currentOwner || "",
          lastSaleDate: purchase?.lastSaleDate || "",
          lastSalePrice: purchase?.lastSalePrice || "",
          exitStrategy: purchase?.exitStrategy || "",
          targetClosingDate: purchase?.targetClosingDate || "",
        },
      },
      continuation: {
        submitted: Boolean(continuation),
        latestSubmittedAt: intake.submittedAt || null,
        submissions: continuationSubmissions.map((entry) => ({
          submittedAt: entry.submittedAt || null,
          formData: sanitizeContinuationPayload(entry.formData),
        })),
        latest: sanitizeContinuationPayload(continuation),
      },
      conditions: {
        submitted: conditionsSubmitted,
        latestSubmittedAt: conditionsLatestSubmittedAt,
        latest: conditionsLatest,
      },
    },
    linksAndDocuments: {
      photos: propertyPhotoDocs,
      pastProjects,
      documents: allDocuments,
      llcDocumentsViewerUrl:
        allDocuments.some((doc) => /llc document/i.test(`${doc.label || ""} ${doc.name || ""}`))
          ? buildLenderLlcDocumentsViewerLink(application.id)
          : null,
      conditionsPackage: conditionsDocumentPackage
        ? {
            id: conditionsDocumentPackage.id,
            createdAt: conditionsDocumentPackage.createdAt,
            folderPath: conditionsDocumentPackage.rootRelativePath,
            manifestPath: conditionsDocumentPackage.manifestRelativePath,
            documentCount: conditionsDocumentPackage.documentCount,
            files: (conditionsDocumentPackage.files || []).map((file) => ({
              id: file.id,
              label: file.label,
              name: file.name,
              path: file.relativePath,
            })),
          }
        : null,
    },
    internalNotes,
    combinedNarrative: combinedSummary?.combinedNarrative || "",
  };
};

const buildValuationInputSnapshot = (application) => {
  const purchaseDetails = normalizePurchaseDetails(application.purchaseDetails);
  const values = extractValuationInputValues(purchaseDetails);
  const missingFields = getValuationInputMissingLabels(values);
  const trail = normalizeValuationInputTrail(application.valuationInputTrail);
  const latest = trail[0] || null;
  return {
    loanId: application.id,
    statusLabel: application.currentStageIndex === 0 ? "New Loan Request" : getApplicationStatus(application),
    values,
    missingFields,
    isComplete: missingFields.length === 0,
    lastUpdatedAt: latest ? latest.updatedAt : null,
    lastUpdatedBy: latest ? latest.updatedBy : null,
  };
};

const buildEvaluatorInputSnapshot = (application) => {
  const values = normalizeEvaluatorInputValues(application.evaluatorInput);
  const missingFields = getEvaluatorInputMissingLabels(values);
  return {
    loanId: application.id,
    statusLabel: application.currentStageIndex === 0 ? "New Loan Request" : getApplicationStatus(application),
    values,
    missingFields,
    isComplete: missingFields.length === 0,
    lastUpdatedAt: Number.isFinite(Number(application.evaluatorInputUpdatedAt))
      ? Number(application.evaluatorInputUpdatedAt)
      : null,
    lastUpdatedBy: typeof application.evaluatorInputUpdatedBy === "string" ? application.evaluatorInputUpdatedBy : null,
  };
};

const toLenderPipelineRecord = (application) => ({
  loanId: application.id,
  borrower: application.borrowerName || "Borrower User",
  property: application.property,
  amount: application.amount,
  statusLabel: application.currentStageIndex === 0 ? "New Loan Request" : getApplicationStatus(application),
  stage: stages[application.currentStageIndex],
  ltvLabel: (() => {
    const arv = toNumber(application.purchaseDetails?.arv);
    if (!arv) return "N/A";
    return `${((application.amount / arv) * 100).toFixed(1)}%`;
  })(),
  preApprovalDecision: application.preApprovalDecision || "PENDING",
  decisionNotes: application.decisionNotes || null,
  createdAt: application.createdAt,
  type: application.type,
  purchaseDetails: application.purchaseDetails || null,
  borrowerEmail: application.borrowerEmail || "michael.chen@email.com",
  communications: application.communications || [],
  lenderComments: application.lenderComments || [],
  aiAssessment: buildAiAssessment(application),
  valuationInput: buildValuationInputSnapshot(application),
  evaluatorInput: buildEvaluatorInputSnapshot(application),
  conditionsForm:
    application.conditionsForm && typeof application.conditionsForm === "object"
      ? normalizeBorrowerConditionsForm(application.conditionsForm)
      : null,
  underwritingIntake: normalizeUnderwritingIntake(application.underwritingIntake),
  underwritingSummary: buildUnderwritingSummary(
    application,
    application.underwritingIntake?.formData && typeof application.underwritingIntake.formData === "object"
      ? application.underwritingIntake.formData
      : null
  ),
});

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(conditionsDocumentsDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({ applications: seedApplications }, null, 2), "utf8");
  }
}

async function readApplications() {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.applications)) {
    return [];
  }
  return parsed.applications.map(normalizeApplication);
}

async function writeApplications(applications) {
  await fs.writeFile(dataFile, JSON.stringify({ applications }, null, 2), "utf8");
}

async function ensureUnderwritingSettingsFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(underwritingSettingsFile);
  } catch {
    underwritingDecisionRules = { ...underwritingDecisionRuleDefaults };
    await fs.writeFile(
      underwritingSettingsFile,
      JSON.stringify({ settings: underwritingDecisionRules }, null, 2),
      "utf8"
    );
  }
}

async function readUnderwritingSettings() {
  await ensureUnderwritingSettingsFile();
  try {
    const raw = await fs.readFile(underwritingSettingsFile, "utf8");
    const parsed = JSON.parse(raw);
    const candidate =
      parsed && typeof parsed === "object" && parsed.settings && typeof parsed.settings === "object"
        ? parsed.settings
        : parsed;
    underwritingDecisionRules = normalizeUnderwritingDecisionRules(candidate);
  } catch {
    underwritingDecisionRules = { ...underwritingDecisionRuleDefaults };
    await fs.writeFile(
      underwritingSettingsFile,
      JSON.stringify({ settings: underwritingDecisionRules }, null, 2),
      "utf8"
    );
  }
  return underwritingDecisionRules;
}

async function writeUnderwritingSettings(partialSettings) {
  const nextSettings = normalizeUnderwritingDecisionRules({
    ...underwritingDecisionRules,
    ...(partialSettings && typeof partialSettings === "object" ? partialSettings : {}),
  });
  underwritingDecisionRules = nextSettings;
  await fs.writeFile(underwritingSettingsFile, JSON.stringify({ settings: nextSettings }, null, 2), "utf8");
  return nextSettings;
}

function nextLoanId(applications) {
  const year = new Date().getFullYear();
  const maxSuffix = applications
    .map((appItem) => Number(appItem.id.split("-").pop() || "0"))
    .reduce((max, suffix) => Math.max(max, Number.isFinite(suffix) ? suffix : 0), 1500);
  return `LA-${year}-${maxSuffix + 1}`;
}

function appendLenderComment(application, message, options = {}) {
  const normalizedMessage = typeof message === "string" ? message.trim() : "";
  if (!normalizedMessage) return application;
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const existingComments = Array.isArray(application.lenderComments) ? application.lenderComments : [];
  return {
    ...application,
    lenderComments: [
      ...existingComments,
      {
        id: `comment-${now}-${Math.random().toString(16).slice(2, 8)}`,
        message: normalizedMessage,
        createdAt: now,
        createdBy: typeof options.createdBy === "string" && options.createdBy.trim() ? options.createdBy.trim() : "LENDER",
      },
    ],
    lastEventAt: now,
  };
}

function appendLenderBorrowerMessage(application, message, options = {}) {
  const normalizedMessage = typeof message === "string" ? message.trim() : "";
  if (!normalizedMessage) return application;
  const normalizedSubject =
    typeof options.subject === "string" && options.subject.trim()
      ? options.subject.trim()
      : "Message from lender";
  const channel = options.channel === "EMAIL" ? "EMAIL" : "PORTAL";
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const communications = Array.isArray(application.communications) ? [...application.communications] : [];
  communications.push(
    makeCommunication({
      threadId: makeThreadId(),
      from: "LENDER",
      channel,
      type: "REQUEST_INFO",
      subject: normalizedSubject,
      message: normalizedMessage,
      readByBorrower: false,
    })
  );
  return {
    ...application,
    communications,
    lastEventAt: now,
  };
}

function applyLenderDecision(existing, applications, decision, notes, options = {}) {
  const normalizedNotes = typeof notes === "string" ? notes.trim() : "";
  const communications = Array.isArray(existing.communications) ? [...existing.communications] : [];
  const existingIntake = normalizeUnderwritingIntake(existing.underwritingIntake);
  const underwritingPrefill = buildUnderwritingPrefill(existing, applications);
  const existingProfile = normalizeBorrowerProfile(existing.borrowerProfile, {
    fallbackEmail: existing.borrowerEmail || borrowerProfileDefaults.email,
    fallbackLlcName: existing?.underwritingIntake?.formData?.llcName || borrowerProfileDefaults.llcName,
    fallbackName: existing.borrowerName || "",
  });
  const existingBorrowerAccess = normalizeBorrowerAccess(existing.borrowerAccess, {
    borrowerEmail: existing.borrowerEmail || borrowerProfileDefaults.email,
    isProfileComplete: isBorrowerProfileComplete(existingProfile),
  });
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();

  if (decision === "REQUEST_INFO") {
    communications.push(
      makeCommunication({
        threadId: makeThreadId(),
        from: "LENDER",
        channel: "PORTAL",
        type: "REQUEST_INFO",
        subject: "Need additional information",
        message: normalizedNotes,
        readByBorrower: false,
      })
    );
  }

  const shouldTriggerUnderwriting =
    decision === "PRE_APPROVE" && existingIntake.status !== "PENDING" && existingIntake.status !== "SUBMITTED";
  const underwritingMessage = buildUnderwritingChecklistMessage(existing.id, existing.property);
  const underwritingSubject = `Underwriting conditions required: ${existing.id} - ${existing.property}`;
  const shouldPromptBorrowerAccessSetup =
    decision === "PRE_APPROVE" &&
    underwritingPrefill.isNewBorrower &&
    existingBorrowerAccess.status === "NOT_CREATED";
  const shouldSendUnderwritingConditionsEmail =
    shouldTriggerUnderwriting &&
    !shouldPromptBorrowerAccessSetup &&
    !existingIntake.notificationSentAt;
  const borrowerAccessSetupLink = buildBorrowerPortalLink({ loanId: existing.id, createAccess: 1, continue: 1 });
  const borrowerAccessSetupSubject = `Create borrower access: ${existing.id} - ${existing.property}`;
  const borrowerAccessSetupMessage = [
    "Your request was pre-approved.",
    "Complete your borrower information form first, then create your borrower portal login and submit underwriting continuation.",
    `Create access link: ${borrowerAccessSetupLink}`,
  ].join("\n");

  if (shouldPromptBorrowerAccessSetup) {
    communications.push(
      makeCommunication({
        threadId: makeThreadId(),
        from: "LENDER",
        channel: "PORTAL",
        type: "REQUEST_INFO",
        subject: borrowerAccessSetupSubject,
        message: borrowerAccessSetupMessage,
        readByBorrower: false,
      })
    );
  }
  if (shouldSendUnderwritingConditionsEmail) {
    communications.push(
      makeCommunication({
        threadId: makeThreadId(),
        from: "LENDER",
        channel: "PORTAL",
        type: "REQUEST_INFO",
        subject: underwritingSubject,
        message: underwritingMessage,
        readByBorrower: false,
      })
    );
  }

  const nextBorrowerAccess =
    decision === "PRE_APPROVE"
      ? {
          ...existingBorrowerAccess,
          email: existingBorrowerAccess.email || existing.borrowerEmail || borrowerProfileDefaults.email,
          invitedAt: shouldPromptBorrowerAccessSetup ? now : existingBorrowerAccess.invitedAt,
        }
      : existingBorrowerAccess;

  const updated = {
    ...existing,
    preApprovalDecision: decision,
    decisionNotes:
      decision === "REQUEST_INFO" || decision === "DECLINE"
        ? normalizedNotes || null
        : null,
    communications,
    currentStageIndex: decision === "PRE_APPROVE" ? Math.max(existing.currentStageIndex, 3) : existing.currentStageIndex,
    history:
      decision === "PRE_APPROVE" && !existing.history.includes("UNDERWRITING_STARTED")
        ? [...existing.history, "UNDERWRITING_STARTED"]
        : existing.history,
    underwritingIntake: shouldTriggerUnderwriting
      ? {
          status: "PENDING",
          requestedAt: now,
          submittedAt: null,
          notificationSentAt: existingIntake.notificationSentAt || now,
          formData: null,
          submissionHistory: existingIntake.submissionHistory || [],
        }
      : existingIntake,
    borrowerAccess: nextBorrowerAccess,
    lastEventAt: now,
  };

  return {
    updated,
    notifications: {
      normalizedNotes,
      communications,
      shouldSendUnderwritingConditionsEmail,
      shouldPromptBorrowerAccessSetup,
      borrowerAccessSetupLink,
    },
  };
}

async function sendPostDecisionBorrowerNotifications(decisionResult, decision) {
  const { updated, notifications } = decisionResult;
  const {
    normalizedNotes,
    communications,
    shouldSendUnderwritingConditionsEmail,
    shouldPromptBorrowerAccessSetup,
    borrowerAccessSetupLink,
  } = notifications;
  if (decision === "REQUEST_INFO") {
    const latestRequest = communications
      .filter((entry) => entry.from === "LENDER" && entry.type === "REQUEST_INFO")
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    await sendRequestInfoEmail({
      borrowerEmail: updated.borrowerEmail || borrowerProfileDefaults.email,
      borrowerName: updated.borrowerName || "Borrower",
      loanId: updated.id,
      question: normalizedNotes,
      subject: latestRequest?.subject || "Need additional information",
    });
  }
  if (decision === "DECLINE" && normalizedNotes) {
    await sendBorrowerDirectMessageEmail({
      borrowerEmail: updated.borrowerEmail || borrowerProfileDefaults.email,
      borrowerName: updated.borrowerName || "Borrower",
      loanId: updated.id,
      subject: `Loan update: ${updated.id} decision`,
      message: normalizedNotes,
    });
  }
  if (shouldSendUnderwritingConditionsEmail) {
    await sendBorrowerUnderwritingConditionsEmail({
      borrowerEmail: updated.borrowerEmail || borrowerProfileDefaults.email,
      borrowerName: updated.borrowerName || "Borrower",
      loanId: updated.id,
      property: updated.property,
      portalLink: buildBorrowerPortalLink({ loanId: updated.id, continue: 1, createAccess: 1 }),
    });
  }
  if (shouldPromptBorrowerAccessSetup) {
    await sendBorrowerPreApprovalAccessEmail({
      borrowerEmail: updated.borrowerEmail || borrowerProfileDefaults.email,
      borrowerName: updated.borrowerName || "Borrower",
      loanId: updated.id,
      property: updated.property,
      portalLink: borrowerAccessSetupLink,
    });
  }
}

function renderLenderEmailActionPage({ title, subtitle = "", body = "", status = 200 }) {
  return {
    status,
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
      .wrap { max-width: 680px; margin: 40px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
      h1 { margin: 0 0 10px; font-size: 24px; }
      p { margin: 0 0 14px; color: #334155; }
      .muted { color: #64748b; font-size: 14px; }
      label { display: block; margin: 12px 0 6px; font-weight: 600; color: #0f172a; }
      input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 15px; }
      textarea { min-height: 120px; resize: vertical; }
      button { margin-top: 14px; background: #0f766e; color: #fff; border: 0; border-radius: 8px; padding: 10px 14px; font-size: 15px; cursor: pointer; }
      .danger { background: #b91c1c; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="muted">${escapeHtml(subtitle)}</p>` : ""}
      ${body}
    </div>
  </body>
</html>`,
  };
}

function getLenderEmailActionErrorPage(message, status = 400) {
  return renderLenderEmailActionPage({
    title: "Lender Email Action",
    subtitle: "This action link is unavailable.",
    body: `<p>${escapeHtml(message)}</p>`,
    status,
  });
}

app.get("/api/workflows/health", async (_req, res) => {
  try {
    const applications = await readApplications();
    return res.json({ status: "ok", applicationCount: applications.length });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/workflows/docs", (_req, res) => {
  return res.json({
    name: "LendFlow Workflow API",
    endpoints: {
      listApplications: "GET /api/workflows/applications",
      submitApplication: "POST /api/workflows/applications",
      submitApplicationAlias: "POST /api/workflows/applications/submit",
      pushEvent: "POST /api/workflows/applications/:id/events",
      borrowerInitiateMessage: "POST /api/workflows/applications/:id/message",
      borrowerReply: "POST /api/workflows/applications/:id/reply",
      lenderPipeline: "GET /api/workflows/lender/pipeline",
      lenderPipelineDetail: "GET /api/workflows/lender/pipeline/:id",
      underwritingSummaryList: "GET /api/workflows/underwriting/summary",
      underwritingSummaryDetail: "GET /api/workflows/underwriting/summary/:id",
      preApprovalDecision: "POST /api/workflows/lender/pipeline/:id/decision",
      lenderComment: "POST /api/workflows/lender/pipeline/:id/comment",
      lenderBorrowerMessage: "POST /api/workflows/lender/pipeline/:id/message",
      lenderReply: "POST /api/workflows/lender/pipeline/:id/reply",
      lenderValuationInput: "GET/PUT /api/workflows/lender/valuation-input/:id",
      lenderEmailActions: "GET/POST /api/workflows/lender/email-actions/:id/:action?exp=...&sig=...",
      lenderDocumentPreview:
        "GET /api/workflows/lender/document-preview/:id/:group/:index?exp=...&sig=...",
      lenderDocumentViewer:
        "GET /api/workflows/lender/document-viewer/:id/:group/:index?exp=...&sig=...",
      lenderConditionsDocument:
        "GET /api/workflows/lender/conditions-document/:id/:packageId/:fileId",
      lenderLlcDocumentsViewer:
        "GET /api/workflows/lender/llc-documents/:id",
      underwritingSettings: "GET /api/workflows/underwriting/settings",
      updateUnderwritingSettings: "PUT /api/workflows/underwriting/settings",
      submitUnderwritingIntake: "POST /api/workflows/applications/:id/underwriting-intake",
      submitBorrowerConditions: "POST /api/workflows/applications/:id/conditions",
      createBorrowerAccess: "POST /api/workflows/applications/:id/borrower-access",
    },
    sampleSubmitPayload: {
      borrowerFirstName: "Michael",
      borrowerMiddleName: "A",
      borrowerLastName: "Chen",
      borrowerEmail: "michael.chen@email.com",
      llcName: "MC Capital Ventures LLC",
      property: "999 Demo Avenue, Austin, TX",
      type: "Purchase",
      amount: 420000,
      purchaseDetails: {
        purchasePrice: "385000",
        rehabBudget: "60000",
        arv: "575000",
        compsValidationNote: "Borrower provided COMPS.",
        compsFiles: ["comp-1.pdf"],
        propertyPhotos: ["front.jpg", "kitchen.jpg"],
        purchaseContractFiles: ["purchase-contract.pdf"],
        scopeOfWorkFiles: ["itemized-rehab-scope.pdf"],
        exitStrategy: "Fix and Flip",
        targetClosingDate: "2026-03-31",
      },
    },
  });
});

app.get("/api/workflows/underwriting/settings", async (_req, res) => {
  const settings = await readUnderwritingSettings();
  return res.json({ settings });
});

app.put("/api/workflows/underwriting/settings", async (req, res) => {
  const payload =
    req.body && typeof req.body === "object" && req.body.settings && typeof req.body.settings === "object"
      ? req.body.settings
      : req.body;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "settings payload is required" });
  }
  const settings = await writeUnderwritingSettings(payload);
  return res.json({ settings });
});

app.get("/api/workflows/applications", async (_req, res) => {
  const applications = await readApplications();
  return res.json({ applications: applications.map((application) => withComputed(application, applications)) });
});

app.get("/api/workflows/underwriting/summary", async (_req, res) => {
  const applications = await readApplications();
  const summaries = applications
    .filter((application) => {
      const intake = normalizeUnderwritingIntake(application.underwritingIntake);
      return application.currentStageIndex >= 3 || intake.status === "PENDING" || intake.status === "SUBMITTED";
    })
    .sort((a, b) => b.lastEventAt - a.lastEventAt)
    .map((application) => buildUnderwritingCaseSummary(application, applications));
  return res.json({ summaries });
});

app.get("/api/workflows/underwriting/summary/:id", async (req, res) => {
  const { id } = req.params;
  const applications = await readApplications();
  const found = applications.find((application) => application.id === id);
  if (!found) {
    return res.status(404).json({ error: "Application not found" });
  }
  return res.json({ summary: buildUnderwritingCaseSummary(found, applications) });
});

async function handleCreateApplication(req, res) {
  const {
    property,
    type,
    amount,
    purchaseDetails,
    borrowerName,
    borrowerFirstName,
    borrowerMiddleName,
    borrowerLastName,
    borrowerEmail,
    llcName,
    llcSameAsOnFile,
    llcStateRecorded,
    llcDocs,
  } = req.body || {};
  const numericAmount = Number(amount);

  if (!property || typeof property !== "string") {
    return res.status(400).json({ error: "property is required" });
  }

  if (!type || typeof type !== "string") {
    return res.status(400).json({ error: "type is required" });
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const resolvedFirstName =
    typeof borrowerFirstName === "string" && borrowerFirstName.trim()
      ? borrowerFirstName.trim()
      : borrowerProfileDefaults.firstName;
  const resolvedMiddleName = typeof borrowerMiddleName === "string" ? borrowerMiddleName.trim() : "";
  const resolvedLastName =
    typeof borrowerLastName === "string" && borrowerLastName.trim()
      ? borrowerLastName.trim()
      : borrowerProfileDefaults.lastName;
  const providedEmail = typeof borrowerEmail === "string" ? borrowerEmail.trim() : "";
  if (providedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(providedEmail)) {
    return res.status(400).json({ error: "borrowerEmail must be a valid email" });
  }
  const resolvedEmail = providedEmail || borrowerProfileDefaults.email;
  const resolvedLlcName =
    typeof llcName === "string" && llcName.trim() ? llcName.trim() : borrowerProfileDefaults.llcName;
  const resolvedLlcStateRecorded = typeof llcStateRecorded === "string" ? llcStateRecorded.trim() : "";
  const normalizedLlcDocs = normalizeLlcDocs(llcDocs);
  const isLlcOnFileSelection = llcSameAsOnFile !== false;
  if (!isLlcOnFileSelection) {
    if (!resolvedLlcStateRecorded) {
      return res.status(400).json({ error: "State where the LLC is registered is required for a new LLC." });
    }
    const submittedDocTypes = new Set(normalizedLlcDocs.map((doc) => doc.docType));
    for (const requiredDocType of requiredLlcDocTypes) {
      if (!submittedDocTypes.has(requiredDocType)) {
        return res.status(400).json({
          error: `Missing LLC document: ${requiredDocType.replace(/_/g, " ").toLowerCase()}.`,
        });
      }
    }
  }

  const normalizedPurchaseDetails = requiresPurchaseDetails(type) ? normalizePurchaseDetails(purchaseDetails) : null;
  const missingPurchaseItems = requiresPurchaseDetails(type) ? getMissingPurchaseItems(normalizedPurchaseDetails) : [];

  const applications = await readApplications();
  const now = Date.now();
  const communications = [];
  for (const item of missingPurchaseItems) {
    const subject = `Need ${item}`;
    const message = `Need ${item} to continue reviewing your loan application. Please reply in the borrower portal with the requested information.`;
    communications.push(
      makeCommunication({
        from: "LENDER",
        channel: "PORTAL",
        type: "REQUEST_INFO",
        subject,
        message,
        readByBorrower: false,
      })
    );
  }

  const computedBorrowerName =
    typeof borrowerName === "string" && borrowerName.trim()
      ? borrowerName.trim()
      : [resolvedFirstName, resolvedMiddleName, resolvedLastName].filter(Boolean).join(" ");
  const borrowerProfile = normalizeBorrowerProfile(
    {
      firstName: resolvedFirstName,
      middleName: resolvedMiddleName,
      lastName: resolvedLastName,
      email: resolvedEmail,
      llcName: resolvedLlcName,
    },
    {
      fallbackEmail: resolvedEmail,
      fallbackLlcName: resolvedLlcName,
      fallbackName: computedBorrowerName,
    }
  );

  const created = {
    id: nextLoanId(applications),
    borrowerName: computedBorrowerName,
    property: property.trim(),
    type,
    amount: numericAmount,
    currentStageIndex: 0,
    createdAt: now,
    lastEventAt: now,
    history: ["APPLICATION_SUBMITTED"],
    purchaseDetails: normalizedPurchaseDetails,
    borrowerEmail: resolvedEmail,
    borrowerProfile,
    llcName: resolvedLlcName,
    llcStateRecorded: resolvedLlcStateRecorded,
    llcSameAsOnFile: isLlcOnFileSelection,
    llcDocs: normalizedLlcDocs,
    borrowerAccess: {
      status: "NOT_CREATED",
      email: resolvedEmail,
      invitedAt: null,
      createdAt: null,
      profileCompletedAt: null,
    },
    communications,
    underwritingIntake: normalizeUnderwritingIntake(null),
    preApprovalDecision: "PENDING",
    decisionNotes: null,
  };

  const updatedList = [created, ...applications];
  await writeApplications(updatedList);
  for (const entry of communications) {
    await sendRequestInfoEmail({
      borrowerEmail: created.borrowerEmail,
      borrowerName: created.borrowerName,
      loanId: created.id,
      question: entry.message,
      subject: entry.subject,
    });
  }
  await sendBorrowerSubmissionPreApprovalEmail({
    borrowerEmail: created.borrowerEmail,
    borrowerName: created.borrowerName,
    loanId: created.id,
    property: created.property,
  });
  await sendLenderNewRequestEmail(created);
  return res.status(201).json({ application: withComputed(created, updatedList) });
}

app.post("/api/workflows/applications", handleCreateApplication);
app.post("/api/workflows/applications/submit", handleCreateApplication);

app.put("/api/workflows/applications/:id", async (req, res) => {
  const { id } = req.params;
  const {
    property,
    type,
    amount,
    purchaseDetails,
    borrowerName,
    borrowerFirstName,
    borrowerMiddleName,
    borrowerLastName,
    borrowerEmail,
    llcName,
    llcStateRecorded,
    llcSameAsOnFile,
    llcDocs,
  } = req.body || {};

  if (!property || typeof property !== "string" || !property.trim()) {
    return res.status(400).json({ error: "property is required" });
  }
  if (!type || typeof type !== "string") {
    return res.status(400).json({ error: "type is required" });
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const normalizedPurchaseDetails = requiresPurchaseDetails(type) ? normalizePurchaseDetails(purchaseDetails) : null;

  const existing = applications[index];
  const updatedBorrowerName =
    typeof borrowerName === "string" && borrowerName.trim()
      ? borrowerName.trim()
      : [
          typeof borrowerFirstName === "string" ? borrowerFirstName.trim() : "",
          typeof borrowerMiddleName === "string" ? borrowerMiddleName.trim() : "",
          typeof borrowerLastName === "string" ? borrowerLastName.trim() : "",
        ]
          .filter(Boolean)
          .join(" ") || existing.borrowerName;

  const updated = {
    ...existing,
    property: property.trim(),
    type,
    amount: numericAmount,
    borrowerName: updatedBorrowerName,
    borrowerEmail:
      typeof borrowerEmail === "string" && borrowerEmail.trim() ? borrowerEmail.trim() : existing.borrowerEmail,
    borrowerFirstName:
      typeof borrowerFirstName === "string" && borrowerFirstName.trim()
        ? borrowerFirstName.trim()
        : existing.borrowerFirstName,
    borrowerMiddleName:
      typeof borrowerMiddleName === "string" ? borrowerMiddleName.trim() : existing.borrowerMiddleName || "",
    borrowerLastName:
      typeof borrowerLastName === "string" && borrowerLastName.trim()
        ? borrowerLastName.trim()
        : existing.borrowerLastName,
    llcName: typeof llcName === "string" && llcName.trim() ? llcName.trim() : existing.llcName,
    llcStateRecorded:
      typeof llcStateRecorded === "string" && llcStateRecorded.trim()
        ? llcStateRecorded.trim()
        : existing.llcStateRecorded,
    llcSameAsOnFile:
      typeof llcSameAsOnFile === "boolean" ? llcSameAsOnFile : typeof existing.llcSameAsOnFile === "boolean" ? existing.llcSameAsOnFile : true,
    llcDocs: Array.isArray(llcDocs) ? normalizeLlcDocs(llcDocs) : existing.llcDocs,
    purchaseDetails: normalizedPurchaseDetails ?? existing.purchaseDetails,
    lastEventAt: Date.now(),
    history: [...existing.history, "APPLICATION_UPDATED"],
  };

  applications[index] = updated;
  await writeApplications(applications);
  return res.json({ application: withComputed(updated, applications) });
});

app.post("/api/workflows/applications/:id/events", async (req, res) => {
  const { id } = req.params;
  const { eventType } = req.body || {};

  if (!eventType || typeof eventType !== "string") {
    return res.status(400).json({ error: "eventType is required" });
  }

  const targetStage = eventStageMap[eventType];
  if (typeof targetStage !== "number") {
    return res.status(400).json({ error: `Unsupported eventType: ${eventType}` });
  }

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  if (targetStage <= existing.currentStageIndex) {
    return res.status(409).json({ error: "Application is already at or beyond that stage" });
  }

  const nextExpectedEvent = getNextEvent(existing.currentStageIndex);
  if (nextExpectedEvent !== eventType) {
    return res.status(409).json({ error: `Next expected event is ${nextExpectedEvent}` });
  }

  const existingProfile = normalizeBorrowerProfile(existing.borrowerProfile, {
    fallbackEmail: existing.borrowerEmail || borrowerProfileDefaults.email,
    fallbackLlcName: existing?.underwritingIntake?.formData?.llcName || borrowerProfileDefaults.llcName,
    fallbackName: existing.borrowerName || "",
  });
  const existingIntake = normalizeUnderwritingIntake(existing.underwritingIntake);
  const existingBorrowerAccess = normalizeBorrowerAccess(existing.borrowerAccess, {
    borrowerEmail: existing.borrowerEmail || borrowerProfileDefaults.email,
    isProfileComplete: isBorrowerProfileComplete(existingProfile),
  });
  const underwritingPrefill = buildUnderwritingPrefill(existing, applications);
  const movedToInUnderwriting = targetStage === 3 && existing.currentStageIndex < 3;
  const underwritingMessage = buildUnderwritingChecklistMessage(existing.id, existing.property);
  const underwritingSubject = `Underwriting conditions required: ${existing.id} - ${existing.property}`;
  const shouldSendUnderwritingConditionsEmail = movedToInUnderwriting && !existingIntake.notificationSentAt;
  const isApprovalEvent = eventType === "UNDERWRITING_APPROVED";
  const shouldPromptBorrowerAccessSetup =
    isApprovalEvent &&
    underwritingPrefill.isNewBorrower &&
    existingBorrowerAccess.status === "NOT_CREATED" &&
    !existingBorrowerAccess.invitedAt;
  const shouldMarkPreApproved = isApprovalEvent && existing.preApprovalDecision !== "PRE_APPROVE";
  const borrowerAccessSetupLink = buildBorrowerPortalLink({ loanId: existing.id, createAccess: 1, continue: 1 });
  const borrowerAccessSetupSubject = `Create borrower access: ${existing.id} - ${existing.property}`;
  const borrowerAccessSetupMessage = [
    "Your request was pre-approved.",
    "Complete your borrower information form first, then create your borrower portal login and submit underwriting continuation.",
    `Create access link: ${borrowerAccessSetupLink}`,
  ].join("\n");
  const communications = Array.isArray(existing.communications) ? [...existing.communications] : [];
  if (shouldSendUnderwritingConditionsEmail) {
    communications.push(
      makeCommunication({
        threadId: makeThreadId(),
        from: "LENDER",
        channel: "PORTAL",
        type: "REQUEST_INFO",
        subject: underwritingSubject,
        message: underwritingMessage,
        readByBorrower: false,
      })
    );
  }
  if (shouldPromptBorrowerAccessSetup) {
    communications.push(
      makeCommunication({
        from: "LENDER",
        channel: "PORTAL",
        type: "REQUEST_INFO",
        subject: borrowerAccessSetupSubject,
        message: borrowerAccessSetupMessage,
        readByBorrower: false,
      })
    );
  }
  const now = Date.now();
  const updated = {
    ...existing,
    currentStageIndex: targetStage,
    preApprovalDecision: shouldMarkPreApproved ? "PRE_APPROVE" : existing.preApprovalDecision,
    decisionNotes: shouldMarkPreApproved ? null : existing.decisionNotes,
    communications,
    borrowerAccess: shouldPromptBorrowerAccessSetup
      ? {
          ...existingBorrowerAccess,
          email: existingBorrowerAccess.email || existing.borrowerEmail || borrowerProfileDefaults.email,
          invitedAt: now,
        }
      : existing.borrowerAccess,
    underwritingIntake: shouldSendUnderwritingConditionsEmail
      ? {
          ...existingIntake,
          requestedAt: existingIntake.requestedAt || now,
          notificationSentAt: now,
        }
      : existing.underwritingIntake,
    lastEventAt: now,
    history: [...existing.history, eventType],
  };

  applications[index] = updated;
  await writeApplications(applications);
  if (shouldPromptBorrowerAccessSetup) {
    await sendBorrowerPreApprovalAccessEmail({
      borrowerEmail: updated.borrowerEmail || "michael.chen@email.com",
      borrowerName: updated.borrowerName || "Borrower",
      loanId: updated.id,
      property: updated.property,
      portalLink: borrowerAccessSetupLink,
    });
  }
  if (shouldSendUnderwritingConditionsEmail) {
    await sendBorrowerUnderwritingConditionsEmail({
      borrowerEmail: updated.borrowerEmail || borrowerProfileDefaults.email,
      borrowerName: updated.borrowerName || "Borrower",
      loanId: updated.id,
      property: updated.property,
      portalLink: buildBorrowerPortalLink({ loanId: updated.id, continue: 1, createAccess: 1 }),
    });
  }
  return res.json({ application: withComputed(updated, applications) });
});

app.get("/api/workflows/lender/pipeline", async (_req, res) => {
  const applications = await readApplications();
  const pipeline = [...applications]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((application) => toLenderPipelineRecord(application));
  return res.json({ pipeline });
});

app.get("/api/workflows/lender/pipeline/:id", async (req, res) => {
  const { id } = req.params;
  const applications = await readApplications();
  const found = applications.find((application) => application.id === id);
  if (!found) {
    return res.status(404).json({ error: "Application not found" });
  }
  return res.json({ pipelineRecord: toLenderPipelineRecord(found) });
});

app.get("/api/workflows/lender/valuation-input/:id", async (req, res) => {
  const { id } = req.params;
  const applications = await readApplications();
  const found = applications.find((application) => application.id === id);
  if (!found) {
    return res.status(404).json({ error: "Application not found" });
  }
  return res.json({ valuationInput: buildValuationInputSnapshot(found) });
});

app.put("/api/workflows/lender/valuation-input/:id", async (req, res) => {
  const { id } = req.params;
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const updatedByRoleRaw = typeof payload.updatedByRole === "string" ? payload.updatedByRole.trim() : "LOAN_OFFICER";
  const updatedByRole = updatedByRoleRaw.toUpperCase();
  if (!valuationInputRoles.has(updatedByRole)) {
    return res.status(400).json({ error: "updatedByRole must be LOAN_OFFICER or EVALUATOR." });
  }

  const valuesSource = payload.values && typeof payload.values === "object" ? payload.values : payload;
  const patch = extractValuationInputPatch(valuesSource);
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "At least one valuation field is required." });
  }

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  const statusLabel = existing.currentStageIndex === 0 ? "New Loan Request" : getApplicationStatus(existing);
  if (!underwritingValuationEditableStatuses.has(statusLabel)) {
    return res.status(409).json({ error: `Valuation form is editable only during underwriting. Current status: ${statusLabel}.` });
  }
  if (!requiresPurchaseDetails(existing.type)) {
    return res.status(409).json({ error: "This loan type does not support valuation inputs." });
  }

  const now = Date.now();
  const normalizedPurchaseDetails = normalizePurchaseDetails(existing.purchaseDetails);
  const mergedPurchaseDetails = { ...normalizedPurchaseDetails, ...patch };
  const valuationValues = extractValuationInputValues(mergedPurchaseDetails);
  const existingTrail = normalizeValuationInputTrail(existing.valuationInputTrail);
  const trailEntry = {
    id: `valuation-input-${now}-${Math.random().toString(16).slice(2, 8)}`,
    updatedAt: now,
    updatedBy: updatedByRole,
    values: valuationValues,
  };
  const updated = {
    ...existing,
    purchaseDetails: mergedPurchaseDetails,
    valuationInputTrail: [trailEntry, ...existingTrail].slice(0, 50),
    lastEventAt: now,
    history: [...(Array.isArray(existing.history) ? existing.history : []), "UNDERWRITING_VALUATION_UPDATED"],
  };

  applications[index] = updated;
  await writeApplications(applications);

  return res.json({
    valuationInput: buildValuationInputSnapshot(updated),
    pipelineRecord: toLenderPipelineRecord(updated),
  });
});

app.post("/api/property/attom/subject", async (req, res) => {
  const { address1, city, state, zip } = req.body || {};
  if (!address1 || !city || !state) {
    return res.status(400).json({ error: "address1, city, and state are required." });
  }

  const cacheKey = normalizeAddressKey({ address1, city, state, zip });
  const now = Date.now();
  const cached = attomSubjectCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return res.json(cached.payload);
  }

  try {
    const [market, ownerDetail, saleSnap] = await Promise.all([
      getMarketProfiles(address1, city, state, zip),
      getDetailOwner(address1, city, state, zip),
      getSaleSnapshot(address1, city, state, zip),
    ]);
    const sources = {
      ...(market.sources || {}),
      detailowner_url: ownerDetail?.sourceUrl || null,
      sale_snapshot_url: saleSnap?.url || null,
    };
    const notes = [];
    let needs_review = Boolean(market.needs_review || ownerDetail?.needs_review);

    const land = market.marketValues?.land ?? null;
    const impr = market.marketValues?.impr ?? null;
    const total = market.marketValues?.total ?? null;
    let total_market_value = total;
    if ((land !== null && impr !== null) && (total_market_value === null || total_market_value <= 0)) {
      total_market_value = land + impr;
    }
    if (total_market_value === null) {
      notes.push("Market total value unavailable from ATTOM for this property.");
    }
    if (total !== null && land !== null && impr !== null) {
      const diff = Math.abs(total - (land + impr));
      if (diff / Math.max(total, land + impr, 1) > 0.01) {
        needs_review = true;
        notes.push("ATTOM market total != land + improvement; verify county values.");
      }
    }

    const saleMatch = (saleSnap?.list || []).find(() => true); // best match already chosen earlier? choose first
    const salePrice = pickSalePrice(saleMatch?.sale || saleMatch?.salesearch || saleMatch) ?? null;
    const saleDate = pickSaleDate(saleMatch?.sale || saleMatch?.salesearch || saleMatch) ?? null;
    if ((saleSnap?.list || []).length > 1 && !saleMatch) needs_review = true;

    const owner_name = ownerDetail?.owner_name ?? null;

    let avm_value = null;
    try {
      const avm = await getSubjectPropertyAVM(address1, city, state, zip);
      avm_value = avm.avm_value ?? null;
      sources.avm_url = avm.sourceUrl || null;
      if (Array.isArray(avm.notes)) notes.push(...avm.notes);
    } catch {
      notes.push("AVM unavailable for this ATTOM plan or property.");
    }

    const payload = {
      address_matched: Boolean(market.address_matched || ownerDetail?.owner_name),
      owner_name,
      total_market_value,
      land_appraisal_value: land,
      building_appraisal_value: impr,
      last_sale_price: salePrice,
      last_sale_date: saleDate,
      sources,
      retrieved_at: new Date().toISOString(),
      needs_review,
      notes,
      raw_property: market.raw_property || ownerDetail?.raw_property || null,
      attempts: [...(market.attempts || []), ...(ownerDetail?.attempts || []), { endpoint: "/sale/snapshot", url: saleSnap?.url }],
      avm_value,
    };

    attomSubjectCache.set(cacheKey, { payload, expiresAt: now + ATTOM_SUBJECT_CACHE_TTL_MS });
    return res.json(payload);
  } catch (error) {
    const status = error?.status;
    const message = error instanceof Error ? error.message : "ATTOM subject property lookup failed.";
    return res.status(status && Number(status) >= 400 && Number(status) < 600 ? status : 502).json({ error: message });
  }
});

app.post("/api/rentometer/average", async (req, res) => {
  const body = req.body || {};
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const bedrooms = Number(body.bedrooms);
  const bathsRaw = sanitizeBaths(body.baths || "");
  const buildingTypeRaw = body.building_type || body.buildingType || "";
  const buildingType = sanitizeBuildingType(buildingTypeRaw);
  const radius = Number(body.radius);
  const force = Boolean(body.force);

  if (!address || !Number.isFinite(bedrooms) || bedrooms <= 0) {
    return res.status(400).json({ error: "address and bedrooms are required" });
  }
  if (!rentometerApiKey) {
    return res.status(500).json({ error: "Rentometer API key is not configured." });
  }

  const cacheKey = [address.toUpperCase(), bedrooms, bathsRaw, buildingType, Number.isFinite(radius) && radius > 0 ? radius : "2"].join("|");
  const now = Date.now();
  const cached = rentometerCache.get(cacheKey);
  if (!force && cached && cached.expiresAt > now) {
    return res.json(cached.payload);
  }

  try {
    const url = new URL("https://www.rentometer.com/api/v1/summary");
    url.searchParams.set("api_key", rentometerApiKey);
    url.searchParams.set("address", address);
    url.searchParams.set("bedrooms", String(bedrooms));
    // Match QuickView default radius if not provided
    url.searchParams.set("radius", Number.isFinite(radius) && radius > 0 ? String(radius) : "2");
    if (bathsRaw) url.searchParams.set("baths", bathsRaw);
    if (buildingType) url.searchParams.set("building_type", buildingType);

    const response = await fetch(url.toString(), { method: "GET", headers: { accept: "application/json" } });
    const text = await response.text();
    if (!response.ok) {
      const message = text || `Rentometer request failed (${response.status})`;
      return res.status(response.status).json({ error: message });
    }
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      return res.status(502).json({ error: "Rentometer returned invalid JSON." });
    }

    const payload = mapRentometerSummary(data, { retrievedAt: new Date().toISOString() });
    rentometerCache.set(cacheKey, { payload, expiresAt: now + RENTOMETER_CACHE_TTL_MS });
    console.log("[rentometer] query", {
      address,
      bedrooms,
      baths: bathsRaw || null,
      building_type: buildingType || null,
      radius: Number.isFinite(radius) && radius > 0 ? radius : 2,
      mean: payload.average_rent,
      notes: payload.notes,
    });
    return res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rentometer lookup failed.";
    return res.status(502).json({ error: message });
  }
});

app.post("/api/workflows/lender/valuation-input/:id/attom-autofill", async (req, res) => {
  try {
    const { id } = req.params;
    const applications = await readApplications();
    const index = applications.findIndex((item) => item.id === id);
    if (index < 0) return res.status(404).json({ error: "Application not found" });
    const appItem = applications[index];
    const addressOverride =
      req.body && typeof req.body.addressOverride === "string" ? req.body.addressOverride.trim() : "";
    const address = addressOverride || appItem.property || appItem.purchaseDetails?.address;
    if (!address) return res.status(400).json({ error: "Property address not available for this loan." });

    let attomProperty;
    try {
      attomProperty = await fetchAttomProperty(address);
    } catch (attomError) {
      const message =
        attomError instanceof Error && attomError.message
          ? attomError.message
          : "No Attom record found for this address.";
      const debugParams =
        attomError && typeof attomError === "object" && "lastParams" in attomError
          ? attomError.lastParams
          : null;
      return res.status(502).json({ error: message, attomParams: debugParams });
    }

    let fields = parseAttomToValuationFields(attomProperty);
    if (Object.keys(fields).length === 0) {
      return res.status(502).json({ error: "Attom returned no valuation fields for this address." });
    }

    const now = Date.now();
    const normalizedPurchaseDetails = normalizePurchaseDetails(appItem.purchaseDetails);
    const mergedPurchaseDetails = {
      ...normalizedPurchaseDetails,
      assessorValue: fields.assessorValue ?? normalizedPurchaseDetails.assessorValue,
      realtorComValue: fields.realtorComValue ?? normalizedPurchaseDetails.realtorComValue,
      currentOwner: fields.currentOwner ?? normalizedPurchaseDetails.currentOwner,
      lastSaleDate: fields.lastSaleDate ?? normalizedPurchaseDetails.lastSaleDate,
      lastSalePrice: fields.lastSalePrice ?? normalizedPurchaseDetails.lastSalePrice,
    };

    const valuationValues = extractValuationInputValues(mergedPurchaseDetails);
    const existingTrail = normalizeValuationInputTrail(appItem.valuationInputTrail);
    const trailEntry = {
      id: `valuation-input-${now}-${Math.random().toString(16).slice(2, 8)}`,
      updatedAt: now,
      updatedBy: "ATTOM",
      values: valuationValues,
    };

    const updated = {
      ...appItem,
      purchaseDetails: mergedPurchaseDetails,
      valuationInputTrail: [trailEntry, ...existingTrail].slice(0, 50),
      lastEventAt: now,
      history: [...(Array.isArray(appItem.history) ? appItem.history : []), "UNDERWRITING_VALUATION_UPDATED_ATTOM"],
    };

    applications[index] = updated;
    await writeApplications(applications);

    return res.json({
      valuationInput: buildValuationInputSnapshot(updated),
      pipelineRecord: toLenderPipelineRecord(updated),
      attomFields: fields,
      attomRaw: attomProperty || null,
    });
  } catch (error) {
    console.error("Attom autofill error", error);
    return res.status(500).json({ error: "Failed to auto-populate from Attom" });
  }
});

app.get("/api/workflows/lender/title-agent-form/:id", async (req, res) => {
  const { id } = req.params;
  const applications = await readApplications();
  const found = applications.find((application) => application.id === id);
  if (!found) {
    return res.status(404).json({ error: "Application not found" });
  }
  const form = normalizeTitleAgentForm(found.titleAgentForm || defaultTitleAgentForm);
  return res.json({ form });
});

app.put("/api/workflows/lender/title-agent-form/:id", async (req, res) => {
  const { id } = req.params;
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const formPatch = normalizeTitleAgentForm(payload);

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  const mergedForm = normalizeTitleAgentForm({ ...(existing.titleAgentForm || {}), ...formPatch, updatedAt: Date.now() });
  const updated = { ...existing, titleAgentForm: mergedForm, lastEventAt: Date.now() };
  applications[index] = updated;
  await writeApplications(applications);

  return res.json({ form: mergedForm });
});

app.get("/api/workflows/lender/evaluator-input/:id", async (req, res) => {
  const { id } = req.params;
  const applications = await readApplications();
  const found = applications.find((application) => application.id === id);
  if (!found) {
    return res.status(404).json({ error: "Application not found" });
  }
  return res.json({ evaluatorInput: buildEvaluatorInputSnapshot(found) });
});

app.put("/api/workflows/lender/evaluator-input/:id", async (req, res) => {
  const { id } = req.params;
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const updatedByRoleRaw = typeof payload.updatedByRole === "string" ? payload.updatedByRole.trim() : "EVALUATOR";
  const updatedByRole = updatedByRoleRaw.toUpperCase();
  if (!evaluatorInputRoles.has(updatedByRole)) {
    return res.status(400).json({ error: "updatedByRole must be EVALUATOR." });
  }

  const valuesSource = payload.values && typeof payload.values === "object" ? payload.values : payload;
  const patch = extractEvaluatorInputPatch(valuesSource);
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "At least one evaluator field is required." });
  }

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  const statusLabel = existing.currentStageIndex === 0 ? "New Loan Request" : getApplicationStatus(existing);
  if (!underwritingValuationEditableStatuses.has(statusLabel)) {
    return res
      .status(409)
      .json({ error: `Evaluator form is editable only during underwriting. Current status: ${statusLabel}.` });
  }
  if (!requiresPurchaseDetails(existing.type)) {
    return res.status(409).json({ error: "This loan type does not support evaluator inputs." });
  }

  const now = Date.now();
  const existingValues = normalizeEvaluatorInputValues(existing.evaluatorInput);
  const mergedValues = { ...existingValues, ...patch };
  const updated = {
    ...existing,
    evaluatorInput: mergedValues,
    evaluatorInputUpdatedAt: now,
    evaluatorInputUpdatedBy: updatedByRole,
    lastEventAt: now,
    history: [...(Array.isArray(existing.history) ? existing.history : []), "UNDERWRITING_EVALUATOR_UPDATED"],
  };

  applications[index] = updated;
  await writeApplications(applications);

  return res.json({
    evaluatorInput: buildEvaluatorInputSnapshot(updated),
    pipelineRecord: toLenderPipelineRecord(updated),
  });
});

app.post("/api/workflows/lender/pipeline/:id/decision", async (req, res) => {
  const { id } = req.params;
  const { decision, notes } = req.body || {};

  if (!decision || !validPreApprovalDecisions.has(decision)) {
    return res.status(400).json({ error: "decision must be PRE_APPROVE, DECLINE, or REQUEST_INFO" });
  }

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const normalizedNotes = typeof notes === "string" ? notes.trim() : "";
  if (decision === "REQUEST_INFO" && !normalizedNotes) {
    return res.status(400).json({ error: "A request comment is required when decision is REQUEST_INFO" });
  }

  const existing = applications[index];
  const decisionResult = applyLenderDecision(existing, applications, decision, normalizedNotes);
  const { updated } = decisionResult;

  applications[index] = updated;
  await writeApplications(applications);
  await sendPostDecisionBorrowerNotifications(decisionResult, decision);

  return res.json({ pipelineRecord: toLenderPipelineRecord(updated) });
});

app.post("/api/workflows/lender/pipeline/:id/comment", async (req, res) => {
  const { id } = req.params;
  const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
  if (!comment) {
    return res.status(400).json({ error: "comment is required" });
  }

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  const updated = appendLenderComment(existing, comment, { createdBy: "LENDER" });
  applications[index] = updated;
  await writeApplications(applications);
  return res.json({ pipelineRecord: toLenderPipelineRecord(updated) });
});

app.post("/api/workflows/lender/pipeline/:id/message", async (req, res) => {
  const { id } = req.params;
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  const updated = appendLenderBorrowerMessage(existing, message, { subject, channel: "EMAIL" });
  applications[index] = updated;
  await writeApplications(applications);
  await sendBorrowerDirectMessageEmail({
    borrowerEmail: updated.borrowerEmail || borrowerProfileDefaults.email,
    borrowerName: updated.borrowerName || "Borrower",
    loanId: updated.id,
    subject: subject || `Message from lender: Loan ${updated.id}`,
    message,
  });
  return res.json({ pipelineRecord: toLenderPipelineRecord(updated) });
});

function respondWithLenderEmailActionPage(res, page) {
  return res.status(page.status).setHeader("Content-Type", "text/html; charset=utf-8").send(page.html);
}

function resolveLenderEmailActionContext(req) {
  const { id, action } = req.params;
  const normalizedAction = typeof action === "string" ? action.trim().toLowerCase() : "";
  if (!id || !normalizedAction) {
    return { error: "Missing lender action route parameters." };
  }
  if (!new Set(["approve", "comment", "message", "deny"]).has(normalizedAction)) {
    return { error: `Unsupported lender action: ${normalizedAction}` };
  }
  const { exp, sig } = parseLenderEmailActionAuth(req);
  if (!verifyLenderEmailActionSignature(id, normalizedAction, exp, sig)) {
    return { error: "Action link is invalid or expired." };
  }
  return { id, action: normalizedAction, exp, sig };
}

function buildLenderEmailActionFormBody({ loanId, action, exp, sig, defaults = {} }) {
  const safeLoanId = escapeHtml(loanId);
  const safeActionUrl = escapeHtml(
    `/api/workflows/lender/email-actions/${encodeURIComponent(loanId)}/${encodeURIComponent(action)}?exp=${encodeURIComponent(exp)}&sig=${encodeURIComponent(sig)}`
  );
  if (action === "approve") {
    return `
      <p>Approve loan <strong>${safeLoanId}</strong> and move it to pre-approval.</p>
      <form method="post" action="${safeActionUrl}">
        <button type="submit">Approve Loan</button>
      </form>
    `;
  }
  if (action === "comment") {
    return `
      <p>Leave an internal lender comment for loan <strong>${safeLoanId}</strong>.</p>
      <form method="post" action="${safeActionUrl}">
        <label for="comment">Comment</label>
        <textarea id="comment" name="comment" required>${escapeHtml(defaults.comment || "")}</textarea>
        <button type="submit">Save Comment</button>
      </form>
    `;
  }
  if (action === "message") {
    return `
      <p>Send a borrower email update for loan <strong>${safeLoanId}</strong>.</p>
      <form method="post" action="${safeActionUrl}">
        <label for="subject">Subject (optional)</label>
        <input id="subject" name="subject" value="${escapeHtml(defaults.subject || "")}" />
        <label for="message">Message</label>
        <textarea id="message" name="message" required>${escapeHtml(defaults.message || "")}</textarea>
        <button type="submit">Send Message to Borrower</button>
      </form>
    `;
  }
  if (action === "deny") {
    return `
      <p>Deny loan <strong>${safeLoanId}</strong> and provide notes.</p>
      <form method="post" action="${safeActionUrl}">
        <label for="notes">Denial Notes</label>
        <textarea id="notes" name="notes" required>${escapeHtml(defaults.notes || "")}</textarea>
        <button type="submit" class="danger">Deny Loan</button>
      </form>
    `;
  }
  return `<p>No form is available for this action.</p>`;
}

app.get("/api/workflows/lender/email-actions/:id/:action", async (req, res) => {
  const context = resolveLenderEmailActionContext(req);
  if (context.error) {
    return respondWithLenderEmailActionPage(res, getLenderEmailActionErrorPage(context.error, 401));
  }
  const { id, action, exp, sig } = context;

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return respondWithLenderEmailActionPage(res, getLenderEmailActionErrorPage("Application not found.", 404));
  }

  const formTitle =
    action === "approve"
      ? "Approve Loan"
      : action === "comment"
      ? "Leave Lender Comment"
      : action === "message"
        ? "Message Borrower"
        : "Deny With Notes";
  return respondWithLenderEmailActionPage(
    res,
    renderLenderEmailActionPage({
      title: formTitle,
      subtitle: `Loan ${id}`,
      body: buildLenderEmailActionFormBody({ loanId: id, action, exp, sig }),
    })
  );
});

app.post("/api/workflows/lender/email-actions/:id/:action", async (req, res) => {
  const context = resolveLenderEmailActionContext(req);
  if (context.error) {
    return respondWithLenderEmailActionPage(res, getLenderEmailActionErrorPage(context.error, 401));
  }
  const { id, action, exp, sig } = context;

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return respondWithLenderEmailActionPage(res, getLenderEmailActionErrorPage("Application not found.", 404));
  }
  const existing = applications[index];

  if (action === "approve") {
    const decisionResult = applyLenderDecision(existing, applications, "PRE_APPROVE", "");
    applications[index] = decisionResult.updated;
    await writeApplications(applications);
    await sendPostDecisionBorrowerNotifications(decisionResult, "PRE_APPROVE");
    return respondWithLenderEmailActionPage(
      res,
      renderLenderEmailActionPage({
        title: "Loan Approved",
        subtitle: `Loan ${decisionResult.updated.id} has been moved to pre-approval.`,
        body: `<p>The decision has been recorded.</p>`,
      })
    );
  }

  if (action === "comment") {
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
    if (!comment) {
      return respondWithLenderEmailActionPage(
        res,
        renderLenderEmailActionPage({
          title: "Leave Lender Comment",
          subtitle: `Loan ${id}`,
          body: `<p>Please enter a comment before submitting.</p>${buildLenderEmailActionFormBody({
            loanId: id,
            action,
            exp,
            sig,
            defaults: { comment },
          })}`,
          status: 400,
        })
      );
    }
    const updated = appendLenderComment(existing, comment, { createdBy: "LENDER_EMAIL" });
    applications[index] = updated;
    await writeApplications(applications);
    return respondWithLenderEmailActionPage(
      res,
      renderLenderEmailActionPage({
        title: "Comment Saved",
        subtitle: `Loan ${id}`,
        body: `<p>Your lender comment was saved successfully.</p>`,
      })
    );
  }

  if (action === "message") {
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      return respondWithLenderEmailActionPage(
        res,
        renderLenderEmailActionPage({
          title: "Message Borrower",
          subtitle: `Loan ${id}`,
          body: `<p>Please enter a message before submitting.</p>${buildLenderEmailActionFormBody({
            loanId: id,
            action,
            exp,
            sig,
            defaults: { subject, message },
          })}`,
          status: 400,
        })
      );
    }
    const updated = appendLenderBorrowerMessage(existing, message, { subject, channel: "EMAIL" });
    applications[index] = updated;
    await writeApplications(applications);
    await sendBorrowerDirectMessageEmail({
      borrowerEmail: updated.borrowerEmail || borrowerProfileDefaults.email,
      borrowerName: updated.borrowerName || "Borrower",
      loanId: updated.id,
      subject: subject || `Message from lender: Loan ${updated.id}`,
      message,
    });
    return respondWithLenderEmailActionPage(
      res,
      renderLenderEmailActionPage({
        title: "Message Sent",
        subtitle: `Loan ${id}`,
        body: `<p>Your message was sent to the borrower email address.</p>`,
      })
    );
  }

  if (action === "deny") {
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
    if (!notes) {
      return respondWithLenderEmailActionPage(
        res,
        renderLenderEmailActionPage({
          title: "Deny With Notes",
          subtitle: `Loan ${id}`,
          body: `<p>Notes are required to deny this request.</p>${buildLenderEmailActionFormBody({
            loanId: id,
            action,
            exp,
            sig,
            defaults: { notes },
          })}`,
          status: 400,
        })
      );
    }
    const decisionResult = applyLenderDecision(existing, applications, "DECLINE", notes);
    applications[index] = decisionResult.updated;
    await writeApplications(applications);
    await sendPostDecisionBorrowerNotifications(decisionResult, "DECLINE");
    return respondWithLenderEmailActionPage(
      res,
      renderLenderEmailActionPage({
        title: "Loan Denied",
        subtitle: `Loan ${id}`,
        body: `<p>The denial and notes were saved. Borrower notification email was sent.</p>`,
      })
    );
  }

  return respondWithLenderEmailActionPage(res, getLenderEmailActionErrorPage("Unsupported action.", 400));
});

app.get("/api/workflows/lender/document-preview/:id/:group/:index", async (req, res) => {
  const { id, group, index } = req.params;
  const normalizedGroup = typeof group === "string" ? group.trim() : "";
  const normalizedIndex = Number(index);
  const { exp, sig } = parseLenderEmailActionAuth(req);

  if (!Object.prototype.hasOwnProperty.call(lenderDocumentPreviewGroups, normalizedGroup)) {
    return res.status(400).send("Unsupported document group.");
  }
  if (!verifyLenderDocumentPreviewSignature(id, normalizedGroup, normalizedIndex, exp, sig)) {
    return res.status(401).send("Preview link is invalid or expired.");
  }

  const applications = await readApplications();
  const found = applications.find((application) => application.id === id);
  if (!found) {
    return res.status(404).send("Application not found.");
  }

  const document = getLenderPreviewDocument(found, normalizedGroup, normalizedIndex);
  if (!document) {
    return res.status(404).send("Document not found.");
  }

  const parsed = parseDataUrlToBuffer(document.dataUrl);
  if (!parsed || !Buffer.isBuffer(parsed.buffer)) {
    return res.status(422).send("Document preview is unavailable.");
  }

  const safeFileName = (document.name || "document").replace(/[^A-Za-z0-9._-]/g, "_");
  res.setHeader("Content-Type", parsed.mimeType || document.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${safeFileName || "document"}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  return res.status(200).send(parsed.buffer);
});

app.get("/api/workflows/lender/document-viewer/:id/:group/:index", async (req, res) => {
  const { id, group, index } = req.params;
  const normalizedGroup = typeof group === "string" ? group.trim() : "";
  const normalizedIndex = Number(index);
  const { exp, sig } = parseLenderEmailActionAuth(req);
  const expiresAt = Number(exp);

  if (!Object.prototype.hasOwnProperty.call(lenderDocumentPreviewGroups, normalizedGroup)) {
    return res.status(400).send("Unsupported document group.");
  }
  if (!verifyLenderDocumentPreviewSignature(id, normalizedGroup, normalizedIndex, exp, sig)) {
    return res.status(401).send("Preview link is invalid or expired.");
  }

  const applications = await readApplications();
  const found = applications.find((application) => application.id === id);
  if (!found) {
    return res.status(404).send("Application not found.");
  }

  const document = getLenderPreviewDocument(found, normalizedGroup, normalizedIndex);
  if (!document) {
    return res.status(404).send("Document not found.");
  }
  const parsed = parseDataUrlToBuffer(document.dataUrl);
  if (!parsed || !Buffer.isBuffer(parsed.buffer)) {
    return res.status(422).send("Document preview is unavailable.");
  }

  const rawLink = buildLenderDocumentPreviewLink(id, normalizedGroup, normalizedIndex, { expiresAt });
  const safeRawLink = escapeHtml(rawLink);
  const safeName = escapeHtml(document.name || "Document");
  const groupLabel = escapeHtml(lenderDocumentPreviewGroups[normalizedGroup] || "Document");
  const mimeType = parsed.mimeType || document.contentType || "application/octet-stream";
  const safeMimeType = escapeHtml(mimeType);
  const dashboardLink = escapeHtml(buildLenderPortalLink({ loanId: id }));

  let navigationHtml = "";
  if (normalizedGroup === "propertyPhotos") {
    const purchaseDetails =
      found.purchaseDetails && typeof found.purchaseDetails === "object" ? found.purchaseDetails : null;
    const rawPhotos = Array.isArray(purchaseDetails?.propertyPhotos) ? purchaseDetails.propertyPhotos : [];
    const totalFiles = rawPhotos.length;
    if (totalFiles > 1) {
      const prevIndex = (normalizedIndex - 1 + totalFiles) % totalFiles;
      const nextIndex = (normalizedIndex + 1) % totalFiles;
      const prevViewerLink = escapeHtml(
        buildLenderDocumentViewerLink(id, normalizedGroup, prevIndex, { expiresAt })
      );
      const nextViewerLink = escapeHtml(
        buildLenderDocumentViewerLink(id, normalizedGroup, nextIndex, { expiresAt })
      );
      navigationHtml = `
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;">
          <a href="${prevViewerLink}" style="display:inline-block;padding:8px 14px;border:1px solid #cbd5e1;border-radius:999px;background:#f8fafc;color:#1e293b;text-decoration:none;font-weight:700;">&#8592; Back</a>
          <span style="display:inline-block;padding:8px 12px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;color:#475569;">Photo ${normalizedIndex + 1} of ${totalFiles}</span>
          <a href="${nextViewerLink}" style="display:inline-block;padding:8px 14px;border:1px solid #cbd5e1;border-radius:999px;background:#f8fafc;color:#1e293b;text-decoration:none;font-weight:700;">Next &#8594;</a>
        </div>
      `;
    }
  }

  const previewHtml =
    mimeType.startsWith("image/")
      ? `<img src="${safeRawLink}" alt="${safeName}" style="max-width:100%;max-height:66vh;object-fit:contain;border:1px solid #e2e8f0;border-radius:10px;background:#fff;" />`
      : mimeType === "application/pdf"
        ? `<iframe src="${safeRawLink}" title="${safeName}" style="width:100%;height:66vh;border:1px solid #e2e8f0;border-radius:10px;background:#fff;"></iframe>`
        : `
          <div style="border:1px dashed #cbd5e1;border-radius:10px;padding:22px;text-align:center;background:#f8fafc;">
            <p style="margin:0 0 8px;font-weight:700;color:#0f172a;">Preview is limited for this file type.</p>
            <p style="margin:0 0 12px;color:#475569;">MIME Type: ${safeMimeType}</p>
            <a href="${safeRawLink}" style="display:inline-block;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#1d4ed8;font-weight:700;text-decoration:underline;">Open File</a>
          </div>
        `;

  return res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Document Preview</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f1f5f9; color: #0f172a; }
      .wrap { max-width: 980px; margin: 24px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.12); padding: 18px; }
      .top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
      .meta { color: #475569; font-size: 14px; }
      .name { font-size: 22px; font-weight: 800; margin: 0; }
      .actions a { display: inline-block; margin-right: 8px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1d4ed8; text-decoration: underline; font-weight: 700; }
      .preview { display: flex; align-items: center; justify-content: center; min-height: 320px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="top">
        <div>
          <p class="meta">${groupLabel}</p>
          <p class="name">${safeName}</p>
        </div>
        <div class="actions">
          <a href="${safeRawLink}">Direct File</a>
          <a href="${dashboardLink}">Open Lender Dashboard</a>
        </div>
      </div>
      ${navigationHtml}
      <div class="preview">
        ${previewHtml}
      </div>
    </div>
  </body>
</html>`);
});

app.get("/api/workflows/lender/conditions-document/:id/:packageId/:fileId", async (req, res) => {
  const { id, packageId, fileId } = req.params;
  const applications = await readApplications();
  const found = applications.find((application) => application.id === id);
  if (!found) {
    return res.status(404).send("Application not found.");
  }

  const conditionsForm = normalizeBorrowerConditionsForm(found.conditionsForm);
  const documentPackage = normalizeConditionsDocumentPackage(conditionsForm?.documentPackage);
  if (!documentPackage || documentPackage.id !== packageId) {
    return res.status(404).send("Conditions document package not found.");
  }

  const packageFile = Array.isArray(documentPackage.files)
    ? documentPackage.files.find((file) => file.id === fileId)
    : null;
  if (!packageFile) {
    return res.status(404).send("Conditions document not found.");
  }

  const absoluteFilePath = resolveStoredDataPath(packageFile.relativePath);
  if (!absoluteFilePath) {
    return res.status(422).send("Stored document path is invalid.");
  }

  let fileBuffer;
  try {
    fileBuffer = await fs.readFile(absoluteFilePath);
  } catch {
    return res.status(404).send("Stored document file is unavailable.");
  }

  const safeFileName = (packageFile.name || "conditions-document").replace(/[^A-Za-z0-9._-]/g, "_");
  res.setHeader("Content-Type", packageFile.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${safeFileName || "conditions-document"}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  return res.status(200).send(fileBuffer);
});

app.get("/api/workflows/lender/llc-documents/:id", async (req, res) => {
  const { id } = req.params;
  const applications = await readApplications();
  const found = applications.find((application) => application.id === id);
  if (!found) {
    return res.status(404).send("Application not found.");
  }

  const summary = buildUnderwritingCaseSummary(found, applications);
  const llcDocumentsRaw = Array.isArray(summary?.linksAndDocuments?.documents)
    ? summary.linksAndDocuments.documents.filter((doc) => /llc document/i.test(`${doc.label || ""} ${doc.name || ""}`))
    : [];
  const hasNonDataLlcDocumentUrl = llcDocumentsRaw.some(
    (doc) => typeof doc.url === "string" && doc.url.trim() && !doc.url.trim().startsWith("data:")
  );
  const llcDocuments = hasNonDataLlcDocumentUrl
    ? llcDocumentsRaw.filter((doc) => typeof doc.url === "string" && doc.url.trim() && !doc.url.trim().startsWith("data:"))
    : llcDocumentsRaw;

  const borrowerName = escapeHtml(summary?.executive?.borrowerName || found.borrowerName || "Borrower");
  const llcName = escapeHtml(summary?.executive?.borrowerEntity || found.llcName || "LLC not specified");
  const loanId = escapeHtml(id);
  const dashboardLink = escapeHtml(buildLenderPortalLink({ loanId: id }));

  const listHtml =
    llcDocuments.length > 0
      ? llcDocuments
          .map((doc, index) => {
            const label = escapeHtml(doc.label || "LLC Document");
            const name = escapeHtml(doc.name || `llc-document-${index + 1}`);
            const url = typeof doc.url === "string" && doc.url.trim() ? escapeHtml(doc.url) : "";
            if (url) {
              return `<li style="margin:0 0 10px;"><a href="${url}" target="_blank" rel="noreferrer" style="color:#1d4ed8;text-decoration:underline;font-weight:700;">${label}: ${name}</a></li>`;
            }
            return `<li style="margin:0 0 10px;color:#475569;"><strong>${label}:</strong> ${name} (no preview URL)</li>`;
          })
          .join("")
      : `<li style="color:#475569;">No LLC documents were found for this loan.</li>`;

  return res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LLC Documents</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f1f5f9; color: #0f172a; }
      .wrap { max-width: 860px; margin: 24px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.12); padding: 20px; }
      h1 { margin: 0 0 6px; font-size: 24px; }
      .meta { margin: 0 0 4px; color: #475569; font-size: 14px; }
      ul { margin: 16px 0 0; padding-left: 18px; }
      .actions { margin-top: 16px; }
      .actions a { display: inline-block; margin-right: 8px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1d4ed8; text-decoration: underline; font-weight: 700; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>LLC Documents</h1>
      <p class="meta">Loan ID: ${loanId}</p>
      <p class="meta">Borrower: ${borrowerName}</p>
      <p class="meta">LLC: ${llcName}</p>
      <ul>${listHtml}</ul>
      <div class="actions">
        <a href="${dashboardLink}">Open Lender Dashboard</a>
      </div>
    </div>
  </body>
</html>`);
});

app.post("/api/workflows/applications/:id/borrower-access", async (req, res) => {
  const { id } = req.params;
  const { email, password, confirmPassword } = req.body || {};

  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  const normalizedPassword = typeof password === "string" ? password : "";
  const normalizedConfirmPassword = typeof confirmPassword === "string" ? confirmPassword : "";

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: "A valid email is required to create borrower access." });
  }
  if (
    !normalizedPassword ||
    normalizedPassword.length < 6 ||
    !/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/.test(normalizedPassword)
  ) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters and contain only letters and numbers, including at least one of each." });
  }
  if (normalizedPassword !== normalizedConfirmPassword) {
    return res.status(400).json({ error: "Password confirmation does not match." });
  }

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  if (existing.preApprovalDecision === "DECLINE") {
    return res.status(409).json({ error: "Borrower access cannot be created for a declined request." });
  }

  const existingProfile = normalizeBorrowerProfile(existing.borrowerProfile, {
    fallbackEmail: existing.borrowerEmail || borrowerProfileDefaults.email,
    fallbackLlcName: existing?.underwritingIntake?.formData?.llcName || borrowerProfileDefaults.llcName,
    fallbackName: existing.borrowerName || "",
  });
  const existingBorrowerAccess = normalizeBorrowerAccess(existing.borrowerAccess, {
    borrowerEmail: existing.borrowerEmail || borrowerProfileDefaults.email,
    isProfileComplete: isBorrowerProfileComplete(existingProfile),
  });
  const now = Date.now();
  const profileComplete = isBorrowerProfileComplete(existingProfile);
  const nextStatus = profileComplete ? "PROFILE_COMPLETED" : "ACCESS_CREATED";
  const nextBorrowerAccess = {
    ...existingBorrowerAccess,
    status: nextStatus,
    email: normalizedEmail,
    invitedAt: existingBorrowerAccess.invitedAt || now,
    createdAt: existingBorrowerAccess.createdAt || now,
    profileCompletedAt:
      nextStatus === "PROFILE_COMPLETED"
        ? existingBorrowerAccess.profileCompletedAt || now
        : existingBorrowerAccess.profileCompletedAt || null,
  };
  const communications = Array.isArray(existing.communications) ? [...existing.communications] : [];
  communications.push(
    makeCommunication({
      from: "BORROWER",
      channel: "PORTAL",
      type: "REPLY",
      subject: "Borrower access created",
      message:
        nextStatus === "PROFILE_COMPLETED"
          ? `Borrower created portal access and profile is complete for ${existing.id}.`
          : `Borrower created portal access for ${existing.id}. Profile completion is still required.`,
      readByBorrower: true,
    })
  );

  const updated = {
    ...existing,
    borrowerEmail: normalizedEmail,
    borrowerProfile: {
      ...existingProfile,
      email: normalizedEmail,
    },
    borrowerAccess: nextBorrowerAccess,
    communications,
    lastEventAt: now,
  };

  applications[index] = updated;
  await writeApplications(applications);
  return res.json({ application: withComputed(updated, applications) });
});

app.post("/api/workflows/applications/:id/reply", async (req, res) => {
  const { id } = req.params;
  const { message, attachments, threadId } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const parsedAttachments = Array.isArray(attachments) ? attachments : [];
  for (const file of parsedAttachments) {
    if (!file || typeof file !== "object") {
      return res.status(400).json({ error: "attachments must be an array of files" });
    }
    if (!file.name || typeof file.name !== "string") {
      return res.status(400).json({ error: "each attachment requires a name" });
    }
    if (!file.dataUrl || typeof file.dataUrl !== "string" || !file.dataUrl.startsWith("data:")) {
      return res.status(400).json({ error: "each attachment requires preview data" });
    }
  }

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  const communications = Array.isArray(existing.communications) ? [...existing.communications] : [];
  const requestedThreadId =
    typeof threadId === "string" && threadId.trim() ? threadId.trim() : null;
  const latestLenderRequest = communications
    .filter((entry) => entry.from === "LENDER" && entry.type === "REQUEST_INFO")
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  const latestMessage = communications
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  const resolvedThreadId = requestedThreadId || latestLenderRequest?.threadId || latestMessage?.threadId;

  if (!resolvedThreadId) {
    return res.status(400).json({ error: "No request thread found to reply to." });
  }

  const threadExists = communications.some((entry) => entry.threadId === resolvedThreadId);
  if (!threadExists) {
    return res.status(400).json({ error: "Invalid threadId for reply." });
  }
  const threadRoot =
    communications.find((entry) => entry.threadId === resolvedThreadId && entry.type === "REQUEST_INFO") ||
    communications.find((entry) => entry.threadId === resolvedThreadId);

  const reply = makeCommunication({
    threadId: resolvedThreadId,
    from: "BORROWER",
    channel: "PORTAL",
    type: "REPLY",
    subject: threadRoot?.subject ? `Re: ${threadRoot.subject}` : "Borrower reply",
    message: message.trim(),
    attachments: parsedAttachments,
    readByBorrower: true,
  });

  const markedRead = communications.map((entry) =>
    entry.from === "LENDER" ? { ...entry, readByBorrower: true } : entry
  );

  const updated = {
    ...existing,
    communications: [...markedRead, reply],
    lastEventAt: Date.now(),
  };

  applications[index] = updated;
  await writeApplications(applications);
  return res.json({ application: withComputed(updated, applications) });
});

app.post("/api/workflows/applications/:id/message", async (req, res) => {
  const { id } = req.params;
  const { subject, message, attachments } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const parsedAttachments = Array.isArray(attachments) ? attachments : [];
  for (const file of parsedAttachments) {
    if (!file || typeof file !== "object") {
      return res.status(400).json({ error: "attachments must be an array of files" });
    }
    if (!file.name || typeof file.name !== "string") {
      return res.status(400).json({ error: "each attachment requires a name" });
    }
    if (!file.dataUrl || typeof file.dataUrl !== "string" || !file.dataUrl.startsWith("data:")) {
      return res.status(400).json({ error: "each attachment requires preview data" });
    }
  }

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  const communications = Array.isArray(existing.communications) ? [...existing.communications] : [];
  const normalizedSubject =
    typeof subject === "string" && subject.trim() ? subject.trim() : "Borrower Inquiry";
  const borrowerMessage = makeCommunication({
    from: "BORROWER",
    channel: "PORTAL",
    type: "REQUEST_INFO",
    subject: normalizedSubject,
    message: message.trim(),
    attachments: parsedAttachments,
    readByBorrower: true,
  });

  const updated = {
    ...existing,
    communications: [...communications, borrowerMessage],
    lastEventAt: Date.now(),
  };

  applications[index] = updated;
  await writeApplications(applications);
  return res.json({ application: withComputed(updated, applications) });
});

app.post("/api/workflows/lender/pipeline/:id/reply", async (req, res) => {
  const { id } = req.params;
  const { message, attachments, threadId } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const parsedAttachments = Array.isArray(attachments) ? attachments : [];
  for (const file of parsedAttachments) {
    if (!file || typeof file !== "object") {
      return res.status(400).json({ error: "attachments must be an array of files" });
    }
    if (!file.name || typeof file.name !== "string") {
      return res.status(400).json({ error: "each attachment requires a name" });
    }
    if (!file.dataUrl || typeof file.dataUrl !== "string" || !file.dataUrl.startsWith("data:")) {
      return res.status(400).json({ error: "each attachment requires preview data" });
    }
  }

  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  const communications = Array.isArray(existing.communications) ? [...existing.communications] : [];
  const requestedThreadId =
    typeof threadId === "string" && threadId.trim() ? threadId.trim() : null;
  const latestLenderRequest = communications
    .filter((entry) => entry.from === "LENDER" && entry.type === "REQUEST_INFO")
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  const latestMessage = communications
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  const resolvedThreadId = requestedThreadId || latestLenderRequest?.threadId || latestMessage?.threadId;

  if (!resolvedThreadId) {
    return res.status(400).json({ error: "No request thread found to reply to." });
  }

  const threadExists = communications.some((entry) => entry.threadId === resolvedThreadId);
  if (!threadExists) {
    return res.status(400).json({ error: "Invalid threadId for reply." });
  }
  const threadRoot =
    communications.find((entry) => entry.threadId === resolvedThreadId && entry.type === "REQUEST_INFO") ||
    communications.find((entry) => entry.threadId === resolvedThreadId);

  const lenderReply = makeCommunication({
    threadId: resolvedThreadId,
    from: "LENDER",
    channel: "PORTAL",
    type: "REPLY",
    subject: threadRoot?.subject ? `Re: ${threadRoot.subject}` : "Lender reply",
    message: message.trim(),
    attachments: parsedAttachments,
    readByBorrower: false,
  });

  const updated = {
    ...existing,
    communications: [...communications, lenderReply],
    lastEventAt: Date.now(),
  };

  applications[index] = updated;
  await writeApplications(applications);
  return res.json({ pipelineRecord: toLenderPipelineRecord(updated) });
});

app.post("/api/workflows/applications/:id/underwriting-intake", async (req, res) => {
  const { id } = req.params;
  const submission = normalizeUnderwritingSubmission(req.body);
  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  const intake = normalizeUnderwritingIntake(existing.underwritingIntake);
  if (intake.status !== "PENDING") {
    return res.status(409).json({ error: "Underwriting intake is locked until the loan is moved to In-underwriting." });
  }

  const prefill = buildUnderwritingPrefill(existing, applications);
  const errors = validateUnderwritingSubmission(submission, prefill);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }

  const finalized = {
    ...submission,
    creditScore: submission.useCreditScoreOnFile ? prefill.creditScoreOnFile : submission.creditScore,
    proofOfLiquidityAmount: submission.useLiquidityOnFile ? prefill.liquidityOnFile : submission.proofOfLiquidityAmount,
    llcDocs: submission.useLlcDocsOnFile ? prefill.llcDocsOnFile : submission.llcDocs,
    otherMortgageLenders: submission.useExistingMortgageLoans
      ? prefill.existingMortgageLenders
      : submission.otherMortgageLenders,
    otherMortgageTotalMonthlyInterest:
      submission.useExistingMortgageLoans &&
      prefill.canReuseMortgageLoans &&
      Number.isFinite(Number(prefill.otherMortgageTotalMonthlyInterestOnFile))
        ? Number(prefill.otherMortgageTotalMonthlyInterestOnFile)
        : submission.otherMortgageTotalMonthlyInterest,
    referral: submission.useProfileReferral ? prefill.referralOnFile : submission.referral,
    pastProjects: submission.useProfileProjects ? prefill.pastProjectsOnFile : submission.pastProjects,
    borrowerProfile: normalizeBorrowerProfile(submission.borrowerProfile, {
      fallbackEmail: existing.borrowerEmail || borrowerProfileDefaults.email,
      fallbackLlcName: submission.llcName || existing.borrowerProfile?.llcName || borrowerProfileDefaults.llcName,
      fallbackName: existing.borrowerName || "",
    }),
  };
  const existingBorrowerAccess = normalizeBorrowerAccess(existing.borrowerAccess, {
    borrowerEmail: existing.borrowerEmail || borrowerProfileDefaults.email,
    isProfileComplete: isBorrowerProfileComplete(existing.borrowerProfile),
  });

  const communications = Array.isArray(existing.communications) ? [...existing.communications] : [];
  const conditionsFormLink = buildBorrowerConditionsLink({ loanId: existing.id, fromApp: 1 });
  const conditionsRequestMessage = [
    "Underwriting continuation form submitted.",
    "Please complete the conditions form and upload all requested items.",
    `Conditions form link: ${conditionsFormLink}`,
  ].join("\n");
  communications.push(
    makeCommunication({
      from: "BORROWER",
      channel: "PORTAL",
      type: "REQUEST_INFO",
      subject: "Underwriting continuation submitted",
      message: `Borrower completed underwriting continuation form for ${existing.id}.`,
      readByBorrower: true,
    })
  );
  communications.push(
    makeCommunication({
      from: "LENDER",
      channel: "PORTAL",
      type: "REQUEST_INFO",
      subject: `Conditions form required: ${existing.id} - ${existing.property}`,
      message: conditionsRequestMessage,
      readByBorrower: false,
    })
  );
  const submittedAt = Date.now();
  const existingConditionsForm = normalizeBorrowerConditionsForm(existing.conditionsForm);
  const hasExistingConditions = hasBorrowerConditionsContent(existingConditionsForm);
  const reusableConditionsPrefill =
    hasExistingConditions
      ? existingConditionsForm
      : buildBorrowerConditionsPrefill(existing, applications);
  const nextConditionsForm =
    reusableConditionsPrefill && hasBorrowerConditionsContent(reusableConditionsPrefill)
      ? reusableConditionsPrefill
      : null;
  const isProfileCompleteAfterSubmit = isBorrowerProfileComplete(finalized.borrowerProfile);
  const nextBorrowerAccess =
    existingBorrowerAccess.status === "NOT_CREATED"
      ? existingBorrowerAccess
      : {
          ...existingBorrowerAccess,
          email:
            existingBorrowerAccess.email ||
            finalized.borrowerProfile.email ||
            existing.borrowerEmail ||
            borrowerProfileDefaults.email,
          status: isProfileCompleteAfterSubmit ? "PROFILE_COMPLETED" : existingBorrowerAccess.status,
          profileCompletedAt: isProfileCompleteAfterSubmit
            ? submittedAt
            : existingBorrowerAccess.profileCompletedAt,
        };

  const updated = {
    ...existing,
    borrowerName: getBorrowerFullName(finalized.borrowerProfile) || existing.borrowerName || "Borrower",
    borrowerEmail:
      (typeof finalized.borrowerProfile.email === "string" && finalized.borrowerProfile.email.trim()) ||
      existing.borrowerEmail ||
      borrowerProfileDefaults.email,
    llcName:
      (typeof finalized.borrowerProfile.llcName === "string" && finalized.borrowerProfile.llcName.trim()) ||
      existing.llcName ||
      borrowerProfileDefaults.llcName,
    history: existing.history.includes("UNDERWRITING_SUBMITTED_FOR_REVIEW")
      ? existing.history
      : [...existing.history, "UNDERWRITING_SUBMITTED_FOR_REVIEW"],
    borrowerProfile: finalized.borrowerProfile,
    underwritingSummary: buildUnderwritingSummary(
      {
        ...existing,
        conditionsForm: nextConditionsForm,
      },
      finalized
    ),
    underwritingIntake: {
      status: "SUBMITTED",
      requestedAt: intake.requestedAt || Date.now(),
      submittedAt,
      notificationSentAt: intake.notificationSentAt || null,
      formData: finalized,
      submissionHistory: [
        ...(Array.isArray(intake.submissionHistory) ? intake.submissionHistory : []),
        { submittedAt, formData: finalized },
      ],
    },
    conditionsForm: nextConditionsForm,
    communications,
    borrowerAccess: nextBorrowerAccess,
    lastEventAt: submittedAt,
  };

  applications[index] = updated;
  await writeApplications(applications);
  await sendBorrowerConditionsFormRequestEmail({
    borrowerEmail: updated.borrowerEmail || borrowerProfileDefaults.email,
    borrowerName: updated.borrowerName || "Borrower",
    loanId: updated.id,
    property: updated.property,
    portalLink: conditionsFormLink,
  });
  return res.json({ application: withComputed(updated, applications) });
});

app.post("/api/workflows/applications/:id/conditions", async (req, res) => {
  const { id } = req.params;
  const submission = normalizeBorrowerConditionsForm(req.body);
  const applications = await readApplications();
  const index = applications.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  const existing = applications[index];
  const intake = normalizeUnderwritingIntake(existing.underwritingIntake);
  if (intake.status !== "SUBMITTED") {
    return res
      .status(409)
      .json({ error: "Conditions form unlocks after underwriting form is submitted." });
  }

  const errors = validateBorrowerConditionsSubmission(submission);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }

  const now = Date.now();
  const existingConditionsForm = normalizeBorrowerConditionsForm(existing.conditionsForm);
  let documentPackage;
  try {
    documentPackage = await persistBorrowerConditionsDocumentPackage(existing.id, submission, { createdAt: now });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to save conditions documents. Please try again.";
    return res.status(500).json({ error: message });
  }
  const finalized = {
    ...submission,
    submittedAt: existingConditionsForm.submittedAt || now,
    updatedAt: now,
    documentPackage,
    reuseMeta: null,
  };
  const communications = Array.isArray(existing.communications) ? [...existing.communications] : [];
  communications.push(
    makeCommunication({
      from: "BORROWER",
      channel: "PORTAL",
      type: "REQUEST_INFO",
      subject: "Conditions form submitted",
      message: `Borrower submitted conditions form for ${existing.id}.`,
      readByBorrower: true,
    })
  );
  const continuationFormData =
    intake.formData && typeof intake.formData === "object" ? intake.formData : null;
  const updated = {
    ...existing,
    conditionsForm: finalized,
    underwritingSummary: buildUnderwritingSummary(
      {
        ...existing,
        conditionsForm: finalized,
      },
      continuationFormData
    ),
    communications,
    history: existing.history.includes("CONDITIONS_FORM_SUBMITTED")
      ? existing.history
      : [...existing.history, "CONDITIONS_FORM_SUBMITTED"],
    lastEventAt: now,
  };

  applications[index] = updated;
  await writeApplications(applications);
  return res.json({ application: withComputed(updated, applications) });
});

app.use((error, _req, res, next) => {
  if (error && (error.type === "entity.too.large" || error.status === 413)) {
    return res.status(413).json({
      error: `Payload too large. Reduce upload size or increase WORKFLOW_API_BODY_LIMIT (current: ${workflowApiBodyLimit}).`,
      code: "PAYLOAD_TOO_LARGE",
    });
  }
  return next(error);
});

app.listen(port, host, async () => {
  await ensureDataFile();
  await readUnderwritingSettings();
  console.log(`[workflow-api] listening on http://${host}:${port}`);
  console.log(`[workflow-api] docs: http://${host}:${port}/api/workflows/docs`);
});
