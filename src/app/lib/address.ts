export type AddressParts = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type AddressSuggestion = AddressParts & {
  id: string;
  label: string;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  county?: string;
  state?: string;
  postcode?: string;
};

type NominatimResult = {
  place_id?: number;
  display_name?: string;
  address?: NominatimAddress;
};

function toTrimmed(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function cityFromAddress(address: NominatimAddress | undefined) {
  return (
    toTrimmed(address?.city) ||
    toTrimmed(address?.town) ||
    toTrimmed(address?.village) ||
    toTrimmed(address?.hamlet) ||
    toTrimmed(address?.county)
  );
}

function streetFromAddress(address: NominatimAddress | undefined) {
  const road = toTrimmed(address?.road);
  const houseNumber = toTrimmed(address?.house_number);
  if (houseNumber && road) return `${houseNumber} ${road}`.trim();
  return road;
}

function normalizeZip(zip: string) {
  const match = zip.match(/\d{5}(?:-\d{4})?/);
  return match ? match[0] : zip.trim();
}

export function formatAddress(parts: AddressParts) {
  const street = parts.street.trim();
  const city = parts.city.trim();
  const state = parts.state.trim();
  const zip = parts.zip.trim();

  const cityStateZip = [city, state].filter(Boolean).join(", ");
  const stateZip = [state, zip].filter(Boolean).join(" ");

  if (street && city && state && zip) {
    return `${street}, ${city}, ${state} ${zip}`;
  }
  if (street && cityStateZip) return `${street}, ${cityStateZip}`;
  if (street) return street;
  if (city && stateZip) return `${city}, ${stateZip}`;
  return [city, stateZip].filter(Boolean).join(", ");
}

export function parseAddressString(input: string): AddressParts {
  const value = toTrimmed(input);
  if (!value) {
    return { street: "", city: "", state: "", zip: "" };
  }

  const segments = value
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const street = segments[0] || "";
  const city = segments[1] || "";
  const stateZipRaw = segments.slice(2).join(" ").trim();
  const stateZipParts = stateZipRaw.split(/\s+/).filter(Boolean);
  const zip = stateZipParts.length ? normalizeZip(stateZipParts[stateZipParts.length - 1]) : "";
  const state = stateZipParts.length > 1 ? stateZipParts.slice(0, -1).join(" ") : stateZipParts[0] || "";

  return {
    street,
    city,
    state,
    zip: zip || "",
  };
}

function normalizeSuggestion(result: NominatimResult, index: number): AddressSuggestion | null {
  const address = result.address;
  const parsed = parseAddressString(toTrimmed(result.display_name));
  const street = streetFromAddress(address) || parsed.street;
  const city = cityFromAddress(address) || parsed.city;
  const state = toTrimmed(address?.state) || parsed.state;
  const zip = normalizeZip(toTrimmed(address?.postcode) || parsed.zip);

  const parts: AddressParts = {
    street,
    city,
    state,
    zip,
  };

  const label = formatAddress(parts);
  if (!label) return null;

  return {
    id: String(result.place_id || `suggestion-${index}`),
    label,
    ...parts,
  };
}

export async function searchAddressSuggestions(query: string, signal?: AbortSignal) {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "us");

  const response = await fetch(url.toString(), {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Address search failed with status ${response.status}`);
  }

  const data = (await response.json()) as NominatimResult[];
  const normalized = data
    .map((item, index) => normalizeSuggestion(item, index))
    .filter((item): item is AddressSuggestion => Boolean(item));

  const seen = new Set<string>();
  return normalized.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

