
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";

const sections: Record<
  string,
  { title: string; description: string; icon: string }
> = {
  "knowledge-base": {
    title: "Knowledge Base",
    description:
      "Manage the information Bobby uses to answer banking questions.",
    icon: "📚",
  },
  conversations: {
    title: "Conversations",
    description:
      "Monitor customer interactions and review Bobby's responses.",
    icon: "💬",
  },
  complaints: {
    title: "Complaints",
    description: "Review, track and manage customer complaints.",
    icon: "📋",
  },
  escalations: {
    title: "Human Escalations",
    description: "Manage conversations that require human support.",
    icon: "👥",
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

  return (
    <div className="animate-fade-up">
      <Link
        href="/admin"
        className="text-xs font-semibold text-[#EC5424] hover:underline"
      >
        ← Back to overview
      </Link>

      <div className="mt-7 rounded-2xl border border-[#EAEAEA] bg-white p-8 sm:p-12">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FCE5DC] text-2xl">
          {data.icon}
        </span>

        <h2 className="mt-6 text-2xl font-bold">{data.title}</h2>

        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#737373]">
          {data.description}
        </p>

        <div className="mt-8 rounded-xl border border-dashed border-[#E0E0E0] bg-[#FAFAFA] p-6">
          <p className="text-sm font-semibold">Section initialized</p>

          <p className="mt-2 text-xs leading-relaxed text-[#929292]">
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
