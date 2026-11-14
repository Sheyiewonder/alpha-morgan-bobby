
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  MessageCircle,
  FileText,
  Headset,
} from "lucide-react";

const sections: Record<
  string,
  {
    title: string;
    description: string;
    icon: React.ElementType;
  }
> = {
  "knowledge-base": {
    title: "Knowledge Base",
    description:
      "Manage the information Bobby uses to answer banking questions.",
    icon: BookOpen,
  },
  conversations: {
    title: "Conversations",
    description:
      "Monitor customer interactions and review Bobby's responses.",
    icon: MessageCircle,
  },
  complaints: {
    title: "Complaints",
    description: "Review, track and manage customer complaints.",
    icon: FileText,
  },
  escalations: {
    title: "Human Escalations",
    description: "Manage conversations that require human support.",
    icon: Headset,
  },
  "human-handoffs": {
    title: "Human Handoffs",
    description:
      "Manage conversations referred to human representatives and coordinate customer support.",
    icon: Headset,
  },
};

function SectionLoading() {
  return (
    <div className="animate-pulse rounded-2xl border border-[#EAEAEA] bg-white p-8 sm:p-12">
      <div className="h-14 w-14 rounded-2xl bg-[#F5F5F5]" />
      <div className="mt-6 h-7 w-48 rounded bg-[#F5F5F5]" />
      <div className="mt-3 h-4 max-w-md rounded bg-[#F5F5F5]" />
      <div className="mt-8 h-24 rounded-xl bg-[#F5F5F5]" />
    </div>
  );
}

async function AdminSectionContent({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const data = sections[section];

  if (!data) {
    notFound();
  }

  const Icon = data.icon;

  return (
    <div className="animate-fade-up">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#EC5424] hover:underline"
      >
        <ArrowLeft size={14} />
        Back to overview
      </Link>

      <div className="mt-7 rounded-2xl border border-[#EAEAEA] bg-white p-8 sm:p-12">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FCE5DC] text-[#EC5424]">
          <Icon size={27} strokeWidth={1.8} />
        </span>

        <h2 className="mt-6 text-2xl font-bold">{data.title}</h2>

        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#737373]">
          {data.description}
        </p>

        <div className="mt-8 rounded-xl border border-dashed border-[#E0E0E0] bg-[#FAFAFA] p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <ArrowRight size={16} />
            </span>
            <p className="text-sm font-semibold">Section initialized</p>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[#929292]">
            The dashboard route is ready. We will connect this section to the
            existing Bobby API and database in the next implementation stage.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <AdminSectionContent params={params} />
    </Suspense>
  );
}
