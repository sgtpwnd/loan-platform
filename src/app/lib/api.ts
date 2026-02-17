async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }
  return res.json() as Promise<T>;
}

export function getLoans() {
  return request<{ loans: any[] }>("/api/insurance/loans");
}

export function getLoan(id: string) {
  return request<{ loan: any }>(`/api/insurance/loans/${id}`);
}

export function createLoan(data: any) {
  return request<{ loan: any }>("/api/insurance/loans", { method: "POST", body: JSON.stringify(data) });
}

export function getBorrowers() {
  return request<{ borrowers: any[] }>("/api/insurance/borrowers");
}

export function getBorrower(id: string) {
  return request<{ borrower: any }>(`/api/insurance/borrowers/${id}`);
}

export function createUploadToken(loanId: string) {
  return request<{ token: string; uploadUrl: string; uploadApiUrl: string }>("/api/insurance/tokens", {
    method: "POST",
    body: JSON.stringify({ loanId }),
  });
}

export async function uploadInsurance(token: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/insurance/upload/${token}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean; documentUrl: string; loanId: string }>;
}
