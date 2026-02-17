import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { getLoans } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, formatCurrency } from "../lib/format";

export default function Insurance() {
  const [loans, setLoans] = useState<any[]>([]);

  useEffect(() => {
    getLoans().then((res) => setLoans(res.loans));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1>Insurance</h1>
      <Card>
        <CardHeader>
          <CardTitle>Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>Loan</Th>
                <Th>Policy</Th>
                <Th>Carrier</Th>
                <Th>Coverage</Th>
                <Th>Expires</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {loans.map((loan) => (
                <Tr key={loan.id}>
                  <Td className="font-medium">{loan.id}</Td>
                  <Td>{loan.insurance?.policyNumber || "—"}</Td>
                  <Td>{loan.insurance?.carrier || "—"}</Td>
                  <Td>{formatCurrency(loan.insurance?.coverageAmount)}</Td>
                  <Td>{loan.insurance?.expirationDate ? formatDate(loan.insurance.expirationDate) : "—"}</Td>
                  <Td>
                    <StatusBadge variant={(loan.insurance?.status || "default") as any}>
                      {loan.insurance?.status || "default"}
                    </StatusBadge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
