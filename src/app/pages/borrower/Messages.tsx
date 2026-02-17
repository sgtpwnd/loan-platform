import { Paperclip, Plus, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "../../components/StatusBadge";

type Conversation = {
  id: string;
  subject: string;
  unread: number;
  preview: string;
};

const conversations: Conversation[] = [
  { id: "c1", subject: "Loan Application LA-2024-1247 Update", unread: 2, preview: "Underwriting requested updated statements." },
  { id: "c2", subject: "Document Request - Tax Returns", unread: 0, preview: "Please upload your 2025 federal return." },
  { id: "c3", subject: "Payment Confirmation - February 2026", unread: 0, preview: "Your payment posted successfully." },
  { id: "c4", subject: "Refinance Application Inquiry", unread: 1, preview: "Can we discuss options for term reduction?" },
];

export function Messages() {
  const [activeId, setActiveId] = useState("c1");

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? conversations[0],
    [activeId]
  );

  return (
    <div className="space-y-6">
      <header id="inbox">
        <h1 className="text-3xl font-bold text-primary">Messages</h1>
        <p className="text-muted-foreground mt-1">Secure conversations with your loan team.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <aside className="rounded-lg border border-border bg-card p-4 shadow-sm lg:col-span-1">
          <h2 className="font-semibold mb-3">Conversations</h2>
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={`w-full text-left rounded-lg border p-3 transition ${
                  activeId === conversation.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/30"
                }`}
                onClick={() => setActiveId(conversation.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{conversation.subject}</p>
                  {conversation.unread > 0 ? <StatusBadge variant="info">{conversation.unread} unread</StatusBadge> : null}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{conversation.preview}</p>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm lg:col-span-2 flex flex-col min-h-[520px]">
          <div className="pb-4 border-b border-border">
            <h2 className="text-lg font-semibold">{activeConversation.subject}</h2>
            <p className="text-sm text-muted-foreground mt-1">Conversation with Sarah Johnson</p>
          </div>

          <div className="flex-1 py-4 space-y-4">
            <MessageBubble author="Sarah Johnson" role="officer" text="Hi Michael, underwriting reviewed your file. Please upload one additional bank statement for December." time="9:10 AM" />
            <MessageBubble author="Michael Chen" role="borrower" text="Thanks Sarah, I will upload it in the documents section today." time="9:26 AM" />
            <MessageBubble author="Sarah Johnson" role="officer" text="Perfect. Once uploaded, we should be able to finalize decisioning within 24 hours." time="9:31 AM" />
          </div>

          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <input className="flex-1 rounded-lg border border-border bg-white px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Type your message..." />
              <button className="rounded-lg border border-border p-2 hover:bg-muted" title="Attach file"><Paperclip size={16} /></button>
              <button className="rounded-lg bg-primary text-white p-2 hover:bg-primary/90" title="Send"><Send size={16} /></button>
            </div>
          </div>
        </div>
      </section>

      <section id="actions" className="grid gap-4 md:grid-cols-3">
        <QuickAction title="Start New Conversation" subtitle="Create a new secure message thread" icon={<Plus size={16} />} />
        <QuickAction title="Help Center" subtitle="Browse FAQs and loan support guides" icon={<Plus size={16} />} />
        <QuickAction title="Contact Support" subtitle="Speak with support via phone or chat" icon={<Plus size={16} />} />
      </section>
    </div>
  );
}

type MessageBubbleProps = {
  author: string;
  role: "officer" | "borrower";
  text: string;
  time: string;
};

function MessageBubble({ author, role, text, time }: MessageBubbleProps) {
  const isOfficer = role === "officer";

  return (
    <div className={`flex ${isOfficer ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[80%] rounded-lg px-4 py-3 ${isOfficer ? "bg-muted" : "bg-primary text-white"}`}>
        <p className={`text-xs ${isOfficer ? "text-muted-foreground" : "text-white/80"}`}>{author}</p>
        <p className="text-sm mt-1">{text}</p>
        <p className={`text-xs mt-2 ${isOfficer ? "text-muted-foreground" : "text-white/80"}`}>{time}</p>
      </div>
    </div>
  );
}

type QuickActionProps = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
};

function QuickAction({ title, subtitle, icon }: QuickActionProps) {
  return (
    <button className="rounded-lg border border-border bg-card p-4 shadow-sm text-left hover:bg-muted/30 transition">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mb-3">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </button>
  );
}
