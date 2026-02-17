import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export default function ForcePlaced() {
  return (
    <div className="p-6 flex items-center justify-center">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Force-Placed Insurance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Loan ID" />
          <Input placeholder="Carrier" />
          <Input placeholder="Policy Number" />
          <Input type="date" placeholder="Effective Date" />
          <Button className="w-full">Submit</Button>
        </CardContent>
      </Card>
    </div>
  );
}
