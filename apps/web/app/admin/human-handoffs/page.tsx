
"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

type HandoffStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED";

type HandoffSource =
  | "AI_DECISION"
  | "CUSTOMER_REQUEST"
  | "KNOWLEDGE_GAP"
  | "COMPLAINT"
  | "OTHER";

interface Customer {
  firstName: string;
  lastName: string;
  customerRef: string;
  segment: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string | null;
  channel: string;
  isResolved: boolean;
  createdAt: string;
  customer: Customer | null;
  messages: Message[];
  _count?: {
    messages: number;
  };
}

interface HumanHandoff {
  id: string;
  conversationId: string;
  complaintId: string | null;
  reason: string;
  source: HandoffSource;
  status: HandoffStatus;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  conversation: Conversation;
}

interface HandoffResponse {
  success: boolean;
  handoffs: HumanHandoff[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const STATUSES: HandoffStatus[] = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
];

// const SOURCES: HandoffSource[] = [
//   "AI_DECISION",
//   "CUSTOMER_REQUEST",
//   "KNOWLEDGE_GAP",
//   "COMPLAINT",
//   "OTHER",
// ];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusStyle(status: HandoffStatus) {
  const styles: Record<HandoffStatus, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    ASSIGNED: "bg-blue-50 text-blue-700",
    IN_PROGRESS: "bg-purple-50 text-purple-700",
    RESOLVED: "bg-emerald-50 text-emerald-700",
  };

  return styles[status];
}

function sourceStyle(source: HandoffSource) {
  const styles: Record<HandoffSource, string> = {
    AI_DECISION: "bg-blue-50 text-blue-700",
    CUSTOMER_REQUEST: "bg-orange-50 text-orange-700",
    KNOWLEDGE_GAP: "bg-purple-50 text-purple-700",
    COMPLAINT: "bg-rose-50 text-rose-700",
    OTHER: "bg-gray-100 text-gray-700",
  };

  return styles[source];
}

function getCustomerName(customer: Customer | null) {
  if (!customer) return "Unknown customer";
  return `${customer.firstName} ${customer.lastName}`;
}

