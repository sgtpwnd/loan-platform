const BASE_URL = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";
const isDev = process.env.NODE_ENV !== "production";

const isTruthy = (value) => value !== undefined && value !== null && value !== "";
const toNumber = (value) => {
  if (typeof value === "string") {
    const cleaned = value.replace(/[, $]/g, "");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toDateString = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const normalizeAddressKey = ({ address1 = "", city = "", state = "", zip = "" }) =>
  [address1, city, state, zip].map((part) => String(part || "").trim().toUpperCase()).join("|");

async function attomGet(path, params = {}) {
  const apiKey = process.env.ATTOM_API_KEY;
  if (!apiKey) {
    throw new Error("ATTOM_API_KEY is not set");
  }
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (isTruthy(value)) search.set(key, String(value).trim());
  });
  if (isDev) search.set("debug", "true");
  const url = `${BASE_URL}${path}?${search.toString()}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", APIKey: apiKey },
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`ATTOM ${response.status}: ${text.slice(0, 200) || response.statusText}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const error = new Error("ATTOM response was not valid JSON");
    error.status = response.status;
    error.url = url;
    throw error;
  }
  return { data, url };
}

function pickAssessorValue(property) {
  const assessed = property?.assessment?.assessed || {};
  const market = property?.assessment?.market || {};
  const summary = property?.summary || {};
  const candidates = [
    assessed.assdTtlValue,
    assessed.assdttlvalue,
    assessed.totalvalue,
    assessed.totvalue,
    assessed.improvementvalue,
    assessed.imprvalue,
    assessed.improvvalue,
    assessed.totApprValue,
    assessed.totapprvalue,
    market.totalvalue,
    market.totvalue,
    market.mktTtlValue,
    market.mktTotValue,
    market.markettotalvalue,
    summary.totalvalue,
    summary.totvalue,
  ];
  for (const candidate of candidates) {
    const num = toNumber(candidate);
    if (num !== null) return num;
  }
  return null;
}

function pickOwnerName(property) {
  const owner = property?.owner || {};
  const owner1 = owner.owner1 || owner.owner || {};
  const candidates = [
    owner1.fullname,
    owner1.fullName,
    owner1.ownername,
    [owner1.firstnameandmi, owner1.lastname].filter(Boolean).join(" ").trim(),
    owner.ownerName,
  ].filter(Boolean);
  return candidates.find((value) => String(value).trim()) || null;
}

function pickSale(property) {
  const sales = [
    property?.sale,
    property?.lastSale,
    Array.isArray(property?.sales) ? property.sales[0] : null,
    Array.isArray(property?.saleHistory) ? property.saleHistory[0] : null,
    Array.isArray(property?.salehistory) ? property.salehistory[0] : null,
    Array.isArray(property?.transferhistory) ? property.transferhistory[0] : null,
    property?.saleSearch,
    property?.salesearch,
    property?.salesearchdate ? { saleSearchDate: property.salesearchdate } : null,
  ].filter(Boolean);
  return sales.find(Boolean) || {};
}

function pickSalePrice(sale) {
  const amount = sale?.amount || {};
  const candidates = [
    amount.saleAmt,
    amount.saleamt,
    amount.amount,
    sale.saleAmt,
    sale.saleamt,
    sale.amount,
    sale.salePrice,
    sale.saleprice,
    sale.price,
  ];
  for (const candidate of candidates) {
    const num = toNumber(candidate);
    if (num !== null) return num;
  }
  return null;
}

function pickSaleDate(sale) {
  const candidates = [
    sale?.saleTransDate,
    sale?.saleSearchDate,
    sale?.saleRecDate,
    sale?.recordingDate,
    sale?.recordDate,
    sale?.saledate,
    sale?.salesearchdate,
    sale?.tranDate,
    sale?.transferDate,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const formatted = toDateString(candidate);
    if (formatted) return formatted;
  }
  return null;
}

async function getDetailOwner(address1, city, state, zip) {
  const address2 = [city, state, zip].filter(Boolean).join(", ").replace(/\s+,/g, ",").trim();
  const resp = await attomGet("/property/detailowner", { address1, address2 });
  const attempts = [{ endpoint: "/property/detailowner", url: resp.url }];
  const list = Array.isArray(resp?.data?.property) ? resp.data.property : [];
  const normalizedKey = normalizeAddressKey({ address1, city, state, zip });
  let best = null;
  for (const item of list) {
    const candidateKey = normalizeAddressKey({
      address1: item?.address?.line1 || item?.address?.address1 || "",
      city: item?.address?.locality || "",
      state: item?.address?.countrySubd || "",
      zip: item?.address?.postal1 || "",
    });
    if (candidateKey === normalizedKey) {
      best = item;
      break;
    }
    if (!best) best = item;
  }
  const needs_review = list.length > 1 && !best;
  return {
    owner_name: pickOwnerName(best),
    raw_property: best || null,
    sourceUrl: resp.url,
    attempts,
    needs_review,
  };
}

const pickMarketValues = (property) => {
  const market = property?.assessment?.market || {};
  const land = toNumber(market.mktLandValue);
  const impr = toNumber(market.mktImprValue);
  const total = toNumber(market.mktTtlValue);
  return { land, impr, total };
};

