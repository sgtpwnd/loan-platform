import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import DocumentUpload from "../components/DocumentUpload";
import { createUploadToken, uploadInsurance } from "../lib/api";
import { AlertBanner } from "../components/AlertBanner";

export default function BorrowerPortal() {
  const { loanId } = useParams();
  const [token, setToken] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loanId) return;
    createUploadToken(loanId)
      .then((res) => setToken(res.token))
      .catch(() => {});
  }, [loanId]);

  const handleUpload = async (file: File) => {
    if (!token) return;
    await uploadInsurance(token, file);
    setSuccess("Upload received. Thank you!");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Upload Insurance Documents</CardTitle>
          <p className="text-sm text-gray-600">Loan {loanId}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? <AlertBanner variant="success">{success}</AlertBanner> : null}
          <DocumentUpload onUpload={handleUpload} />
        </CardContent>
      </Card>
    </div>
  );
}
