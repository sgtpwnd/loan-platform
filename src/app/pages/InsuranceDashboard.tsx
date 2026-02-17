import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { AlertBanner } from "../components/AlertBanner";
import ActivityTimeline from "../components/ActivityTimeline";
import { getLoans } from "../lib/api";
import { formatCurrency } from "../lib/format";

export default function InsuranceDashboard() {
  const [loans, setLoans] = useState<any[]>([]);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    getLoans()
      .then((res) => setLoans(res.loans))
      .catch((err) => setError(err.message));
  }, []);

  const active = loans.length;
  const expiring = loans.filter((l) => l.insurance?.status === "expiring").length;
  const forcePlaced = loans.filter((l) => l.insurance?.status === "force-placed").length;

  return (
    <div className="p-6 space-y-6">
      <AlertBanner variant="info">Welcome back. Track insurance compliance across all loans.</AlertBanner>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Active Loans</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{active}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expiring Policies</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-yellow-600">{expiring}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Force-Placed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-purple-600">{forcePlaced}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Loans</CardTitle>
            <Link to="/insurance/loans" className="text-blue-600 text-sm">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-200">
            {loans.slice(0, 5).map((loan) => (
              <div key={loan.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900">{loan.property?.address}</p>
                  <p className="text-gray-500">{loan.borrower?.name}</p>
                </div>
                <p className="text-gray-700">{formatCurrency(loan.loan?.amount)}</p>
              </div>
            ))}
            {loans.length === 0 ? <p className="py-3 text-gray-500">No loans yet.</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline
            items={(loans[0]?.events || []).map((e: any) => ({
              id: e.id,
              type: "info",
              message: e.message || e.type,
              createdAt: e.createdAt || new Date().toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
