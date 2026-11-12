"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

type EscalationStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED";

interface Customer {
  firstName: string;
  lastName: string;
  customerRef: string;
  segment: string;
}

interface Message {
  id?: string;
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

interface Escalation {
  id: string;
  conversationId: string;
  reason: string;
  status: EscalationStatus;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  conversation: Conversation;
}

interface EscalationResponse {
  success: boolean;
  escalations: Escalation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const STATUSES: EscalationStatus[] = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
];

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

function statusStyle(status: EscalationStatus) {
  const styles: Record<EscalationStatus, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    ASSIGNED: "bg-blue-50 text-blue-700",
    IN_PROGRESS: "bg-purple-50 text-purple-700",
    RESOLVED: "bg-emerald-50 text-emerald-700",
  };

  return styles[status];
}

function getCustomerName(customer: Customer | null) {
  if (!customer) return "Unknown customer";
  return `${customer.firstName} ${customer.lastName}`;
}

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedEscalation, setSelectedEscalation] =
    useState<Escalation | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const [assignedTo, setAssignedTo] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");

  const loadEscalations = useCallback(async () => {
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
        `${API_URL}/api/escalations?${params.toString()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Unable to retrieve escalations.");
      }

      const data: EscalationResponse = await response.json();

      if (!data.success) {
        throw new Error("The escalations request was unsuccessful.");
      }

      setEscalations(data.escalations ?? []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(Math.max(1, data.pagination?.totalPages ?? 1));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading escalations."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void loadEscalations();
  }, [loadEscalations]);

  const openEscalation = async (id: string) => {
    setSelectedEscalation(null);
    setDetailsError("");
    setUpdateError("");
    setUpdateSuccess("");
    setDetailsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/escalations/${id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to retrieve this escalation.");
      }

      const data = await response.json();

      if (!data.success || !data.escalation) {
        throw new Error("The escalation details could not be retrieved.");
      }

      setSelectedEscalation(data.escalation);
      setAssignedTo(data.escalation.assignedTo ?? "");
    } catch (err) {
      setDetailsError(
        err instanceof Error
          ? err.message
          : "Unable to load escalation details."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const updateEscalation = async (
    updates: { status?: EscalationStatus; assignedTo?: string | null }
  ) => {
    if (!selectedEscalation || updating) return;

    setUpdating(true);
    setUpdateError("");
    setUpdateSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/escalations/${selectedEscalation.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update this escalation.");
      }

      const updatedEscalation: Escalation = data.escalation;

      setSelectedEscalation(updatedEscalation);
      setAssignedTo(updatedEscalation.assignedTo ?? "");

      setUpdateSuccess("Escalation updated successfully.");

      await loadEscalations();
    } catch (err) {
      setUpdateError(
        err instanceof Error
          ? err.message
          : "Something went wrong while updating."
      );
    } finally {
      setUpdating(false);
    }
  };

  const saveAssignment = () => {
    const trimmed = assignedTo.trim();

    if (!trimmed) {
      setUpdateError("Enter a representative's name or clear the assignment.");
      return;
    }

    void updateEscalation({ assignedTo: trimmed });
  };

  const clearAssignment = () => {
    setAssignedTo("");
    void updateEscalation({ assignedTo: null });
  };

  const closeModal = () => {
    setSelectedEscalation(null);
    setDetailsError("");
    setUpdateError("");
    setUpdateSuccess("");
    setAssignedTo("");
  };

  const pendingOnPage = escalations.filter(
    (item) => item.status === "PENDING"
  ).length;

  const activeOnPage = escalations.filter(
    (item) =>
      item.status === "ASSIGNED" || item.status === "IN_PROGRESS"
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
            Escalations
          </h2>

          <p className="mt-2 text-sm text-[#737373]">
            Review escalated conversations, assign support representatives,
            and monitor resolution progress.
          </p>
        </div>

        <button
          onClick={() => void loadEscalations()}
          disabled={loading}
          className="flex items-center justify-center gap-2 self-start rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F8F8F8] disabled:opacity-50 sm:self-auto"
        >
          <span aria-hidden="true">↻</span>
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Total escalations</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : total}
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Matching escalation records
          </p>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Pending on this page</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : pendingOnPage}
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Awaiting assignment or review
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
      </div>

      {/* Escalations table */}
      <div className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
        <div className="space-y-4 border-b border-[#EAEAEA] p-5">
          <div>
            <h3 className="font-bold">All escalations</h3>
            <p className="mt-1 text-xs text-[#929292]">
              Select an escalation to review its conversation and manage it.
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
                placeholder="Search escalations..."
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
              onClick={() => void loadEscalations()}
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
        ) : escalations.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FCE5DC] text-2xl">
              <span aria-hidden="true">↗</span>
            </div>

            <h4 className="mt-4 font-semibold">No escalations found</h4>

            <p className="mt-2 text-sm text-[#929292]">
              {search || statusFilter
                ? "Try changing your search or filters."
                : "Escalated customer conversations will appear here."}
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
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-[#FAFAFA] text-[10px] uppercase tracking-wider text-[#929292]">
                <tr>
                  <th className="px-5 py-4 font-semibold">Escalation</th>
                  <th className="px-5 py-4 font-semibold">Customer</th>
                  <th className="px-5 py-4 font-semibold">Assigned to</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Date created</th>
                  <th className="px-5 py-4 font-semibold"> </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F0F0F0]">
                {escalations.map((escalation) => (
                  <tr
                    key={escalation.id}
                    className="transition hover:bg-[#FAFAFA]"
                  >
                    <td className="px-5 py-4">
                      <button
                        onClick={() => void openEscalation(escalation.id)}
                        className="text-left"
                      >
                        <p className="max-w-[280px] truncate text-sm font-semibold text-[#141A1C]">
                          {escalation.reason}
                        </p>
                        <p className="mt-1 text-xs text-[#929292]">
                          {escalation.conversation?.title ||
                            "Untitled conversation"}
                        </p>
                      </button>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold">
                        {getCustomerName(
                          escalation.conversation?.customer ?? null
                        )}
                      </p>
                      <p className="mt-1 text-xs text-[#929292]">
                        {escalation.conversation?.customer?.customerRef ?? "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm text-[#737373]">
                      {escalation.assignedTo || "Unassigned"}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyle(escalation.status)}`}
                      >
                        {formatLabel(escalation.status)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs text-[#737373]">
                      {formatDate(escalation.createdAt)}
                    </td>

                    <td className="px-5 py-4">
                      <button
                        onClick={() => void openEscalation(escalation.id)}
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
            Showing {escalations.length} of {total} escalations
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

      {/* Escalation details modal */}
      {(selectedEscalation || detailsLoading || detailsError) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] p-5 sm:p-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#EC5424]">
                  Escalation details
                </p>

                <h3 className="mt-1 truncate font-bold">
                  {selectedEscalation?.conversation?.title ||
                    "Escalation information"}
                </h3>
              </div>

              <button
                onClick={closeModal}
                aria-label="Close escalation"
                className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-lg hover:bg-[#EAEAEA]"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto bg-[#F8F8F8] p-4 sm:p-6">
              {detailsLoading ? (
                <div className="py-16 text-center text-sm text-[#929292]">
                  Loading escalation details...
                </div>
              ) : detailsError ? (
                <div className="rounded-xl bg-red-50 p-5 text-sm text-red-700">
                  {detailsError}
                </div>
              ) : selectedEscalation ? (
                <div className="space-y-5">
                  {/* Customer and conversation information */}
                  <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#929292]">
                      Customer information
                    </p>

                    <p className="mt-2 text-sm font-bold">
                      {getCustomerName(
                        selectedEscalation.conversation?.customer ?? null
                      )}
                    </p>

                    <p className="mt-1 text-xs text-[#737373]">
                      Customer reference:{" "}
                      {selectedEscalation.conversation?.customer
                        ?.customerRef ?? "—"}
                    </p>

                    <p className="mt-1 text-xs text-[#737373]">
                      Segment:{" "}
                      {selectedEscalation.conversation?.customer?.segment ??
                        "—"}
                    </p>

                    <div className="mt-4 grid gap-3 border-t border-[#F0F0F0] pt-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-[#929292]">Channel</p>
                        <p className="mt-1 text-sm font-semibold">
                          {selectedEscalation.conversation?.channel ?? "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-[#929292]">Messages</p>
                        <p className="mt-1 text-sm font-semibold">
                          {selectedEscalation.conversation?._count?.messages ??
                            selectedEscalation.conversation?.messages?.length ??
                            0}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-[#929292]">
                          Conversation status
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {selectedEscalation.conversation?.isResolved
                            ? "Resolved"
                            : "Open"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Escalation reason */}
                  <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#929292]">
                        Reason for escalation
                      </p>

                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyle(selectedEscalation.status)}`}
                      >
                        {formatLabel(selectedEscalation.status)}
                      </span>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#555555]">
                      {selectedEscalation.reason}
                    </p>

                    <p className="mt-3 text-xs text-[#929292]">
                      Created {formatDate(selectedEscalation.createdAt)}
                    </p>
                  </div>

                  {/* Assignment and status controls */}
                  <div className="space-y-4 rounded-xl border border-[#EAEAEA] bg-white p-4">
                    <div>
                      <p className="text-sm font-bold">
                        Manage escalation
                      </p>
                      <p className="mt-1 text-xs text-[#929292]">
                        Update its status or assign it to a support
                        representative.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="escalation-status"
                        className="text-xs font-semibold text-[#737373]"
                      >
                        Escalation status
                      </label>

                      <select
                        id="escalation-status"
                        value={selectedEscalation.status}
                        disabled={updating}
                        onChange={(event) =>
                          void updateEscalation({
                            status: event.target.value as EscalationStatus,
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-[#EAEAEA] bg-white px-3 py-3 text-sm outline-none focus:border-[#EC5424] disabled:opacity-50"
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {formatLabel(status)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="escalation-assignee"
                        className="text-xs font-semibold text-[#737373]"
                      >
                        Assigned representative
                      </label>

                      <input
                        id="escalation-assignee"
                        value={assignedTo}
                        disabled={updating}
                        onChange={(event) => setAssignedTo(event.target.value)}
                        placeholder="Enter representative's name"
                        className="mt-2 w-full rounded-xl border border-[#EAEAEA] bg-white px-3 py-3 text-sm outline-none focus:border-[#EC5424] disabled:opacity-50"
                      />

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={saveAssignment}
                          disabled={
                            updating ||
                            !assignedTo.trim() ||
                            assignedTo.trim() ===
                              selectedEscalation.assignedTo
                          }
                          className="rounded-xl bg-[#EC5424] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#D9471C] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Save assignment
                        </button>

                        {selectedEscalation.assignedTo && (
                          <button
                            onClick={clearAssignment}
                            disabled={updating}
                            className="rounded-xl border border-[#EAEAEA] px-4 py-2.5 text-xs font-semibold text-[#737373] transition hover:bg-[#FAFAFA] disabled:opacity-50"
                          >
                            Clear assignment
                          </button>
                        )}
                      </div>
                    </div>

                    {updating && (
                      <p className="text-xs text-[#929292]">
                        Saving changes...
                      </p>
                    )}

                    {updateSuccess && (
                      <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
                        {updateSuccess}
                      </p>
                    )}

                    {updateError && (
                      <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
                        {updateError}
                      </p>
                    )}
                  </div>

                  {/* Conversation history */}
                  <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
                    <div className="mb-4">
                      <h4 className="text-sm font-bold">
                        Conversation history
                      </h4>
                      <p className="mt-1 text-xs text-[#929292]">
                        Messages associated with this escalation.
                      </p>
                    </div>

                    {selectedEscalation.conversation?.messages?.length ? (
                      <div className="space-y-4">
                        {selectedEscalation.conversation.messages.map(
                          (message, index) => {
                            const isUser = message.role === "USER";

                            return (
                              <div
                                key={
                                  message.id ??
                                  `${message.createdAt}-${index}`
                                }
                                className={`flex ${
                                  isUser ? "justify-end" : "justify-start"
                                }`}
                              >
                                <div
                                  className={`max-w-[90%] rounded-2xl p-4 sm:max-w-[80%] ${
                                    isUser
                                      ? "rounded-br-md bg-[#EC5424] text-white"
                                      : "rounded-bl-md border border-[#EAEAEA] bg-[#FAFAFA] text-[#141A1C]"
                                  }`}
                                >
                                  <div className="mb-2 flex items-center justify-between gap-5">
                                    <span
                                      className={`text-[10px] font-bold uppercase tracking-wider ${
                                        isUser
                                          ? "text-white/70"
                                          : "text-[#EC5424]"
                                      }`}
                                    >
                                      {isUser ? "Customer" : message.role}
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

                  <div className="flex flex-wrap justify-between gap-3 border-t border-[#EAEAEA] pt-4 text-[11px] text-[#929292]">
                    <span>
                      Created: {formatDate(selectedEscalation.createdAt)}
                    </span>
                    <span>
                      Updated: {formatDate(selectedEscalation.updatedAt)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#EAEAEA] p-4">
              <p className="text-[11px] text-[#929292]">
                Escalation management
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