
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

interface Conversation {
  id: string;
  title: string | null;
  channel: string;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
  customer: {
    firstName: string;
    lastName: string;
    customerRef: string;
    segment: string;
  } | null;
  messages: {
    role: string;
    content: string;
    createdAt: string;
  }[];
  _count: {
    messages: number;
    escalations: number;
  };
}

interface Message {
  id?: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ConversationDetails extends Conversation {
  messages: Message[];
}

interface ConversationResponse {
  success: boolean;
  conversations: Conversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getInitials(conversation: Conversation) {
  if (conversation.customer) {
    return `${conversation.customer.firstName[0] ?? ""}${conversation.customer.lastName[0] ?? ""}`.toUpperCase();
  }

  return "GU";
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ConversationDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/conversations?page=${page}&limit=10`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Unable to retrieve conversations.");
      }

      const data: ConversationResponse = await response.json();

      setConversations(data.conversations ?? []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(Math.max(1, data.pagination?.totalPages ?? 1));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading conversations."
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const openConversation = async (id: string) => {
    setSelectedId(id);
    setDetails(null);
    setDetailsError("");
    setDetailsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/conversations/${id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to retrieve this conversation.");
      }

      const data = await response.json();
      const conversation = data.conversation ?? data;

      setDetails(conversation);
    } catch (err) {
      setDetailsError(
        err instanceof Error ? err.message : "Unable to load conversation."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const customerName = conversation.customer
        ? `${conversation.customer.firstName} ${conversation.customer.lastName}`
        : "guest customer";

      const latestMessage = conversation.messages[0]?.content ?? "";

      return (
        conversation.title?.toLowerCase().includes(query) ||
        customerName.toLowerCase().includes(query) ||
        conversation.id.toLowerCase().includes(query) ||
        latestMessage.toLowerCase().includes(query)
      );
    });
  }, [conversations, search]);

  return (
    <div className="space-y-7 animate-fade-up">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#EC5424]">
            Customer support
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Conversations
          </h2>
          <p className="mt-2 text-sm text-[#737373]">
            Monitor customer interactions and review Bobby&apos;s responses.
          </p>
        </div>

        <button
          onClick={() => void loadConversations()}
          disabled={loading}
          className="flex items-center justify-center gap-2 self-start rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F8F8F8] disabled:opacity-50 sm:self-auto"
        >
          <span aria-hidden="true">↻</span>
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Total conversations</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : total}
          </p>
          <p className="mt-1 text-xs text-[#929292]">All saved conversations</p>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">On this page</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : conversations.length}
          </p>
          <p className="mt-1 text-xs text-[#929292]">Conversations displayed</p>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Current page</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {page} <span className="text-lg text-[#929292]">/ {totalPages}</span>
          </p>
          <p className="mt-1 text-xs text-[#929292]">Conversation records</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#EAEAEA] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold">All conversations</h3>
            <p className="mt-1 text-xs text-[#929292]">
              Select a conversation to inspect its messages.
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#929292]">
              ⌕
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#EC5424]"
            />
          </div>
        </div>

        {error && (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              onClick={() => void loadConversations()}
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
                <div className="h-11 w-11 rounded-full bg-[#F0F0F0]" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-1/3 rounded bg-[#F0F0F0]" />
                  <div className="h-3 w-2/3 rounded bg-[#F0F0F0]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FCE5DC] text-2xl">
              💬
            </div>
            <h4 className="mt-4 font-semibold">No conversations found</h4>
            <p className="mt-2 text-sm text-[#929292]">
              {search
                ? "Try another search term."
                : "Customer conversations will appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0F0F0]">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => void openConversation(conversation.id)}
                className="flex w-full items-start gap-4 p-5 text-left transition hover:bg-[#FAFAFA] sm:items-center"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FCE5DC] text-xs font-bold text-[#EC5424]">
                  {getInitials(conversation)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">
                      {conversation.customer
                        ? `${conversation.customer.firstName} ${conversation.customer.lastName}`
                        : "Guest customer"}
                    </p>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        conversation.isResolved
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-[#FCE5DC] text-[#C7471D]"
                      }`}
                    >
                      {conversation.isResolved ? "Resolved" : "Open"}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-xs text-[#737373]">
                    {conversation.title || "New conversation"}
                  </p>

                  <p className="mt-2 line-clamp-1 text-xs text-[#929292]">
                    {conversation.messages[0]?.content ||
                      "No messages available"}
                  </p>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-xs text-[#929292]">
                    {formatDate(conversation.updatedAt)}
                  </p>
                  <p className="mt-2 text-xs text-[#737373]">
                    {conversation._count.messages} messages
                  </p>
                  <p className="mt-1 text-xs text-[#929292]">
                    {conversation._count.escalations} escalations
                  </p>
                </div>

                <span className="self-center text-lg text-[#B5B5B5]">›</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[#EAEAEA] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#929292]">
            Showing {filteredConversations.length} of {total} conversations
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

      {selectedId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] p-5 sm:p-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#EC5424]">
                  Conversation details
                </p>
                <h3 className="mt-1 truncate font-bold">
                  {details?.title || "Conversation history"}
                </h3>
              </div>

              <button
                onClick={() => {
                  setSelectedId(null);
                  setDetails(null);
                }}
                aria-label="Close conversation"
                className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-lg hover:bg-[#EAEAEA]"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto bg-[#F8F8F8] p-4 sm:p-6">
              {detailsLoading ? (
                <div className="py-16 text-center text-sm text-[#929292]">
                  Loading conversation history...
                </div>
              ) : detailsError ? (
                <div className="rounded-xl bg-red-50 p-5 text-sm text-red-700">
                  {detailsError}
                </div>
              ) : details ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#929292]">Customer</p>
                        <p className="mt-1 text-sm font-semibold">
                          {details.customer
                            ? `${details.customer.firstName} ${details.customer.lastName}`
                            : "Guest customer"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#929292]">Channel</p>
                        <p className="mt-1 text-sm font-semibold">
                          {details.channel}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#929292]">Messages</p>
                        <p className="mt-1 text-sm font-semibold">
                          {details.messages.length}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {details.messages.map((message, index) => {
                      const isUser = message.role === "USER";

                      return (
                        <div
                          key={message.id ?? `${message.createdAt}-${index}`}
                          className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[90%] rounded-2xl p-4 sm:max-w-[80%] ${
                              isUser
                                ? "rounded-br-md bg-[#EC5424] text-white"
                                : "rounded-bl-md border border-[#EAEAEA] bg-white text-[#141A1C]"
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-5">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider ${
                                  isUser ? "text-white/70" : "text-[#EC5424]"
                                }`}
                              >
                                {isUser ? "Customer" : message.role}
                              </span>
                              <span
                                className={`text-[10px] ${
                                  isUser ? "text-white/60" : "text-[#929292]"
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
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#EAEAEA] p-4">
              <p className="text-[11px] text-[#929292]">
                Read-only conversation history
              </p>
              <button
                onClick={() => {
                  setSelectedId(null);
                  setDetails(null);
                }}
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