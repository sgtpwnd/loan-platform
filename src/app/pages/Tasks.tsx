import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Checkbox } from "../components/ui/checkbox";

const tasks = [
  { id: "1", label: "Verify mortgagee clause", completed: false },
  { id: "2", label: "Request updated declarations page", completed: true },
  { id: "3", label: "Confirm replacement cost coverage", completed: false },
];

export default function Tasks() {
  return (
    <div className="p-6 space-y-4">
      <h1>Tasks</h1>
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="space-y-3">
          {tasks
            .filter((t) => !t.completed)
            .map((task) => (
              <label key={task.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
                <Checkbox checked={task.completed} />
                <span>{task.label}</span>
              </label>
            ))}
        </TabsContent>
        <TabsContent value="completed" className="space-y-3">
          {tasks
            .filter((t) => t.completed)
            .map((task) => (
              <label key={task.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
                <Checkbox checked={task.completed} />
                <span className="line-through text-gray-500">{task.label}</span>
              </label>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
