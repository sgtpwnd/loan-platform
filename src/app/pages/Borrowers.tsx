import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { getBorrowers } from "../lib/api";

export default function Borrowers() {
  const [borrowers, setBorrowers] = useState<any[]>([]);
  useEffect(() => {
    getBorrowers().then((res) => setBorrowers(res.borrowers));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1>Borrowers</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {borrowers.map((b) => (
          <Card key={b.id}>
            <CardHeader>
              <CardTitle>{b.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-gray-600">
              <p>{b.email}</p>
              <p>{b.phone}</p>
              <Link to={`/borrowers/${b.id}`} className="text-blue-600">
                View details
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
