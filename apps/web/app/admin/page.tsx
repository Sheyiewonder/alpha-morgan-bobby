
import Link from "next/link";

const stats = [
  {
    label: "Total conversations",
    value: "1,284",
    change: "+12.8%",
    detail: "vs. previous period",
    color: "bg-orange-50 text-[#EC5424]",
    icon: "💬",
  },
  {
    label: "Resolved conversations",
    value: "1,126",
    change: "87.7%",
    detail: "resolution rate",
    color: "bg-emerald-50 text-emerald-700",
    icon: "✓",
  },
  {
    label: "Open complaints",
    value: "38",
    change: "Needs attention",
    detail: "awaiting resolution",
    color: "bg-amber-50 text-amber-700",
    icon: "!",
  },
  {
    label: "Human escalations",
    value: "07",
    change: "Pending review",
    detail: "support handover",
    color: "bg-blue-50 text-blue-700",
    icon: "↗",
  },
];

const conversations = [
  {
    initials: "AO",
    name: "Adebayo Oluwaseun",
    question: "How do I open a savings account?",
    time: "2 min ago",
    status: "Resolved",
  },
  {
    initials: "CN",
    name: "Chidinma Nwosu",
    question: "What are your transfer limits?",
    time: "8 min ago",
    status: "Active",
  },
  {
    initials: "MI",
    name: "Michael Ibrahim",
    question: "I need help with a failed transaction.",
    time: "15 min ago",
    status: "Escalated",
  },
  {
    initials: "FA",
    name: "Fatima Ahmed",
    question: "How can I request a statement?",
    time: "24 min ago",
    status: "Resolved",
  },
];

const quickLinks = [
  {
    title: "Knowledge Base",
    description: "Manage banking FAQs and documents.",
    href: "/admin/knowledge-base",
    icon: "📚",
  },
  {
    title: "Conversations",
    description: "Review customer interactions with Bobby.",
    href: "/admin/conversations",
    icon: "💬",
  },
  {
    title: "Complaints",
    description: "Track and manage customer complaints.",
    href: "/admin/complaints",
    icon: "📋",
  },
  {
    title: "Escalations",
    description: "Review requests requiring human support.",
    href: "/admin/escalations",
    icon: "👥",
  },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Resolved: "bg-emerald-50 text-emerald-700",
    Active: "bg-blue-50 text-blue-700",
    Escalated: "bg-orange-50 text-[#EC5424]",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function AdminDashboard() {
  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#EC5424]">
            Dashboard overview
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome to Bobby.
          </h2>
          <p className="mt-2 text-sm text-[#737373]">
            Here&apos;s what is happening across your customer support platform.
          </p>
        </div>

        <span className="w-fit rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-semibold text-[#EC5424]">
          DEMO DATA · NOT LIVE ANALYTICS
        </span>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-[#EAEAEA] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <p className="text-sm text-[#737373]">{stat.label}</p>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold ${stat.color}`}>
                {stat.icon}
              </span>
            </div>
            <p className="mt-5 text-3xl font-bold tracking-tight">{stat.value}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-[#EC5424]">{stat.change}</span>
              <span className="text-[#929292]">{stat.detail}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] px-5 py-5 sm:px-6">
            <div>
              <h3 className="font-bold">Recent conversations</h3>
              <p className="mt-1 text-xs text-[#929292]">
                Sample customer interactions
              </p>
            </div>
            <Link
              href="/admin/conversations"
              className="text-xs font-semibold text-[#EC5424] hover:underline"
            >
              View all →
            </Link>
          </div>

          <div className="divide-y divide-[#F0F0F0]">
            {conversations.map((conversation) => (
              <div
                key={conversation.name}
                className="flex items-center gap-3 px-5 py-4 sm:px-6"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FCE5DC] text-xs font-bold text-[#EC5424]">
                  {conversation.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{conversation.name}</p>
                  <p className="mt-1 truncate text-xs text-[#929292]">
                    {conversation.question}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <StatusBadge status={conversation.status} />
                  <p className="mt-2 text-[10px] text-[#A0A0A0]">{conversation.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5 sm:p-6">
          <div className="mb-5">
            <h3 className="font-bold">Platform status</h3>
            <p className="mt-1 text-xs text-[#929292]">
              Prototype service overview
            </p>
          </div>

          <div className="space-y-4">
            {[
              ["Bobby AI assistant", "Operational"],
              ["Knowledge retrieval", "Operational"],
              ["Database connection", "Connected"],
              ["Human support queue", "Available"],
            ].map(([label, status]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#555]">{label}</span>
                <span className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {status}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-xl bg-[#141A1C] p-5 text-white">
            <p className="text-xs font-medium text-white/50">Meet your AI assistant</p>
            <h4 className="mt-2 text-xl font-bold">Bobby is ready to help.</h4>
            <p className="mt-2 text-xs leading-relaxed text-white/60">
              Experience the customer-facing chatbot and test its banking knowledge.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex rounded-lg bg-[#EC5424] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#d94719]"
            >
              Open chatbot →
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h3 className="font-bold">Quick access</h3>
          <p className="mt-1 text-xs text-[#929292]">
            Navigate to your administration tools.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-2xl border border-[#EAEAEA] bg-white p-5 transition hover:-translate-y-1 hover:border-[#EC5424]/40 hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FCE5DC] text-xl">
                {item.icon}
              </span>
              <h4 className="mt-4 text-sm font-bold group-hover:text-[#EC5424]">
                {item.title}
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-[#929292]">
                {item.description}
              </p>
              <p className="mt-4 text-xs font-semibold text-[#EC5424]">
                Open section →
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
