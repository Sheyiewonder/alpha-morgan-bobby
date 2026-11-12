
"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

type ComplaintStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface Complaint {
  id: string;
  reference: string;
  customerId: string;
  subject: string;
  description: string;
  category: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  createdAt: string;
  updatedAt: string;
  customer: {
    firstName: string;
    lastName: string;
    customerRef: string;
    segment: string;
  } | null;
}

interface ComplaintResponse {
  success: boolean;
  complaints: Complaint[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const STATUSES: ComplaintStatus[] = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

const PRIORITIES: ComplaintPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
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

function statusStyle(status: ComplaintStatus) {
  const styles: Record<ComplaintStatus, string> = {
    OPEN: "bg-blue-50 text-blue-700",
    ACKNOWLEDGED: "bg-amber-50 text-amber-700",
    IN_PROGRESS: "bg-purple-50 text-purple-700",
    RESOLVED: "bg-emerald-50 text-emerald-700",
    CLOSED: "bg-gray-100 text-gray-600",
  };

  return styles[status];
}

function priorityStyle(priority: ComplaintPriority) {
  const styles: Record<ComplaintPriority, string> = {
    LOW: "bg-gray-100 text-gray-600",
    MEDIUM: "bg-blue-50 text-blue-700",
    HIGH: "bg-orange-50 text-orange-700",
    URGENT: "bg-red-50 text-red-700",
  };

  return styles[priority];
}

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [selectedComplaint, setSelectedComplaint] =
    useState<Complaint | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });

      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);

      const response = await fetch(
        `${API_URL}/api/complaints?${params.toString()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Unable to retrieve complaints.");
      }

      const data: ComplaintResponse = await response.json();

      if (!data.success) {
        throw new Error("The complaints request was unsuccessful.");
      }

      setComplaints(data.complaints ?? []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(Math.max(1, data.pagination?.totalPages ?? 1));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading complaints."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => {
    void loadComplaints();
  }, [loadComplaints]);

  const openComplaint = async (id: string) => {
    setSelectedComplaint(null);
    setDetailsError("");
    setUpdateError("");
    setUpdateSuccess("");
    setDetailsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/complaints/${id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to retrieve this complaint.");
      }

      const data = await response.json();
      setSelectedComplaint(data.complaint ?? data);
    } catch (err) {
      setDetailsError(
        err instanceof Error
          ? err.message
          : "Unable to load complaint details."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const updateComplaint = async (
    field: "status" | "priority",
    value: ComplaintStatus | ComplaintPriority
  ) => {
    if (!selectedComplaint || updating) return;

    setUpdating(true);
    setUpdateError("");
    setUpdateSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/complaints/${selectedComplaint.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ [field]: value }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update this complaint.");
      }

      const updatedComplaint: Complaint =
        data.complaint ?? data;

      setSelectedComplaint(updatedComplaint);
      setUpdateSuccess(
        `${field === "status" ? "Status" : "Priority"} updated successfully.`
      );

      await loadComplaints();
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

  const closeModal = () => {
    setSelectedComplaint(null);
    setDetailsError("");
    setUpdateError("");
    setUpdateSuccess("");
  };

  return (
    <div className="space-y-7 animate-fade-up">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#EC5424]">
            Customer support
          </p>

          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Complaints
          </h2>

          <p className="mt-2 text-sm text-[#737373]">
            Review customer complaints, monitor their priority, and manage
            resolution progress.
          </p>
        </div>

        <button
          onClick={() => void loadComplaints()}
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
          <p className="text-xs text-[#929292]">Total complaints</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : total}
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Matching complaint records
          </p>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">On this page</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : complaints.length}
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Complaints displayed
          </p>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Current page</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {page}
            <span className="text-lg text-[#929292]"> / {totalPages}</span>
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Complaint records
          </p>
        </div>
      </div>

      {/* Complaints table */}
      <div className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
        <div className="space-y-4 border-b border-[#EAEAEA] p-5">
          <div>
            <h3 className="font-bold">All complaints</h3>
            <p className="mt-1 text-xs text-[#929292]">
              Select a complaint to review its details and update its status.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_190px_190px]">
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
                placeholder="Search complaints..."
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

            <select
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-3 py-2.5 text-sm outline-none focus:border-[#EC5424]"
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {formatLabel(priority)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              onClick={() => void loadComplaints()}
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
        ) : complaints.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FCE5DC] text-2xl">
              <span aria-hidden="true">▤</span>
            </div>

            <h4 className="mt-4 font-semibold">
              No complaints found
            </h4>

            <p className="mt-2 text-sm text-[#929292]">
              {search || statusFilter || priorityFilter
                ? "Try changing your search or filters."
                : "Customer complaints will appear here when submitted."}
            </p>

            {(search || statusFilter || priorityFilter) && (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setPriorityFilter("");
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
                  <th className="px-5 py-4 font-semibold">Complaint</th>
                  <th className="px-5 py-4 font-semibold">Customer</th>
                  <th className="px-5 py-4 font-semibold">Priority</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Date submitted</th>
                  <th className="px-5 py-4 font-semibold"> </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F0F0F0]">
                {complaints.map((complaint) => (
                  <tr
                    key={complaint.id}
                    className="transition hover:bg-[#FAFAFA]"
                  >
                    <td className="px-5 py-4">
                      <button
                        onClick={() => void openComplaint(complaint.id)}
                        className="text-left"
                      >
                        <p className="text-xs font-bold text-[#EC5424]">
                          {complaint.reference}
                        </p>
                        <p className="mt-1 max-w-[250px] truncate text-sm font-semibold text-[#141A1C]">
                          {complaint.subject}
                        </p>
                        <p className="mt-1 text-xs text-[#929292]">
                          {complaint.category}
                        </p>
                      </button>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold">
                        {complaint.customer
                          ? `${complaint.customer.firstName} ${complaint.customer.lastName}`
                          : "Unknown customer"}
                      </p>
                      <p className="mt-1 text-xs text-[#929292]">
                        {complaint.customer?.customerRef ?? "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${priorityStyle(complaint.priority)}`}
                      >
                        {formatLabel(complaint.priority)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyle(complaint.status)}`}
                      >
                        {formatLabel(complaint.status)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs text-[#737373]">
                      {formatDate(complaint.createdAt)}
                    </td>

                    <td className="px-5 py-4">
                      <button
                        onClick={() => void openComplaint(complaint.id)}
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
            Showing {complaints.length} of {total} complaints
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

      {/* Complaint details modal */}
      {(selectedComplaint || detailsLoading || detailsError) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] p-5 sm:p-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#EC5424]">
                  Complaint details
                </p>

                <h3 className="mt-1 truncate font-bold">
                  {selectedComplaint?.reference ?? "Complaint information"}
                </h3>
              </div>

              <button
                onClick={closeModal}
                aria-label="Close complaint"
                className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-lg hover:bg-[#EAEAEA]"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6">
              {detailsLoading ? (
                <div className="py-16 text-center text-sm text-[#929292]">
                  Loading complaint details...
                </div>
              ) : detailsError ? (
                <div className="rounded-xl bg-red-50 p-5 text-sm text-red-700">
                  {detailsError}
                </div>
              ) : selectedComplaint ? (
                <div className="space-y-6">
                  {/* Customer information */}
                  <div className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#929292]">
                      Customer information
                    </p>

                    <p className="mt-2 text-sm font-bold">
                      {selectedComplaint.customer
                        ? `${selectedComplaint.customer.firstName} ${selectedComplaint.customer.lastName}`
                        : "Unknown customer"}
                    </p>

                    <p className="mt-1 text-xs text-[#737373]">
                      Customer reference:{" "}
                      {selectedComplaint.customer?.customerRef ?? "—"}
                    </p>

                    <p className="mt-1 text-xs text-[#737373]">
                      Segment:{" "}
                      {selectedComplaint.customer?.segment ?? "—"}
                    </p>
                  </div>

                  {/* Complaint description */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#FCE5DC] px-2.5 py-1 text-[10px] font-semibold text-[#C7471D]">
                        {selectedComplaint.category}
                      </span>

                      <span className="text-xs text-[#929292]">
                        Submitted {formatDate(selectedComplaint.createdAt)}
                      </span>
                    </div>

                    <h4 className="mt-4 text-lg font-bold">
                      {selectedComplaint.subject}
                    </h4>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#555555]">
                      {selectedComplaint.description}
                    </p>
                  </div>

                  {/* Status and priority controls */}
                  <div className="grid gap-4 rounded-xl border border-[#EAEAEA] p-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="complaint-status"
                        className="text-xs font-semibold text-[#737373]"
                      >
                        Complaint status
                      </label>

                      <select
                        id="complaint-status"
                        value={selectedComplaint.status}
                        disabled={updating}
                        onChange={(event) =>
                          void updateComplaint(
                            "status",
                            event.target.value as ComplaintStatus
                          )
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
                        htmlFor="complaint-priority"
                        className="text-xs font-semibold text-[#737373]"
                      >
                        Complaint priority
                      </label>

                      <select
                        id="complaint-priority"
                        value={selectedComplaint.priority}
                        disabled={updating}
                        onChange={(event) =>
                          void updateComplaint(
                            "priority",
                            event.target.value as ComplaintPriority
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-[#EAEAEA] bg-white px-3 py-3 text-sm outline-none focus:border-[#EC5424] disabled:opacity-50"
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {formatLabel(priority)}
                          </option>
                        ))}
                      </select>
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

                  <div className="flex flex-wrap justify-between gap-3 border-t border-[#EAEAEA] pt-4 text-[11px] text-[#929292]">
                    <span>Created: {formatDate(selectedComplaint.createdAt)}</span>
                    <span>Updated: {formatDate(selectedComplaint.updatedAt)}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#EAEAEA] p-4">
              <p className="text-[11px] text-[#929292]">
                Complaint reference:{" "}
                {selectedComplaint?.reference ?? "—"}
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
