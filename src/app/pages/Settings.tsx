import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export default function Settings() {
  return (
    <div className="p-6 space-y-4">
      <h1>Settings</h1>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="space-y-3 max-w-lg">
          <Input placeholder="Name" />
          <Input placeholder="Email" />
          <Button>Save</Button>
        </TabsContent>
        <TabsContent value="team" className="space-y-3 max-w-lg">
          <Input placeholder="Add teammate email" />
          <Button>Invite</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
