import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { StatusBadge } from "../components/StatusBadge";
import { CountdownTimer } from "../components/CountdownTimer";
import { AlertBanner } from "../components/AlertBanner";
import DocumentUpload from "../components/DocumentUpload";
import { createUploadToken, getLoan, uploadInsurance } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";

export default function LoanDetail() {
  const { id } = useParams();
  const [loan, setLoan] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getLoan(id)
      .then((res) => setLoan(res.loan))
      .catch((err) => setError(err.message));
    createUploadToken(id)
      .then((res) => setToken(res.token))
      .catch(() => {});
  }, [id]);

  const handleUpload = async (file: File) => {
    if (!token) return;
    await uploadInsurance(token, file);
    setUploaded(file.name);
  };

  if (!loan) return <div className="p-6">{error || "Loading..."}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1>Loan {loan.id}</h1>
          <p className="text-gray-600">{loan.property?.address}</p>
        </div>
        <StatusBadge variant={(loan.insurance?.status || "default") as any}>{loan.insurance?.status}</StatusBadge>
      </div>

      <AlertBanner variant="info">Assigned to {loan.assignedStaff || "Unassigned"}</AlertBanner>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Insurance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <p>Carrier</p>
              <p className="font-medium">{loan.insurance?.carrier || "—"}</p>
            </div>
            <div className="flex items-center justify-between">
              <p>Policy</p>
              <p className="font-medium">{loan.insurance?.policyNumber || "—"}</p>
            </div>
            <div className="flex items-center justify-between">
              <p>Coverage</p>
              <p className="font-medium">{formatCurrency(loan.insurance?.coverageAmount)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p>Expiration</p>
              <p className="font-medium">
                {loan.insurance?.expirationDate ? formatDate(loan.insurance.expirationDate) : "—"}
              </p>
            </div>
            {loan.insurance?.expirationDate ? <CountdownTimer expirationDate={loan.insurance.expirationDate} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUpload onUpload={handleUpload} uploadedUrl={uploaded} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
