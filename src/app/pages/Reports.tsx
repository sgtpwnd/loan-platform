import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export default function Reports() {
  return (
    <div className="p-6 space-y-4">
      <h1>Reports</h1>
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
            Chart placeholder
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