async function getMarketProfiles(address1, city, state, zip) {
  const address2 = [city, state, zip].filter(Boolean).join(", ").replace(/\s+,/g, ",").trim();
  const attempts = [];

  const fetchAndPick = async (endpoint) => {
    const resp = await attomGet(endpoint, { address1, address2 });
    attempts.push({ endpoint, url: resp.url });
    const list = Array.isArray(resp?.data?.property) ? resp.data.property : [];
    return { list, url: resp.url };
  };

  let expanded = null;
  try {
    expanded = await fetchAndPick("/property/expandedprofile");
  } catch {
    // ignore and fallback
  }
  let basic = null;
  if (!expanded || (expanded.list || []).length === 0) {
    try {
      basic = await fetchAndPick("/property/basicprofile");
    } catch {
      // ignore and fallback
    }
  }
  let assess = null;
  if ((!expanded || (expanded.list || []).length === 0) && (!basic || (basic.list || []).length === 0)) {
    try {
      assess = await fetchAndPick("/assessment/snapshot");
    } catch {
      // ignore
    }
  }

  const normalizedKey = normalizeAddressKey({ address1, city, state, zip });
  const chooseMatch = (list) => {
    let best = null;
    for (const item of list || []) {
      const candidateKey = normalizeAddressKey({
        address1: item?.address?.line1 || item?.address?.address1 || "",
        city: item?.address?.locality || "",
        state: item?.address?.countrySubd || "",
        zip: item?.address?.postal1 || "",
      });
      if (candidateKey === normalizedKey) return item;
      if (!best) best = item;
    }
    return best;
  };

  const expandedMatch = chooseMatch(expanded?.list);
  const basicMatch = chooseMatch(basic?.list);
  const assessMatch = chooseMatch(assess?.list);
  const raw = expandedMatch || basicMatch || assessMatch || null;

  const marketValues = pickMarketValues(raw);
  const address_matched = Boolean(raw);
  const needs_review =
    ((expanded?.list || []).length > 1 || (basic?.list || []).length > 1 || (assess?.list || []).length > 1) &&
    !expandedMatch;

  return {
    address_matched,
    marketValues,
    raw_property: raw,
    needs_review,
    sources: {
      expandedprofile_url: expanded?.url || null,
      basicprofile_url: basic?.url || null,
      assessment_snapshot_url: assess?.url || null,
    },
    attempts,
  };
}

async function getSubjectPropertyAVM(address1, city, state, zip) {
  const address2 = [city, state, zip].filter(Boolean).join(", ").replace(/\s+,/g, ",").trim();
  try {
    const { data, url } = await attomGet("/property/avm/detail", { address1, address2 });
    const avm = data?.property?.[0]?.avm || data?.avm;
    const avmAmount = avm?.amount || avm?.amount1 || avm?.value || avm?.avmValue;
    const avm_value =
      toNumber(avmAmount?.value) ??
      toNumber(avmAmount?.prediction) ??
      toNumber(avmAmount?.market) ??
      toNumber(avmAmount);
    const notes = [];
    if (avm_value === null) notes.push("AVM value not provided by ATTOM.");
    return { avm_value, sourceUrl: url, notes };
  } catch (error) {
    const status = error?.status;
    const sourceUrl = error?.url || null;
    if (status === 403 || status === 404) {
      return {
        avm_value: null,
        sourceUrl,
        notes: ["AVM endpoint unavailable for this plan or address."],
      };
    }
    throw error;
  }
}

async function getSaleSnapshot(address1, city, state, zip) {
  const address2 = [city, state, zip].filter(Boolean).join(", ").replace(/\s+,/g, ",").trim();
  const resp = await attomGet("/sale/snapshot", { address1, address2 });
  const list = Array.isArray(resp?.data?.property) ? resp.data.property : [];
  return { list, url: resp.url };
}

async function getAssessmentSnapshot(address1, city, state, zip) {
  const address2 = [city, state, zip].filter(Boolean).join(", ").replace(/\s+,/g, ",").trim();
  const resp = await attomGet("/assessment/snapshot", { address1, address2 });
  const list = Array.isArray(resp?.data?.property) ? resp.data.property : [];
  return { list, url: resp.url };
}

async function getSubjectProperty(address1, city, state, zip) {
  const address2 = [city, state, zip].filter(Boolean).join(", ").replace(/\s+,/g, ",").trim();
  const resp = await attomGet("/property/detail", { address1, address2, address: address1, postalcode: zip });
  const attempts = [{ endpoint: "/property/detail", url: resp.url }];
  const property = Array.isArray(resp?.data?.property) ? resp.data.property[0] : null;

  const assessor_total_market_value = pickAssessorValue(property);
  const owner_name = pickOwnerName(property);
  const sale = pickSale(property);
  const last_sale_price = pickSalePrice(sale);
  const last_sale_date = pickSaleDate(sale);
  const propertyList = Array.isArray(resp?.data?.property) ? resp.data.property : [];
  const needs_review = propertyList.length > 1 && !property;
  const address_matched = Boolean(property);

  return {
    assessor_total_market_value,
    owner_name,
    last_sale_price,
    last_sale_date,
    address_matched,
    needs_review,
    raw_property: property,
    attempts,
    sources: { detail_url: resp.url },
  };
}

export {
  attomGet,
  getSubjectProperty,
  getSubjectPropertyAVM,
  getSaleSnapshot,
  getAssessmentSnapshot,
  normalizeAddressKey,
  toNumber,
  toDateString,
  getMarketProfiles,
  pickMarketValues,
  getDetailOwner,
  pickSalePrice,
  pickSaleDate,
  pickOwnerName,
};
