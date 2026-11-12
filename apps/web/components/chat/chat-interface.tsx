"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt?: string;
};

type Source = {
  id: string;
  title: string;
  category?: string;
  similarity?: number;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
    throw new Error(data.message || data.error || "Something went wrong.");
  }

  return data as T;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

    return id;
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
  try {
    // A conversation ID in the URL takes priority over the saved chat.
    // This lets the dashboard open the exact conversation linked to a ticket.
    const requestedId = new URLSearchParams(
      window.location.search,
    ).get("conversationId");

    const savedId = localStorage.getItem("bobby_conversation_id");
    const conversationToLoad = requestedId || savedId;

    if (conversationToLoad) {
      try {
        const data = await apiRequest<{
          conversation: {
            id: string;
            messages: Message[];
          };
        }>(`/api/conversations/${conversationToLoad}`);

        if (!active) return;

        setConversationId(data.conversation.id);
        setMessages(data.conversation.messages || []);
        localStorage.setItem(
          "bobby_conversation_id",
          data.conversation.id,
        );
      } catch (err) {
        // Do not silently create a different conversation when a ticket
        // supplied an ID that cannot be loaded.
        if (requestedId) {
          throw new Error(
            "We couldn't open the conversation linked to this ticket. Please return to your dashboard and try again.",
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
          : "Unable to connect to Bobby.",
      );
    }
  } finally {
    if (active) setInitializing(false);
  }
    }
    initialize();

    return () => {
      active = false;
    };
  }, [createConversation]);

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
        assistantMessage: Message;
        sources: Source[];
      }>(`/api/conversations/${activeConversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });

      setMessages((previous) => [
        ...previous,
        data.userMessage,
        data.assistantMessage,
      ]);

      setSources(data.sources || []);
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

  // Remove the ticket conversation ID from the URL.
  window.history.replaceState({}, "", window.location.pathname);

  setConversationId(null);
  setMessages([]);
  setSources([]);
  setError("");
  setInitializing(true);

  createConversation()
    .catch((err) => {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start a conversation.",
      );
    })
    .finally(() => setInitializing(false));
}

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border bg-white p-5 md:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white">
            B
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Bobby</h1>
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
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-sm font-semibold">Bobby is available</span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Ask questions about banking services, account information and
              general support.
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
              <h2 className="font-bold tracking-tight">Bobby</h2>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-success" />
                AI Banking Assistant
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
            <span className="h-2 w-2 rounded-full bg-success" />
            Online
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
                    I&apos;m Bobby, your AI banking assistant. Ask me a
                    question and I&apos;ll do my best to help you find the
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

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
                          B
                        </div>
                      )}

                      <div
                        className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 md:max-w-[75%] ${                          isUser
                            ? "rounded-br-md bg-secondary text-white"
                            : "rounded-bl-md border border-border bg-white text-foreground shadow-sm"
                        }`}
                      >
                        <div className="min-w-0 whitespace-normal break-words">
                        <ReactMarkdown
                            components={{
                            p: ({ children }) => (
                                <p className="mb-3 last:mb-0 whitespace-pre-wrap leading-7">
                                {children}
                                </p>
                            ),
                            h1: ({ children }) => (
                                <h1 className="mb-3 text-xl font-bold">{children}</h1>
                            ),
                            h2: ({ children }) => (
                                <h2 className="mb-3 text-lg font-bold">{children}</h2>
                            ),
                            h3: ({ children }) => (
                                <h3 className="mb-2 text-base font-bold">{children}</h3>
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
                                <li className="pl-1 leading-7">{children}</li>
                            ),
                            strong: ({ children }) => (
                                <strong className="font-bold">{children}</strong>
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
                        </div>                      </div>
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
                          <p className="font-semibold">{source.title}</p>
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
                If your issue requires specialist support, the expected response
                time after a successful referral is within 48 hours. This is a
                response target, not a guarantee of resolution.
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
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={loading || initializing}
                placeholder="Ask Bobby anything about banking..."
                rows={1}
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={!input.trim() || loading || initializing}
                aria-label="Send message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-xl text-white transition hover:bg-[#d9471b] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↑
              </button>
            </form>

            <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
              Bobby is an AI assistant. Responses may not always be accurate.
              Do not enter passwords, PINs, account numbers or other sensitive
              banking information. This is a demonstration environment.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
