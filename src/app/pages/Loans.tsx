import { useEffect, useState } from "react";
import { Link } from "react-router";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { getLoans } from "../lib/api";
import { formatDate } from "../lib/format";

export default function Loans() {
  const [loans, setLoans] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLoans()
      .then((res) => setLoans(res.loans))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1>Loans</h1>
          <p className="text-gray-600">Insurance status across your portfolio.</p>
        </div>
        <Link to="/loans/add">
          <Button variant="primary">Add Loan</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Borrower</Th>
                <Th>Property</Th>
                <Th>Insurance</Th>
                <Th>Expires</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {loans.map((loan) => (
                <Tr key={loan.id}>
                  <Td className="font-medium">{loan.id}</Td>
                  <Td>{loan.borrower?.name}</Td>
                  <Td>{loan.property?.address}</Td>
                  <Td>
                    <StatusBadge variant={(loan.insurance?.status || "default") as any}>
                      {loan.insurance?.status || "default"}
                    </StatusBadge>
                  </Td>
                  <Td>{loan.insurance?.expirationDate ? formatDate(loan.insurance.expirationDate) : "—"}</Td>
                  <Td className="text-right">
                    <Link to={`/loans/${loan.id}`} className="text-blue-600 text-sm">
                      View
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {error ? <p className="text-red-600 text-sm mt-3">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
