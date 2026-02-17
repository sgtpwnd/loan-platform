import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = ({ className, ...props }: TabsPrimitive.TabsListProps) => (
  <TabsPrimitive.List
    className={cn("inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium", className)}
    {...props}
  />
);

export const TabsTrigger = ({ className, ...props }: TabsPrimitive.TabsTriggerProps) => (
  <TabsPrimitive.Trigger
    className={cn(
      "px-3 py-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-gray-900",
      "text-gray-600 hover:text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
      className
    )}
    {...props}
  />
);

export const TabsContent = ({ className, ...props }: TabsPrimitive.TabsContentProps) => (
  <TabsPrimitive.Content className={cn("mt-4", className)} {...props} />
);
