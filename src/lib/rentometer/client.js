const toNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]/g, "").trim();
    if (!normalized) return null;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

export function mapRentometerSummary(data, options = {}) {
  const notes = [];
  const meanCandidates = [data?.mean, data?.result?.mean, data?.summary?.mean, data?.rent?.mean];
  let mean = null;
  for (const candidate of meanCandidates) {
    const num = toNumber(candidate);
    if (num !== null) {
      mean = num;
      break;
    }
  }

  const quickviewCandidates = [data?.quickview_url, data?.result?.quickview_url, data?.summary?.quickview_url];
  const quickview_url = quickviewCandidates.find((value) => typeof value === "string" && value.trim())?.trim() || null;

  if (Array.isArray(data?.notes)) {
    for (const note of data.notes) {
      if (typeof note === "string" && note.trim()) notes.push(note.trim());
    }
  }

  if (mean === null) {
    notes.push("Rentometer did not return a mean rent for this query.");
  }

  const retrieved_at = (() => {
    const input = options.retrievedAt ?? options.retrieved_at;
    if (!input) return new Date().toISOString();
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  })();

  return {
    average_rent: mean,
    quickview_url,
    retrieved_at,
    notes,
  };
}

export { toNumber };
