
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type MessageRole = "USER" | "ASSISTANT" | "AGENT";

type Message = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt?: string;
};

type Source = {
  id: string;
  title: string;
  category?: string;
  similarity?: number;
};

type EscalationStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED";

type Escalation = {
  id: string;
  status: EscalationStatus;
  assignedTo?: string | null;
  reason?: string;
  createdAt?: string;
};

type ConversationResponse = {
  conversation: {
    id: string;
    messages: Message[];
    escalations?: Escalation[];
  };
};

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

const CONVERSATION_HISTORY_KEY = "bobby_conversation_history";

type ConversationHistoryItem = {
  id: string;
  title: string;
  updatedAt: string;
};

function saveConversationToHistory(
  id: string,
  title = "Bobby conversation"
) {
  try {
    const existing: ConversationHistoryItem[] = JSON.parse(
      localStorage.getItem(CONVERSATION_HISTORY_KEY) || "[]"
    );

    const existingConversation = existing.find(
      (item) => item.id === id
    );

    const updated = [
      {
        id,
        title:
          title === "Bobby conversation" && existingConversation
            ? existingConversation.title
            : title,
        updatedAt: new Date().toISOString(),
      },
      ...existing.filter((item) => item.id !== id),
    ];

    localStorage.setItem(
      CONVERSATION_HISTORY_KEY,
      JSON.stringify(updated)
    );
  } catch {
    console.error("Unable to save conversation history.");
  }
}

const suggestions = [
  "What documents do I need to open a bank account?",
  "How can I reset my internet banking password?",
  "What services does Alpha Morgan Bank offer?",
  "How do I report a banking complaint?",
];

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Something went wrong."
    );
  }

  return data as T;
}

function mergeMessages(
  existing: Message[],
  incoming: Message[]
): Message[] {
  const messageMap = new Map<string, Message>();

  for (const message of existing) {
    messageMap.set(message.id, message);
  }

  for (const message of incoming) {
    messageMap.set(message.id, message);
  }

  return Array.from(messageMap.values()).sort((a, b) => {
    const timeA = a.createdAt
      ? new Date(a.createdAt).getTime()
      : 0;

    const timeB = b.createdAt
      ? new Date(b.createdAt).getTime()
      : 0;

    return timeA - timeB;
  });
}