export default function HumanHandoffsPage() {
  const [handoffs, setHandoffs] = useState<HumanHandoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedHandoff, setSelectedHandoff] =
    useState<HumanHandoff | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  // Demonstration identity only.
  // Replace with authenticated staff identity before production.
  const [representativeName, setRepresentativeName] = useState(
    "Demo Support Representative"
  );

  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [resolving, setResolving] = useState(false);

  const [replyError, setReplyError] = useState("");
  const [replySuccess, setReplySuccess] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Load the central human handoff queue.
  const loadHandoffs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      const response = await fetch(
        `${API_URL}/api/human-handoffs?${params.toString()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Unable to retrieve human handoffs.");
      }

      const data: HandoffResponse = await response.json();

      if (!data.success) {
        throw new Error("The human handoffs request was unsuccessful.");
      }

      setHandoffs(data.handoffs ?? []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(Math.max(1, data.pagination?.totalPages ?? 1));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading human handoffs."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void loadHandoffs();
  }, [loadHandoffs]);

  // Retrieve the full handoff and original conversation.
  const openHandoff = async (id: string) => {
    setSelectedHandoff(null);
    setDetailsError("");
    setReplyError("");
    setReplySuccess("");
    setReplyContent("");
    setLastRefreshed(null);
    setDetailsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/human-handoffs/${id}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Unable to retrieve this human handoff.");
      }

      const data = await response.json();

      if (!data.success || !data.handoff) {
        throw new Error("The handoff details could not be retrieved.");
      }

      setSelectedHandoff(data.handoff);
      setLastRefreshed(new Date());
    } catch (err) {
      setDetailsError(
        err instanceof Error
          ? err.message
          : "Unable to load handoff details."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  // Refresh the selected handoff and its conversation.
  const refreshHandoffDetails = useCallback(
    async (id: string, silent = false) => {
      try {
        const response = await fetch(
          `${API_URL}/api/human-handoffs/${id}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Unable to refresh conversation.");
        }

        const data = await response.json();

        if (!data.success || !data.handoff) {
          throw new Error("Unable to retrieve updated conversation.");
        }

        setSelectedHandoff((current) =>
          current?.id === id ? data.handoff : current
        );

        setLastRefreshed(new Date());

        if (!silent) {
          setDetailsError("");
        }
      } catch (err) {
        if (!silent) {
          setDetailsError(
            err instanceof Error
              ? err.message
              : "Unable to refresh conversation."
          );
        }
      }
    },
    []
  );

  // Refresh an open conversation every five seconds.
  useEffect(() => {
    if (!selectedHandoff) return;

    const handoffId = selectedHandoff.id;

    const interval = setInterval(() => {
      void refreshHandoffDetails(handoffId, true);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedHandoff?.id, refreshHandoffDetails]);

  // Claim a pending handoff.
  const claimHandoff = async () => {
    if (!selectedHandoff || claiming) return;

    const name = representativeName.trim();

    if (!name) {
      setReplyError("Enter the representative's name first.");
      return;
    }

    setClaiming(true);
    setReplyError("");
    setReplySuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/human-handoffs/${selectedHandoff.id}/claim`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignedTo: name,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to claim this handoff.");
      }

      if (data.handoff) {
        setSelectedHandoff(data.handoff);
        setLastRefreshed(new Date());
      } else {
        await refreshHandoffDetails(selectedHandoff.id);
      }

      setReplySuccess("You have successfully claimed this handoff.");

      await loadHandoffs();
    } catch (err) {
      setReplyError(
        err instanceof Error
          ? err.message
          : "Something went wrong while claiming this handoff."
      );

      await refreshHandoffDetails(selectedHandoff.id, true);
    } finally {
      setClaiming(false);
    }
  };

  // Send a representative reply to the original conversation.
  const sendAgentReply = async () => {
    if (!selectedHandoff || sendingReply) return;

    const content = replyContent.trim();
    const name = representativeName.trim();

    if (!content) {
      setReplyError("Enter a message before sending.");
      return;
    }

    if (content.length > 5000) {
      setReplyError("Messages cannot exceed 5,000 characters.");
      return;
    }

    if (!name || selectedHandoff.assignedTo !== name) {
      setReplyError(
        "You must claim this handoff before sending a reply."
      );
      return;
    }

    setSendingReply(true);
    setReplyError("");
    setReplySuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/human-handoffs/${selectedHandoff.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignedTo: name,
            content,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to send your reply.");
      }

      setReplyContent("");
      setReplySuccess("Your reply has been sent successfully.");

      await refreshHandoffDetails(selectedHandoff.id);
      await loadHandoffs();
    } catch (err) {
      setReplyError(
        err instanceof Error
          ? err.message
          : "Something went wrong while sending your reply."
      );
    } finally {
      setSendingReply(false);
    }
  };

  // Resolve the handoff.
  const resolveHandoff = async () => {
    if (!selectedHandoff || resolving) return;

    if (selectedHandoff.assignedTo !== representativeName.trim()) {
      setReplyError(
        "Only the assigned representative can resolve this handoff."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to resolve this human handoff?"
    );

    if (!confirmed) return;

    setResolving(true);
    setReplyError("");
    setReplySuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/human-handoffs/${selectedHandoff.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "RESOLVED",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to resolve this handoff.");
      }

      setSelectedHandoff(data.handoff);
      setLastRefreshed(new Date());
      setReplySuccess("This human handoff has been resolved.");

      await loadHandoffs();
    } catch (err) {
      setReplyError(
        err instanceof Error
          ? err.message
          : "Something went wrong while resolving this handoff."
      );
    } finally {
      setResolving(false);
    }
  };

  const closeModal = () => {
    setSelectedHandoff(null);
    setDetailsError("");
    setReplyError("");
    setReplySuccess("");
    setReplyContent("");
    setLastRefreshed(null);
  };

  const pendingOnPage = handoffs.filter(
    (item) => item.status === "PENDING"
  ).length;

  const activeOnPage = handoffs.filter(
    (item) =>
      item.status === "ASSIGNED" || item.status === "IN_PROGRESS"
  ).length;

  const resolvedOnPage = handoffs.filter(
    (item) => item.status === "RESOLVED"
  ).length;

  return (
    <div className="space-y-7 animate-fade-up">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#EC5424]">
            Customer support
          </p>

          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Human Handoffs
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-[#737373]">
            Manage conversations referred to human representatives.
            Claim requests, communicate with customers, and track resolutions.
          </p>
        </div>

        <button
          onClick={() => void loadHandoffs()}
          disabled={loading}
          className="flex items-center justify-center gap-2 self-start rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F8F8F8] disabled:opacity-50 sm:self-auto"
        >
          <span aria-hidden="true">↻</span>
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Total handoffs</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : total}
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Matching handoff records
          </p>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Pending on this page</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : pendingOnPage}
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Awaiting representative assignment
          </p>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Active on this page</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : activeOnPage}
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Assigned or in progress
          </p>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Resolved on this page</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : resolvedOnPage}
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Completed handoffs
          </p>
        </div>
      </div>

      {/* Queue */}
      <div className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
        <div className="space-y-4 border-b border-[#EAEAEA] p-5">
          <div>
            <h3 className="font-bold">All human handoffs</h3>
            <p className="mt-1 text-xs text-[#929292]">
              Every conversation referred to a human support representative.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#929292]">
                ⌕
              </span>

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search customers, references or reasons..."
                className="w-full rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#EC5424]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-3 py-2.5 text-sm outline-none focus:border-[#EC5424]"
            >
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              onClick={() => void loadHandoffs()}
              className="ml-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4 p-6">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex animate-pulse gap-4">
                <div className="h-10 w-10 rounded-xl bg-[#F0F0F0]" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-1/3 rounded bg-[#F0F0F0]" />
                  <div className="h-3 w-2/3 rounded bg-[#F0F0F0]" />
                </div>
              </div>
            ))}
          </div>
        ) : handoffs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FCE5DC] text-2xl">
              <span aria-hidden="true">♧</span>
            </div>

            <h4 className="mt-4 font-semibold">No human handoffs found</h4>

            <p className="mt-2 text-sm text-[#929292]">
              {search || statusFilter
                ? "Try changing your search or filters."
                : "Conversations referred to human support will appear here."}
            </p>

            {(search || statusFilter) && (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setPage(1);
                }}
                className="mt-4 text-xs font-semibold text-[#EC5424] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-[#FAFAFA] text-[10px] uppercase tracking-wider text-[#929292]">
                <tr>
                  <th className="px-5 py-4 font-semibold">Handoff</th>
                  <th className="px-5 py-4 font-semibold">Customer</th>
                  <th className="px-5 py-4 font-semibold">Referral source</th>
                  <th className="px-5 py-4 font-semibold">Assigned to</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Date created</th>
                  <th className="px-5 py-4 font-semibold"> </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F0F0F0]">
                {handoffs.map((handoff) => (
                  <tr
                    key={handoff.id}
                    className="transition hover:bg-[#FAFAFA]"
                  >
                    <td className="px-5 py-4">
                      <button
                        onClick={() => void openHandoff(handoff.id)}
                        className="text-left"
                      >
                        <p className="max-w-[260px] truncate text-sm font-semibold text-[#141A1C]">
                          {handoff.reason}
                        </p>
                        <p className="mt-1 text-xs text-[#929292]">
                          {handoff.conversation?.title ||
                            "Untitled conversation"}
                        </p>
                      </button>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold">
                        {getCustomerName(
                          handoff.conversation?.customer ?? null
                        )}
                      </p>
                      <p className="mt-1 text-xs text-[#929292]">
                        {handoff.conversation?.customer?.customerRef ?? "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${sourceStyle(handoff.source)}`}
                      >
                        {formatLabel(handoff.source)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm text-[#737373]">
                      {handoff.assignedTo || "Unassigned"}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyle(handoff.status)}`}
                      >
                        {formatLabel(handoff.status)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs text-[#737373]">
                      {formatDate(handoff.createdAt)}
                    </td>

                    <td className="px-5 py-4">
                      <button
                        onClick={() => void openHandoff(handoff.id)}
                        className="rounded-lg border border-[#EAEAEA] px-3 py-2 text-xs font-semibold transition hover:border-[#EC5424] hover:text-[#EC5424]"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-[#EAEAEA] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#929292]">
            Showing {handoffs.length} of {total} handoffs
          </p>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-[#EAEAEA] px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="px-2 text-xs text-[#737373]">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="rounded-lg border border-[#EAEAEA] px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Handoff details modal */}
      {(selectedHandoff || detailsLoading || detailsError) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal heading */}
            <div className="flex items-center justify-between border-b border-[#EAEAEA] p-5 sm:p-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#EC5424]">
                  Human handoff details
                </p>

                <h3 className="mt-1 truncate font-bold">
                  {selectedHandoff?.conversation?.title ||
                    "Handoff information"}
                </h3>
              </div>

              <button
                onClick={closeModal}
                aria-label="Close handoff"
                className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-lg hover:bg-[#EAEAEA]"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto bg-[#F8F8F8] p-4 sm:p-6">
              {detailsLoading ? (
                <div className="py-16 text-center text-sm text-[#929292]">
                  Loading handoff details...
                </div>
              ) : detailsError ? (
                <div className="rounded-xl bg-red-50 p-5 text-sm text-red-700">
                  {detailsError}
                </div>
              ) : selectedHandoff ? (
                <div className="space-y-5">
                  {/* Customer information */}
                  <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#929292]">
                      Customer information
                    </p>

                    <p className="mt-2 text-sm font-bold">
                      {getCustomerName(
                        selectedHandoff.conversation?.customer ?? null
                      )}
                    </p>

                    <p className="mt-1 text-xs text-[#737373]">
                      Customer reference:{" "}
                      {selectedHandoff.conversation?.customer?.customerRef ??
                        "—"}
                    </p>

                    <p className="mt-1 text-xs text-[#737373]">
                      Segment:{" "}
                      {selectedHandoff.conversation?.customer?.segment ?? "—"}
                    </p>

                    <div className="mt-4 grid gap-3 border-t border-[#F0F0F0] pt-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-[#929292]">Channel</p>
                        <p className="mt-1 text-sm font-semibold">
                          {selectedHandoff.conversation?.channel ?? "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-[#929292]">Messages</p>
                        <p className="mt-1 text-sm font-semibold">
                          {selectedHandoff.conversation?._count?.messages ??
                            selectedHandoff.conversation?.messages?.length ??
                            0}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-[#929292]">
                          Conversation status
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {selectedHandoff.conversation?.isResolved
                            ? "Resolved"
                            : "Open"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Referral details */}
                  <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#929292]">
                        Referral information
                      </p>

                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyle(selectedHandoff.status)}`}
                      >
                        {formatLabel(selectedHandoff.status)}
                      </span>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#555555]">
                      {selectedHandoff.reason}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[#929292]">
                        Referral source:
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${sourceStyle(selectedHandoff.source)}`}
                      >
                        {formatLabel(selectedHandoff.source)}
                      </span>
                    </div>

                    {selectedHandoff.complaintId && (
                      <p className="mt-2 text-xs text-[#737373]">
                        Linked complaint: {selectedHandoff.complaintId}
                      </p>
                    )}

                    <p className="mt-3 text-xs text-[#929292]">
                      Created {formatDate(selectedHandoff.createdAt)}
                    </p>
                  </div>

                  {/* Conversation management */}
                  <div className="space-y-5 rounded-xl border border-[#EAEAEA] bg-white p-4">
                    <div>
                      <p className="text-sm font-bold">
                        Representative takeover
                      </p>
                      <p className="mt-1 text-xs text-[#929292]">
                        Claim this handoff to respond in the customer's
                        original conversation.
                      </p>
                    </div>

                    {/* Current assignment */}
                    <div className="rounded-xl bg-[#FAFAFA] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#929292]">
                        Assigned representative
                      </p>

                      <p className="mt-2 text-sm font-bold text-[#141A1C]">
                        {selectedHandoff.assignedTo ||
                          "Awaiting assignment"}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyle(selectedHandoff.status)}`}
                        >
                          {formatLabel(selectedHandoff.status)}
                        </span>

                        {selectedHandoff.assignedTo ===
                          representativeName.trim() && (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                            Assigned to you
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Claim control */}
                    {selectedHandoff.status === "PENDING" &&
                      !selectedHandoff.assignedTo && (
                        <div>
                          <label
                            htmlFor="handoff-representative-name"
                            className="text-xs font-semibold text-[#737373]"
                          >
                            Representative name
                          </label>

                          <input
                            id="handoff-representative-name"
                            value={representativeName}
                            onChange={(event) =>
                              setRepresentativeName(event.target.value)
                            }
                            placeholder="Enter representative name"
                            className="mt-2 w-full rounded-xl border border-[#EAEAEA] bg-white px-3 py-3 text-sm outline-none transition focus:border-[#EC5424]"
                          />

                          <p className="mt-2 text-[11px] text-[#929292]">
                            Prototype identity only. Production use requires
                            authenticated representative accounts.
                          </p>

                          <button
                            onClick={() => void claimHandoff()}
                            disabled={claiming || !representativeName.trim()}
                            className="mt-3 w-full rounded-xl bg-[#EC5424] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#D9471C] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {claiming
                              ? "Claiming handoff..."
                              : "Claim Handoff"}
                          </button>
                        </div>
                      )}

                    {/* Assigned to another representative */}
                    {selectedHandoff.assignedTo &&
                      selectedHandoff.assignedTo !==
                        representativeName.trim() &&
                      selectedHandoff.status !== "RESOLVED" && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-sm font-semibold text-amber-800">
                            This handoff is already assigned.
                          </p>
                          <p className="mt-1 text-xs leading-5 text-amber-700">
                            It is currently being handled by{" "}
                            <strong>{selectedHandoff.assignedTo}</strong>.
                          </p>
                        </div>
                      )}

                    {/* Assigned representative controls */}
                    {selectedHandoff.assignedTo ===
                      representativeName.trim() &&
                      ["ASSIGNED", "IN_PROGRESS"].includes(
                        selectedHandoff.status
                      ) && (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                            <p className="text-xs font-semibold text-emerald-800">
                              You are handling this conversation.
                            </p>
                            <p className="mt-1 text-xs text-emerald-700">
                              Your replies will appear in the customer's
                              existing chat thread.
                            </p>
                          </div>

                          <div>
                            <label
                              htmlFor="handoff-agent-reply"
                              className="text-xs font-semibold text-[#737373]"
                            >
                              Your reply
                            </label>

                            <textarea
                              id="handoff-agent-reply"
                              value={replyContent}
                              onChange={(event) =>
                                setReplyContent(event.target.value)
                              }
                              placeholder="Type your response to the customer..."
                              rows={4}
                              maxLength={5000}
                              disabled={sendingReply || resolving}
                              className="mt-2 w-full resize-y rounded-xl border border-[#EAEAEA] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#EC5424] disabled:opacity-50"
                            />

                            <div className="mt-2 flex items-center justify-between">
                              <p className="text-[10px] text-[#929292]">
                                Replies are saved to the original conversation.
                              </p>
                              <p className="text-[10px] tabular-nums text-[#929292]">
                                {replyContent.length}/5000
                              </p>
                            </div>

                            <button
                              onClick={() => void sendAgentReply()}
                              disabled={
                                sendingReply ||
                                resolving ||
                                !replyContent.trim()
                              }
                              className="mt-3 w-full rounded-xl bg-[#EC5424] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#D9471C] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {sendingReply
                                ? "Sending reply..."
                                : "Send Reply"}
                            </button>
                          </div>

                          <button
                            onClick={() => void resolveHandoff()}
                            disabled={resolving || sendingReply}
                            className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {resolving
                              ? "Resolving handoff..."
                              : "Resolve Handoff"}
                          </button>
                        </div>
                      )}

                    {/* Resolved state */}
                    {selectedHandoff.status === "RESOLVED" && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm font-semibold text-emerald-800">
                          Handoff resolved
                        </p>
                        <p className="mt-1 text-xs text-emerald-700">
                          This human-support handoff has been completed.
                        </p>
                      </div>
                    )}

                    {replyError && (
                      <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
                        {replyError}
                      </p>
                    )}

                    {replySuccess && (
                      <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
                        {replySuccess}
                      </p>
                    )}
                  </div>

                  {/* Original conversation history */}
                  <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
                    <div className="mb-4">
                      <h4 className="text-sm font-bold">
                        Original conversation
                      </h4>

                      <p className="mt-1 text-xs text-[#929292]">
                        Complete conversation history associated with this
                        handoff.

                        {lastRefreshed && (
                          <span className="ml-2 text-emerald-600">
                            Live · Updated{" "}
                            {lastRefreshed.toLocaleTimeString("en-NG")}
                          </span>
                        )}
                      </p>
                    </div>

                    {selectedHandoff.conversation?.messages?.length ? (
                      <div className="space-y-4">
                        {selectedHandoff.conversation.messages.map(
                          (message) => {
                            const isUser = message.role === "USER";
                            const isAgent = message.role === "AGENT";

                            return (
                              <div
                                key={message.id}
                                className={`flex ${
                                  isUser ? "justify-end" : "justify-start"
                                }`}
                              >
                                <div
                                  className={`max-w-[90%] rounded-2xl p-4 sm:max-w-[80%] ${
                                    isUser
                                      ? "rounded-br-md bg-[#EC5424] text-white"
                                      : isAgent
                                        ? "rounded-bl-md border border-blue-100 bg-blue-50 text-[#141A1C]"
                                        : "rounded-bl-md border border-[#EAEAEA] bg-[#FAFAFA] text-[#141A1C]"
                                  }`}
                                >
                                  <div className="mb-2 flex items-center justify-between gap-5">
                                    <span
                                      className={`text-[10px] font-bold uppercase tracking-wider ${
                                        isUser
                                          ? "text-white/70"
                                          : isAgent
                                            ? "text-blue-700"
                                            : "text-[#EC5424]"
                                      }`}
                                    >
                                      {isUser
                                        ? "Customer"
                                        : isAgent
                                          ? "Customer Service"
                                          : "Bobby"}
                                    </span>

                                    <span
                                      className={`text-[10px] ${
                                        isUser
                                          ? "text-white/60"
                                          : "text-[#929292]"
                                      }`}
                                    >
                                      {formatDate(message.createdAt)}
                                    </span>
                                  </div>

                                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                    {message.content}
                                  </p>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-[#929292]">
                        No conversation messages are available.
                      </p>
                    )}
                  </div>

                  {/* Footer information */}
                  <div className="flex flex-wrap justify-between gap-3 border-t border-[#EAEAEA] pt-4 text-[11px] text-[#929292]">
                    <span>
                      Created: {formatDate(selectedHandoff.createdAt)}
                    </span>
                    <span>
                      Updated: {formatDate(selectedHandoff.updatedAt)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#EAEAEA] p-4">
              <p className="text-[11px] text-[#929292]">
                Human handoff management
              </p>

              <button
                onClick={closeModal}
                className="rounded-xl bg-[#141A1C] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#303638]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
