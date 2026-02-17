import { FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Select, SelectItem } from "../components/ui/select";
import DocumentUpload from "../components/DocumentUpload";
import { createLoan } from "../lib/api";

export default function AddLoan() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    borrowerName: "",
    borrowerEmail: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    amount: "",
    type: "Single Family",
    coverageAmount: "",
    expirationDate: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        borrower: { name: form.borrowerName, email: form.borrowerEmail, phone: "" },
        property: { address: form.address, city: form.city, state: form.state, zip: form.zip, type: form.type },
        loan: { amount: Number(form.amount || 0) },
        insurance: { coverageAmount: Number(form.coverageAmount || 0), expirationDate: form.expirationDate },
      };
      const res = await createLoan(payload);
      navigate(`/loans/${res.loan.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1>Add Loan</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Borrower</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Borrower name" value={form.borrowerName} onChange={(e) => setForm({ ...form, borrowerName: e.target.value })} />
            <Input placeholder="Borrower email" value={form.borrowerEmail} onChange={(e) => setForm({ ...form, borrowerEmail: e.target.value })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Property</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Street address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            <Input placeholder="ZIP" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectItem value="Single Family">Single Family</SelectItem>
              <SelectItem value="Multifamily">Multifamily</SelectItem>
              <SelectItem value="Commercial">Commercial</SelectItem>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-blue-50/40">
          <CardHeader>
            <CardTitle>Insurance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Coverage amount" value={form.coverageAmount} onChange={(e) => setForm({ ...form, coverageAmount: e.target.value })} />
            <Input type="date" placeholder="Expiration date" value={form.expirationDate} onChange={(e) => setForm({ ...form, expirationDate: e.target.value })} />
          </CardContent>
          <CardContent>
            <DocumentUpload />
          </CardContent>
        </Card>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Create Loan"}
        </Button>
      </form>
    </div>
  );
}