function getActiveEscalation(
  escalations: Escalation[] = []
): Escalation | null {
  return (
    escalations
      .filter((escalation) =>
        ["PENDING", "ASSIGNED", "IN_PROGRESS"].includes(
          escalation.status
        )
      )
      .sort((a, b) => {
        const timeA = a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;

        const timeB = b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;

        return timeB - timeA;
      })[0] ?? null
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(
    null
  );
  const [activeEscalation, setActiveEscalation] =
    useState<Escalation | null>(null);

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const createConversation = useCallback(async () => {
    const data = await apiRequest<{
      success: boolean;
      conversation: { id: string };
    }>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        title: "New conversation",
        channel: "WEB",
      }),
    });

    const id = data.conversation.id;

    setConversationId(id);
    localStorage.setItem("bobby_conversation_id", id);

    saveConversationToHistory(id);

    return id;
  }, []);

  // Initialize or restore the existing conversation.
  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const searchParams = new URLSearchParams(
          window.location.search
        );

        const requestedId = searchParams.get("conversationId");

        const startNewChat = searchParams.get("newChat") === "1";

        const savedId = localStorage.getItem(
          "bobby_conversation_id"
        );

        // A new chat should not restore the previous conversation.
        if (startNewChat) {
          window.history.replaceState(
            {},
            "",
            window.location.pathname
          );

          localStorage.removeItem("bobby_conversation_id");
        }

        const conversationToLoad = startNewChat
          ? null
          : requestedId || savedId;

        if (conversationToLoad) {
          try {
            const data = await apiRequest<ConversationResponse>(
              `/api/conversations/${conversationToLoad}`
            );

            if (!active) return;

            setConversationId(data.conversation.id);
            setMessages(data.conversation.messages || []);

            setActiveEscalation(
              getActiveEscalation(data.conversation.escalations)
            );

            localStorage.setItem(
              "bobby_conversation_id",
              data.conversation.id
            );

            // Save the restored conversation to local history.
            const firstUserMessage =
              data.conversation.messages?.find(
                (message) => message.role === "USER"
              );

            saveConversationToHistory(
              data.conversation.id,
              firstUserMessage?.content?.slice(0, 60) ||
                "Bobby conversation"
            );
          } catch {
            if (requestedId) {
              throw new Error(
                "We couldn't open the conversation linked to this ticket. Please return to your dashboard and try again."
              );
            }

            localStorage.removeItem("bobby_conversation_id");

            if (active) {
              await createConversation();
            }
          }
        } else {
          await createConversation();
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to connect to Bobby."
          );
        }
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [createConversation]);

  // Automatically refresh messages and handoff status.
  useEffect(() => {
    if (!conversationId || initializing) return;

    let active = true;

    async function refreshConversation() {
      if (pollingRef.current) return;

      pollingRef.current = true;

      try {
        const data = await apiRequest<ConversationResponse>(
          `/api/conversations/${conversationId}`
        );

        if (!active) return;

        const conversation = data.conversation;

        setMessages((previous) =>
          mergeMessages(
            previous,
            conversation.messages || []
          )
        );

        setActiveEscalation(
          getActiveEscalation(conversation.escalations)
        );
      } catch {
        // A temporary polling failure should not interrupt the chat.
      } finally {
        pollingRef.current = false;
      }
    }

    const interval = window.setInterval(
      refreshConversation,
      3000
    );

    return () => {
      active = false;
      window.clearInterval(interval);
      pollingRef.current = false;
    };
  }, [conversationId, initializing]);

  async function sendMessage(messageText?: string) {
    const content = (messageText ?? input).trim();

    if (!content || loading || initializing) return;

    setInput("");
    setError("");
    setSources([]);
    setLoading(true);

    try {
      let activeConversationId = conversationId;

      if (!activeConversationId) {
        activeConversationId = await createConversation();
      }

      const data = await apiRequest<{
        success: boolean;
        userMessage: Message;
        assistantMessage: Message | null;
        sources?: Source[];
        handoffActive?: boolean;
        escalation?: Escalation;
      }>(
        `/api/conversations/${activeConversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content }),
        }
      );

      // Use the first customer message as the conversation title.
      const firstUserMessage =
        messages.find((message) => message.role === "USER");

      saveConversationToHistory(
        activeConversationId,
        firstUserMessage?.content?.slice(0, 60) ||
          content.slice(0, 60) ||
          "Bobby conversation"
      );

      const newMessages = [
        data.userMessage,
        ...(data.assistantMessage
          ? [data.assistantMessage]
          : []),
      ];

      setMessages((previous) =>
        mergeMessages(previous, newMessages)
      );

      setSources(data.sources || []);

      if (data.handoffActive) {
        setActiveEscalation(
          data.escalation || {
            id: "",
            status: "PENDING",
          }
        );
      }

      // Fetch the latest conversation state after sending.
      const latest = await apiRequest<ConversationResponse>(
        `/api/conversations/${activeConversationId}`
      );

      setMessages((previous) =>
        mergeMessages(
          previous,
          latest.conversation.messages || []
        )
      );

      setActiveEscalation(
        getActiveEscalation(latest.conversation.escalations)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send your message. Please try again."
      );

      setInput(content);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleNewConversation() {
    if (loading || initializing) return;

    localStorage.removeItem("bobby_conversation_id");

    window.history.replaceState(
      {},
      "",
      window.location.pathname
    );

    setConversationId(null);
    setMessages([]);
    setSources([]);
    setActiveEscalation(null);
    setError("");
    setInitializing(true);

    createConversation()
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to start a conversation."
        );
      })
      .finally(() => setInitializing(false));
  }

  const isHumanSupportActive = Boolean(activeEscalation);

  const chatStatus = isHumanSupportActive
    ? activeEscalation?.status === "PENDING"
      ? "Waiting for a representative"
      : "Customer Service is handling your conversation"
    : "AI Banking Assistant";

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border bg-white p-5 md:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white">
            B
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight">
              Bobby
            </h1>
            <p className="text-xs text-muted-foreground">
              Alpha Morgan Bank
            </p>
          </div>
        </div>

        <button
          onClick={handleNewConversation}
          disabled={loading || initializing}
          className="mt-10 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d9471b] disabled:opacity-50"
        >
          <span className="text-lg">+</span>
          New conversation
        </button>

        <div className="mt-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Your assistant
          </p>

          <div className="rounded-xl bg-muted-orange p-4">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isHumanSupportActive
                    ? "bg-amber-500"
                    : "bg-success"
                }`}
              />

              <span className="text-sm font-semibold">
                {isHumanSupportActive
                  ? "Human support requested"
                  : "Bobby is available"}
              </span>
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              {isHumanSupportActive
                ? "Your conversation has been referred to our customer service team. You can continue sending messages here."
                : "Ask questions about banking services, account information and general support."}
            </p>
          </div>
        </div>

        <div className="mt-auto border-t border-border pt-5">
          <p className="text-xs leading-5 text-muted-foreground">
            Alpha Morgan Bank
            <br />
            AI Customer Support
          </p>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Demonstration environment
          </p>
        </div>
      </aside>

      {/* Main chat area */}
      <section className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-border bg-white/90 px-5 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-white md:hidden">
              B
            </div>

            <div>
              <h2 className="font-bold tracking-tight">
                Bobby
              </h2>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isHumanSupportActive
                      ? "bg-amber-500"
                      : "bg-success"
                  }`}
                />
                {chatStatus}
              </p>
            </div>
          </div>

          <button
            onClick={handleNewConversation}
            disabled={loading || initializing}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-background-light disabled:opacity-50 md:hidden"
          >
            New chat
          </button>

          <div className="hidden items-center gap-2 rounded-full bg-background-light px-3 py-2 text-xs font-medium text-muted-foreground md:flex">
            <span
              className={`h-2 w-2 rounded-full ${
                isHumanSupportActive
                  ? "bg-amber-500"
                  : "bg-success"
              }`}
            />
            {isHumanSupportActive ? "Human support" : "Online"}
          </div>
        </header>

        {/* Messages */}
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-8 md:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
            {initializing ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Connecting to Bobby...
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center py-10">
                <div className="animate-fade-up">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted-orange text-3xl">
                    ✦
                  </div>

                  <p className="mb-3 text-sm font-semibold text-primary">
                    HELLO, WELCOME TO ALPHA MORGAN BANK
                  </p>

                  <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                    How can I help
                    <span className="text-primary"> you </span>
                    today?
                  </h1>

                  <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground md:text-base">
                    I'm Bobby, your AI banking assistant. Ask me a
                    question and I'll do my best to help you find the
                    information you need.
                  </p>

                  <div className="mt-10">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Try asking
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => sendMessage(suggestion)}
                          className="group rounded-2xl border border-border bg-white p-4 text-left text-sm leading-6 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted-orange/30"
                        >
                          <span className="flex items-center justify-between gap-3">
                            {suggestion}
                            <span className="text-primary transition group-hover:translate-x-1">
                              →
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-7 py-4">
                {messages.map((message) => {
                  const isUser = message.role === "USER";
                  const isAgent = message.role === "AGENT";

                  const senderName = isUser
                    ? "You"
                    : isAgent
                      ? "Customer Service"
                      : "Bobby";

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isUser && (
                        <div
                          className={`mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${
                            isAgent
                              ? "bg-emerald-700"
                              : "bg-primary"
                          }`}
                        >
                          {isAgent ? "CS" : "B"}
                        </div>
                      )}

                      <div
                        className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 md:max-w-[75%] ${
                          isUser
                            ? "rounded-br-md bg-secondary text-white"
                            : isAgent
                              ? "rounded-bl-md border border-emerald-200 bg-emerald-50 text-foreground shadow-sm"
                              : "rounded-bl-md border border-border bg-white text-foreground shadow-sm"
                        }`}
                      >
                        <p
                          className={`mb-1 text-[11px] font-semibold ${
                            isUser
                              ? "text-white/70"
                              : isAgent
                                ? "text-emerald-800"
                                : "text-muted-foreground"
                          }`}
                        >
                          {senderName}
                        </p>

                        <div className="min-w-0 whitespace-normal break-words">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => (
                                <p className="mb-3 last:mb-0 whitespace-pre-wrap leading-7">
                                  {children}
                                </p>
                              ),
                              h1: ({ children }) => (
                                <h1 className="mb-3 text-xl font-bold">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="mb-3 text-lg font-bold">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="mb-2 text-base font-bold">
                                  {children}
                                </h3>
                              ),
                              ul: ({ children }) => (
                                <ul className="mb-3 list-disc space-y-2 pl-6 last:mb-0">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="mb-3 list-decimal space-y-2 pl-6 last:mb-0">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="pl-1 leading-7">
                                  {children}
                                </li>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-bold">
                                  {children}
                                </strong>
                              ),
                              a: ({ children, href }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-primary underline underline-offset-4"
                                >
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
                      B
                    </div>

                    <div className="flex items-center gap-1 rounded-2xl border border-border bg-white px-5 py-4">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                    </div>
                  </div>
                )}

                {sources.length > 0 && !loading && (
                  <div className="ml-12 rounded-xl border border-border bg-white p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Information sources
                    </p>

                    <div className="space-y-2">
                      {sources.map((source) => (
                        <div key={source.id} className="text-xs">
                          <p className="font-semibold">
                            {source.title}
                          </p>

                          {source.category && (
                            <p className="mt-1 text-muted-foreground">
                              {source.category}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isHumanSupportActive && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <span className="text-sm font-bold">i</span>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      Your conversation has been referred to Customer Service
                    </p>

                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      {activeEscalation?.assignedTo
                        ? `A representative (${activeEscalation.assignedTo}) is handling your conversation.`
                        : "Your request is waiting for a customer service representative."}
                      {" "}You can continue sending messages in this chat.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-error/20 bg-red-50 p-4 text-sm text-error"
              >
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-border/60 bg-white px-4 py-2.5 md:px-8">
          <p className="mx-auto max-w-3xl text-center text-[11px] leading-5 text-muted-foreground">
            If your issue requires specialist support, the expected
            response time after a successful referral is within 48 hours.
            This is a response target, not a guarantee of resolution.
          </p>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-white px-4 py-5 md:px-8">
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
              className="flex items-end gap-3 rounded-2xl border border-border bg-background-light p-2 transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={loading || initializing}
                placeholder={
                  isHumanSupportActive
                    ? "Reply to Customer Service..."
                    : "Ask Bobby anything about banking..."
                }
                rows={1}
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={
                  !input.trim() || loading || initializing
                }
                aria-label="Send message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-xl text-white transition hover:bg-[#d9471b] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↑
              </button>
            </form>

            <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
              Bobby is an AI assistant. Responses may not always be
              accurate. Do not enter passwords, PINs, account numbers
              or other sensitive banking information. This is a
              demonstration environment.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
