import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { getBorrower } from "../lib/api";

export default function BorrowerDetail() {
  const { id } = useParams();
  const [borrower, setBorrower] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    getBorrower(id).then((res) => setBorrower(res.borrower));
  }, [id]);

  if (!borrower) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-4">
      <h1>{borrower.name}</h1>
      <p className="text-gray-600">{borrower.email}</p>

      <div className="grid gap-4 md:grid-cols-2">
        {borrower.loans?.map((loan: any) => (
          <Card key={loan.id}>
            <CardHeader>
              <CardTitle>{loan.property?.address}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>{loan.property?.city}, {loan.property?.state}</p>
              <Link to={`/loans/${loan.id}`} className="text-blue-600">View loan</Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
