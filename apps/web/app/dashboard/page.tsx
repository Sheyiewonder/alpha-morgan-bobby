
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import {
  Hand,
  House,
  ArrowLeftRight,
  Headset,
  UserRound,
  ArrowUpRight,
  Smartphone,
  ReceiptText,
  CircleDollarSign,
  Check,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
  AlertCircle,
  RefreshCw,
  X,
  Share2,
  ArrowRight,
  FileCheck2,
  Send,
  type LucideIcon,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type TransactionComplaint = {
  reference: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  conversationId: string | null;
  createdAt: string;
};

type Transaction = {
  id?: string;
  reference: string;
  description: string;
  amount: string;
  currency: string;
  status: string;
  type: string;
  counterparty: string | null;
  transactionDate: string;
  complaint?: TransactionComplaint | null;
};

type CustomerData = {
  simulationOnly: boolean;
  notice: string;
  customer: {
    customerRef: string;
    firstName: string;
    lastName: string;
    fullName: string;
    segment: string;
  };
  balance: {
    amount: string;
    currency: string;
    label: string;
  };
  transactions: Transaction[];
};

type ComplaintCategory =
  | "FAILED_TRANSACTION"
  | "INCORRECT_TRANSACTION"
  | "WRONG_RECIPIENT"
  | "OTHER";

type ComplaintRecord = {
  reference: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  conversationId: string | null;
  createdAt: string;
};

type ComplaintResult = {
  success: boolean;
  simulationOnly: boolean;
  message: string;
  complaint: ComplaintRecord;
  existingComplaint?: ComplaintRecord;
};

type ConversationHistoryItem = {
  id: string;
  title: string;
  updatedAt: string;
};

const categories: { value: ComplaintCategory; label: string }[] = [
  { value: "FAILED_TRANSACTION", label: "Failed transaction" },
  { value: "INCORRECT_TRANSACTION", label: "Incorrect transaction" },
  { value: "WRONG_RECIPIENT", label: "Transfer to wrong recipient" },
  { value: "OTHER", label: "Other banking issue" },
];

const navigation: {
  label: string;
  icon: LucideIcon;
  href: string;
}[] = [
  { label: "Home", icon: House, href: "#top" },
  { label: "Transactions", icon: ArrowLeftRight, href: "#transactions" },
  { label: "Support", icon: Headset, href: "#support"},
  { label: "Profile", icon: UserRound, href: "#profile" },
];

function formatMoney(amount: string, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount));
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

function statusStyle(status: string) {
  switch (status) {
    case "SUCCESSFUL":
    case "RESOLVED":
    case "CLOSED":
      return "bg-emerald-50 text-emerald-700";
    case "PENDING":
    case "OPEN":
    case "ACKNOWLEDGED":
      return "bg-amber-50 text-amber-700";
    case "FAILED":
      return "bg-red-50 text-red-700";
    case "REVERSED":
      return "bg-blue-50 text-blue-700";
    case "IN_PROGRESS":
      return "bg-violet-50 text-violet-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function displayStatus(status: string) {
  return status.replaceAll("_", " ");
}

function getDefaultCategory(status: string): ComplaintCategory {
  return status === "FAILED" ? "FAILED_TRANSACTION" : "OTHER";
}

function transactionIcon(type: string): LucideIcon {
  switch (type) {
    case "TRANSFER":
      return ArrowUpRight;
    case "AIRTIME":
      return Smartphone;
    case "BILL_PAYMENT":
      return ReceiptText;
    default:
      return CircleDollarSign;
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [reportTransaction, setReportTransaction] =
    useState<Transaction | null>(null);

  const [category, setCategory] =
    useState<ComplaintCategory>("FAILED_TRANSACTION");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complaintError, setComplaintError] = useState("");
  const [complaintResult, setComplaintResult] =
    useState<ComplaintResult | null>(null);

  const [savedConversations, setSavedConversations] = useState<
    ConversationHistoryItem[]
  >([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  
  const [activeTab, setActiveTab] = useState("Home");
  const [shareMessage, setShareMessage] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);

  // A silent refresh updates the data without replacing the dashboard
  // with a loading screen or closing an open modal.
  const loadCustomer = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      try {
        if (!silent) {
          setLoading(true);
          setLoadError("");
        }

        const response = await fetch(`${API_URL}/api/demo/customer`, {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message || "Unable to load demo customer.",
          );
        }

        setData(result);
        setLoadError("");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Something went wrong while loading the dashboard.";

        if (!silent) {
          setLoadError(message);
        } else {
          console.error("Dashboard refresh failed:", message);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

  const transactions = useMemo(
    () => data?.transactions ?? [],
    [data],
  );

  const reportedCount = useMemo(
    () => transactions.filter((item) => item.complaint).length,
    [transactions],
  );

  const successfulCount = useMemo(
    () => transactions.filter((item) => item.status === "SUCCESSFUL").length,
    [transactions],
  );

  function openReport(transaction: Transaction) {
    setReportTransaction(transaction);
    setSelectedTransaction(null);
    setComplaintResult(null);
    setComplaintError("");
    setDescription("");
    setCategory(getDefaultCategory(transaction.status));
  }

  async function handleComplaintSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!reportTransaction) return;

    setComplaintError("");

    if (description.trim().length < 10) {
      setComplaintError(
        "Please provide at least 10 characters describing the issue.",
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`${API_URL}/api/demo/complaints`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          description: description.trim(),
          transactionReference: reportTransaction.reference,
        }),
      });

      const result = await response.json();

      if (response.status === 409) {
        const existing = result.existingComplaint as
          | ComplaintRecord
          | undefined;

        if (existing) {
          setComplaintResult({
            success: true,
            simulationOnly: true,
            message:
              result.message ||
              "This transaction already has a report. You can continue the existing support conversation.",
            complaint: existing,
          });

          await loadCustomer({ silent: true });
          return;
        }
      }

      if (!response.ok) {
        throw new Error(result.message || "Unable to submit the report.");
      }

      setComplaintResult(result as ComplaintResult);

      // Refresh the transaction list without unmounting the modal.
      await loadCustomer({ silent: true });
    } catch (error) {
      setComplaintError(
        error instanceof Error
          ? error.message
          : "Something went wrong while submitting your report.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function shareReceipt(transaction: Transaction) {
    const receiptText = [
      "ALPHA MORGAN BANK — DEMO RECEIPT",
      "SIMULATION ONLY — NOT A REAL BANK TRANSACTION",
      "",
      `Description: ${transaction.description}`,
      `Reference: ${transaction.reference}`,
      `Amount: ${formatMoney(transaction.amount, transaction.currency)}`,
      `Status: ${displayStatus(transaction.status)}`,
      `Date: ${formatDate(transaction.transactionDate)}`,
      `Type: ${transaction.type}`,
      `Counterparty: ${transaction.counterparty || "Not specified"}`,
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Alpha Morgan Bank demo receipt",
          text: receiptText,
        });
      } else {
        await navigator.clipboard.writeText(receiptText);
        setShareMessage("Receipt details copied to clipboard.");
        window.setTimeout(() => setShareMessage(""), 3000);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(receiptText);
        setShareMessage("Receipt details copied to clipboard.");
      } catch {
        setShareMessage("Unable to share this receipt on this device.");
      }

      window.setTimeout(() => setShareMessage(""), 3000);
    }
  }

    const loadConversationHistory = useCallback(() => {
    setLoadingConversations(true);

    try {
      const stored = localStorage.getItem("bobby_conversation_history");

      if (!stored) {
        setSavedConversations([]);
        return;
      }

      const parsed = JSON.parse(stored);

      if (!Array.isArray(parsed)) {
        setSavedConversations([]);
        return;
      }

      const conversations = parsed
        .filter(
          (item): item is ConversationHistoryItem =>
            typeof item?.id === "string" &&
            typeof item?.title === "string" &&
            typeof item?.updatedAt === "string",
        )
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() -
            new Date(a.updatedAt).getTime(),
        )
        .slice(0, 30);

      setSavedConversations(conversations);
    } catch (error) {
      console.error("Unable to load Bobby conversation history:", error);
      setSavedConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }, []);
  function continueWithBobby(conversationId: string | null | undefined) {
    if (!conversationId) {
      setComplaintError(
        "The linked Bobby conversation is unavailable. Please contact the demo administrator.",
      );
      return;
    }

    window.location.href = `/?conversationId=${encodeURIComponent(conversationId)}`;
  }

  function closeReport() {
    if (submitting) return;

    setReportTransaction(null);
    setComplaintResult(null);
    setComplaintError("");
    setDescription("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F7F9] px-6">
        <div className="animate-fade-up text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-[#EC5424]" />
          </div>

          <p className="text-sm font-medium text-gray-500">
            Loading your demo dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (loadError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F7F9] px-6">
        <div className="w-full max-w-md animate-fade-up rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>

          <h1 className="text-xl font-bold text-[#141A1C]">
            Dashboard unavailable
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            {loadError || "We could not retrieve the demo customer data."}
          </p>

          <button
            type="button"
            onClick={() => void loadCustomer()}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#EC5424] px-5 py-3 text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#d9471b] hover:shadow-lg hover:shadow-[#EC5424]/20 active:translate-y-0"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      id="top"
      className="min-h-screen overflow-x-hidden bg-[#F6F7F9] pb-28 text-[#141A1C] selection:bg-[#EC5424]/15"
    >
      {/* Header */}
      <header
        id="profile"
        className="sticky top-0 z-30 border-b border-gray-100/80 bg-white/85 shadow-[0_2px_20px_rgba(20,26,28,0.03)] backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href=""
            aria-label="Alpha Morgan Bank home"
            className="group flex shrink-0 items-center"
          >
            <NextImage
              src="/images/AMB logo.PNG"
              alt="Alpha Morgan Bank"
              width={932}
              height={350}
              priority
              className="h-auto w-[180px] object-contain transition duration-300 group-hover:scale-[1.02] sm:w-[220px] lg:w-[240px]"
            />
          </Link>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                loadConversationHistory();
                setSupportOpen(true);
              }}
              aria-label="Open support centre"
              title="Support centre"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E9] text-[#EC5424] transition duration-200 hover:-translate-y-0.5 hover:bg-[#FCE1D6] hover:shadow-md hover:shadow-[#EC5424]/10 active:translate-y-0"
            >
              <Headset className="h-5 w-5" strokeWidth={2.2} />
            </button>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFF0E9] to-[#FCE1D6] text-sm font-extrabold text-[#EC5424] ring-1 ring-[#EC5424]/10">
              {data.customer.firstName.charAt(0)}
              {data.customer.lastName.charAt(0)}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl animate-fade-up px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        {/* Greeting */}
        <section className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
          <div>
            <p className="text-sm font-bold text-[#EC5424]">
              Customer overview
            </p>

            <h1 className="mt-1.5 flex flex-wrap items-center gap-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Hello, {data.customer.firstName}
              <Hand
                className="h-7 w-7 origin-bottom-left animate-wave text-[#E87932] motion-reduce:animate-none sm:h-8 sm:w-8"
                strokeWidth={2}
                aria-label="Waving hand"
              />
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Here&apos;s what&apos;s happening with your demo account.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-2.5 shadow-sm">
            <p className="text-[9px] font-bold tracking-widest text-gray-400">
              CUSTOMER REFERENCE
            </p>
            <p className="mt-1 font-mono text-xs font-bold">
              {data.customer.customerRef}
            </p>
          </div>
        </section>

        {/* Balance and quick overview */}
        <section className="mb-8 grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          {/* Premium balance card */}
          <div className="group relative isolate min-h-[270px] overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-br from-[#F47742] via-[#E95727] to-[#A92F19] p-6 text-white shadow-[0_20px_55px_rgba(201,63,29,0.20)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_25px_65px_rgba(201,63,29,0.27)] sm:rounded-[32px] sm:p-8 lg:p-9">
            {/* Gradient lighting */}
            <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-orange-200/20 blur-3xl transition-transform duration-700 group-hover:scale-125" />
            <div className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-[#6B160B]/30 blur-3xl" />

            {/* Polka-dot pattern */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.13]"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1.5px)",
                backgroundSize: "19px 19px",
                maskImage:
                  "linear-gradient(115deg, transparent 10%, black 100%)",
              }}
            />

            {/* Decorative rings */}
            <div className="pointer-events-none absolute -right-10 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full border border-white/15 transition-transform duration-700 group-hover:scale-110 sm:h-72 sm:w-72" />
            <div className="pointer-events-none absolute -right-2 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full border border-white/10 sm:h-52 sm:w-52" />
            <div className="pointer-events-none absolute right-10 top-8 h-3 w-3 rounded-full bg-white/30 blur-[1px] animate-float" />

            <div className="relative z-10 flex min-h-[220px] flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white/80">
                    Available balance
                  </p>

                  <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[9px] font-bold tracking-[0.16em] text-white/95 shadow-sm backdrop-blur-md">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                    CURRENT
                  </span>
                </div>

                <p className="mt-5 break-words text-2xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                  {formatMoney(data.balance.amount, data.balance.currency)}
                </p>
              </div>

              <div className="mt-9 flex flex-wrap items-end justify-between gap-4 border-t border-white/20 pt-5">
                <div>
                  <p className="text-[10px] text-white/65">
                    Account holder
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {data.customer.fullName}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-[10px] text-white/65">
                    Account segment
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {data.customer.segment}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Overview cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-lg hover:shadow-gray-200/60 sm:p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 text-[#EC5424]">
                <ArrowLeftRight className="h-5 w-5" />
              </div>
              <p className="mt-5 text-2xl font-extrabold sm:text-3xl">
                {transactions.length}
              </p>
              <p className="mt-1 text-xs text-gray-500">Transactions</p>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-100 hover:shadow-lg hover:shadow-gray-200/60 sm:p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="mt-5 text-2xl font-extrabold sm:text-3xl">
                {successfulCount}
              </p>
              <p className="mt-1 text-xs text-gray-500">Successful</p>
            </div>

            <div className="col-span-2 rounded-3xl border border-gray-100 bg-gradient-to-br from-white to-[#FFF9F6] p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/60 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFF0E9] to-[#FCE1D6] text-[#EC5424]">
                  <MessageCircle className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">Need help?</p>
                  <p className="mt-0.5 text-xs leading-5 text-gray-500">
                    Bobby is available for questions and support.
                  </p>
                </div>

                <Link
                  href="/?newChat=1"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#EC5424] px-3 py-2.5 text-xs font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[#d9471b] hover:shadow-md active:translate-y-0"
                >
                  Chat now
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Transactions */}
        <section id="transactions" className="scroll-mt-24">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#EC5424]">
                Account activity
              </p>

              <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
                Recent transactions
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Select a transaction to view its receipt or report an issue.
              </p>
            </div>

            <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-gray-500 shadow-sm ring-1 ring-gray-100">
              {transactions.length} records
            </span>
          </div>

          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500">
                No demo transactions are available.
              </div>
            ) : (
              transactions.map((transaction) => {
                const alreadyReported = Boolean(transaction.complaint);
                const TransactionIcon = transactionIcon(transaction.type);

                return (
                  <article
                    key={transaction.reference}
                    className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-200/50 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition duration-300 hover:scale-105 ${
                            transaction.status === "FAILED"
                              ? "bg-red-50 text-red-600"
                              : transaction.status === "SUCCESSFUL"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-orange-50 text-[#EC5424]"
                          }`}
                        >
                          <TransactionIcon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {transaction.description}
                          </p>

                          <p className="mt-1 truncate font-mono text-[10px] text-gray-400">
                            {transaction.reference}
                          </p>

                          <p className="mt-1 text-[11px] text-gray-400">
                            {formatDate(transaction.transactionDate)}
                            {transaction.counterparty
                              ? ` · ${transaction.counterparty}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-start lg:min-w-[180px] lg:flex-col lg:items-end lg:gap-1">
                        <p className="text-base font-extrabold">
                          {formatMoney(
                            transaction.amount,
                            transaction.currency,
                          )}
                        </p>

                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-extrabold tracking-wide ${statusStyle(transaction.status)}`}
                        >
                          {displayStatus(transaction.status)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:ml-3 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedTransaction(transaction)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-700 transition duration-200 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC5424]/30 sm:flex-none"
                        >
                          <ReceiptText className="h-3.5 w-3.5" />
                          View Receipt
                        </button>

                        {alreadyReported ? (
                          <button
                            type="button"
                            onClick={() => setSelectedTransaction(transaction)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700 transition duration-200 hover:bg-emerald-100 active:scale-[0.98] sm:flex-none"
                          >
                            <FileCheck2 className="h-3.5 w-3.5" />
                            Reported · View ticket
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openReport(transaction)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#EC5424] px-3 py-2.5 text-xs font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#d9471b] hover:shadow-md hover:shadow-[#EC5424]/15 active:translate-y-0 sm:flex-none"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Report Transaction
                          </button>
                        )}
                      </div>
                    </div>

                    {transaction.complaint && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                            Support report submitted
                          </p>
                          <p className="mt-1 font-mono text-xs font-bold text-emerald-900">
                            {transaction.complaint.reference}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${statusStyle(transaction.complaint.status)}`}
                        >
                          {displayStatus(transaction.complaint.status)}
                        </span>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* Support summary */}
        {/* <section id="support" className="mt-8 scroll-mt-24">
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#EC5424]">
                  Support centre
                </p>

                <h2 className="mt-2 text-xl font-extrabold">
                  Your reported transactions
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Keep track of issues you&apos;ve submitted.
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFF0E9] px-5 py-3 text-center">
                <p className="text-2xl font-extrabold text-[#EC5424]">
                  {reportedCount}
                </p>
                <p className="text-[10px] font-bold text-[#A84A2C]">
                  REPORTS
                </p>
              </div>
            </div>

            {reportedCount === 0 ? (
              <div className="mt-6 rounded-2xl bg-gray-50 px-5 py-8 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm">
                  <FileCheck2 className="h-5 w-5" />
                </div>

                <p className="text-sm font-semibold text-gray-700">
                  No transaction reports yet
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Use the Report Transaction button on a transaction to get
                  started.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {transactions
                  .filter((item) => item.complaint)
                  .map((transaction) => (
                    <div
                      key={transaction.reference}
                      className="flex flex-col justify-between gap-3 rounded-2xl border border-gray-100 p-4 transition duration-200 hover:border-gray-200 hover:bg-gray-50/50 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold">
                          {transaction.complaint!.subject}
                        </p>

                        <p className="mt-1 font-mono text-[10px] text-gray-400">
                          {transaction.complaint!.reference}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {transaction.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${statusStyle(transaction.complaint!.status)}`}
                        >
                          {displayStatus(transaction.complaint!.status)}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedTransaction(transaction)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]"
                        >
                          <ReceiptText className="h-3.5 w-3.5" />
                          View details
                        </button>

                        {transaction.complaint!.conversationId && (
                          <button
                            type="button"
                            onClick={() =>
                              continueWithBobby(
                                transaction.complaint!.conversationId,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#EC5424] px-3 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#d9471b] active:translate-y-0"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Continue with Bobby
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs leading-5 text-amber-800">
                For reports referred for specialist support, the expected
                response target is within 48 hours. This is a response target,
                not a guarantee of resolution. This demonstration does not
                contact a real bank or initiate an investigation.
              </p>
            </div>
          </div>
        </section> */}

        <footer className="mt-10 border-t border-gray-200 py-7 text-center">
          <p className="text-xs text-gray-400">
            Alpha Morgan Bank
          </p>
          {/* <p className="mt-1 text-[10px] text-gray-400">
            All information displayed is fictional and for demonstration only.
          </p> */}
        </footer>
      </div>

      {/* Fixed bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200/80 bg-white/90 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 shadow-[0_-8px_30px_rgba(20,26,28,0.04)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {navigation.map((item) => {
            const NavigationIcon = item.icon;

            if (item.label === "Support") {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    loadConversationHistory();
                    setSupportOpen(true);
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold text-gray-400 transition duration-200 hover:text-gray-700"
                >
                  <NavigationIcon className="h-5 w-5" strokeWidth={1.8} />
                  {item.label}
                </button>
              );
            }

            return (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setActiveTab(item.label)}
                aria-current={activeTab === item.label ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold transition duration-200 ${
                  activeTab === item.label
                    ? "scale-105 text-[#EC5424]"
                    : "text-gray-400 hover:text-gray-700"
                }`}
              >
                <NavigationIcon
                  className="h-5 w-5"
                  strokeWidth={activeTab === item.label ? 2.5 : 1.8}
                />
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>

      {/* Transaction receipt modal */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex animate-fade-up items-end justify-center bg-[#141A1C]/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTransaction(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title"
            className="max-h-[92dvh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px] sm:p-8"
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold tracking-[0.16em] text-[#EC5424]">
                  ALPHA MORGAN BANK
                </p>

                <h2
                  id="receipt-title"
                  className="mt-1 text-2xl font-extrabold"
                >
                  Transaction receipt
                </h2>

                <p className="mt-1 text-xs text-gray-400">
                  Demo transaction record
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                aria-label="Close receipt"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:rotate-90 hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-7 rounded-2xl bg-[#F7F8FA] p-5 text-center">
              <p className="text-xs text-gray-500">Transaction amount</p>

              <p className="mt-2 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">
                {formatMoney(
                  selectedTransaction.amount,
                  selectedTransaction.currency,
                )}
              </p>

              <span
                className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-[10px] font-extrabold ${statusStyle(selectedTransaction.status)}`}
              >
                {displayStatus(selectedTransaction.status)}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {[
                ["Description", selectedTransaction.description],
                ["Transaction reference", selectedTransaction.reference],
                [
                  "Transaction date",
                  formatDate(selectedTransaction.transactionDate),
                ],
                ["Transaction type", selectedTransaction.type],
                [
                  "Counterparty",
                  selectedTransaction.counterparty || "Not specified",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 border-b border-dashed border-gray-200 pb-3"
                >
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="max-w-[65%] break-words text-right text-xs font-bold">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {selectedTransaction.complaint && (
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-[10px] font-bold uppercase tracking-wider">
                    Transaction already reported
                  </p>
                </div>

                <p className="mt-2 break-all font-mono text-sm font-extrabold text-emerald-900">
                  {selectedTransaction.complaint.reference}
                </p>

                <p className="mt-1 text-xs text-emerald-800">
                  Status: {displayStatus(selectedTransaction.complaint.status)}
                </p>

                {selectedTransaction.complaint.conversationId && (
                  <button
                    type="button"
                    onClick={() =>
                      continueWithBobby(
                        selectedTransaction.complaint!.conversationId,
                      )
                    }
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#EC5424] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#d9471b]"
                  >
                    Continue with Bobby
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void shareReceipt(selectedTransaction)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-xs font-bold text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]"
              >
                <Share2 className="h-4 w-4" />
                Share Receipt
              </button>

              {selectedTransaction.complaint ? (
                <button
                  type="button"
                  onClick={() => setSelectedTransaction(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <Check className="h-4 w-4" />
                  Already reported
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openReport(selectedTransaction)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EC5424] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#d9471b] active:scale-[0.98]"
                >
                  <Send className="h-4 w-4" />
                  Report Transaction
                </button>
              )}
            </div>

            {/* <p className="mt-5 text-center text-[10px] leading-5 text-gray-400">
              This is a simulated transaction receipt. It is not proof of a
              real banking transaction.
            </p> */}
          </section>
        </div>
      )}

      {/* Report transaction modal */}
      {reportTransaction && (
        <div
          className="fixed inset-0 z-[60] flex animate-fade-up items-end justify-center bg-[#141A1C]/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              closeReport();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            className="max-h-[92dvh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px] sm:p-8"
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />

            {complaintResult ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-7 w-7" />
                </div>

                <p className="mt-5 text-[10px] font-extrabold tracking-[0.15em] text-emerald-700">
                  REPORT RECORDED
                </p>

                <h2 className="mt-2 text-2xl font-extrabold">
                  Your report has been submitted
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {complaintResult.message}
                </p>

                <div className="mt-6 rounded-2xl bg-[#F7F8FA] p-5">
                  <p className="text-[10px] font-bold tracking-widest text-gray-400">
                    TICKET REFERENCE
                  </p>

                  <p className="mt-2 break-all font-mono text-sm font-extrabold text-[#EC5424]">
                    {complaintResult.complaint.reference}
                  </p>

                  <div className="mt-5 space-y-3 border-t border-gray-200 pt-4">
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="text-gray-500">Status</span>
                      <span className="font-bold">
                        {displayStatus(complaintResult.complaint.status)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3 text-xs">
                      <span className="text-gray-500">Priority</span>
                      <span className="font-bold">
                        {complaintResult.complaint.priority}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3 text-xs">
                      <span className="text-gray-500">Date submitted</span>
                      <span className="text-right font-semibold">
                        {formatDate(complaintResult.complaint.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs leading-5 text-amber-800">
                    If specialist support is required and your report is
                    referred, the expected response target is within 48 hours.
                    This is not a guarantee of resolution.
                  </p>
                </div>

                {complaintResult.complaint.conversationId ? (
                  <button
                    type="button"
                    onClick={() =>
                      continueWithBobby(
                        complaintResult.complaint.conversationId,
                      )
                    }
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#EC5424] px-5 py-4 text-sm font-extrabold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#d9471b] hover:shadow-lg hover:shadow-[#EC5424]/15 active:translate-y-0"
                  >
                    Continue with Bobby
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    The report was recorded, but its conversation link was not
                    returned. Refresh the dashboard and check the support
                    section before continuing.
                  </p>
                )}

                <button
                  type="button"
                  onClick={closeReport}
                  className="mt-3 w-full rounded-xl border border-gray-200 px-5 py-3 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
                >
                  Back to transactions
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-extrabold tracking-[0.15em] text-[#EC5424]">
                      CUSTOMER SUPPORT
                    </p>

                    <h2
                      id="report-title"
                      className="mt-1 text-2xl font-extrabold"
                    >
                      Report transaction
                    </h2>

                    <p className="mt-1 text-xs text-gray-500">
                      Tell us what went wrong with this demo transaction.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeReport}
                    disabled={submitting}
                    aria-label="Close report form"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 rounded-2xl bg-[#F7F8FA] p-4">
                  <p className="text-sm font-bold">
                    {reportTransaction.description}
                  </p>

                  <p className="mt-1 font-mono text-[10px] text-gray-400">
                    {reportTransaction.reference}
                  </p>

                  <p className="mt-2 text-sm font-extrabold">
                    {formatMoney(
                      reportTransaction.amount,
                      reportTransaction.currency,
                    )}
                  </p>
                </div>

                <form
                  onSubmit={handleComplaintSubmit}
                  className="mt-5 space-y-5"
                >
                  <div>
                    <label
                      htmlFor="report-category"
                      className="mb-2 block text-xs font-bold"
                    >
                      What issue are you reporting?
                    </label>

                    <select
                      id="report-category"
                      value={category}
                      onChange={(event) =>
                        setCategory(event.target.value as ComplaintCategory)
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#EC5424] focus:ring-2 focus:ring-[#EC5424]/10"
                    >
                      {categories.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="report-description"
                      className="mb-2 block text-xs font-bold"
                    >
                      Describe the issue
                    </label>

                    <textarea
                      id="report-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={5}
                      maxLength={2000}
                      required
                      minLength={10}
                      placeholder="Describe what happened in this demo scenario..."
                      className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-gray-400 focus:border-[#EC5424] focus:ring-2 focus:ring-[#EC5424]/10"
                    />

                    <p className="mt-1 text-right text-[10px] text-gray-400">
                      {description.length}/2000
                    </p>
                  </div>

                  {complaintError && (
                    <p
                      role="alert"
                      className="rounded-xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700"
                    >
                      {complaintError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#EC5424] px-5 py-4 text-sm font-extrabold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#d9471b] hover:shadow-lg hover:shadow-[#EC5424]/15 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Submitting report...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit Report
                      </>
                    )}
                  </button>

                  <p className="text-center text-[10px] leading-5 text-gray-400">
                    Demo only. Never enter real account numbers, passwords,
                    PINs, OTPs or card information.
                  </p>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      {/* Share feedback */}
      {shareMessage && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[70] flex -translate-x-1/2 animate-fade-up items-center gap-2 rounded-xl bg-[#141A1C] px-5 py-3 text-center text-xs font-semibold text-white shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {shareMessage}
        </div>
      )}

      {/* Support Centre modal */}
        
{supportOpen && (
  <div
    className="fixed inset-0 z-[55] flex animate-fade-up items-end justify-center bg-[#141A1C]/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        setSupportOpen(false);
      }
    }}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-title"
      className="max-h-[90dvh] w-full max-w-2xl animate-fade-up overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px] sm:p-8"
    >
      <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFF0E9] to-[#FCE1D6] text-[#EC5424]">
            <Headset className="h-5 w-5" />
          </div>

          <p className="text-xs font-bold uppercase tracking-widest text-[#EC5424]">
            Support centre
          </p>

          <h2 id="support-title" className="mt-2 text-2xl font-extrabold">
            Your support history
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Access your transaction reports and previous conversations with Bobby.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSupportOpen(false)}
          aria-label="Close support centre"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:rotate-90 hover:bg-gray-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Submitted reports dropdown */}
      <details className="group mt-6 overflow-hidden rounded-2xl border border-[#FCE1D6] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-[#FFF9F6] p-4 transition hover:bg-[#FFF4EE] [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E9] text-[#EC5424]">
              <FileCheck2 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm font-extrabold text-gray-900">
                Submitted reports
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Your transaction support history
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-[#FFF0E9] px-2 text-sm font-extrabold text-[#EC5424]">
              {reportedCount}
            </span>

            <ChevronDown className="h-5 w-5 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
          </div>
        </summary>

        <div className="border-t border-gray-100 p-4">
          {reportedCount === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm">
                <FileCheck2 className="h-5 w-5" />
              </div>

              <p className="text-sm font-semibold text-gray-700">
                No transaction reports yet
              </p>

              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-gray-500">
                Use the Report Transaction button on a transaction to submit an
                issue. Your reports will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions
                .filter((item) => item.complaint)
                .map((transaction) => (
                  <div
                    key={transaction.reference}
                    className="rounded-2xl border border-gray-100 p-4 transition duration-200 hover:border-gray-200 hover:bg-gray-50/50"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">
                          {transaction.complaint!.subject}
                        </p>

                        <p className="mt-1 font-mono text-[10px] text-gray-400">
                          {transaction.complaint!.reference}
                        </p>

                        <p className="mt-2 text-xs text-gray-500">
                          {transaction.description}
                        </p>

                        <p className="mt-1 text-[10px] text-gray-400">
                          Submitted{" "}
                          {formatDate(transaction.complaint!.createdAt)}
                        </p>
                      </div>

                      <span
                        className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold ${statusStyle(transaction.complaint!.status)}`}
                      >
                        {displayStatus(transaction.complaint!.status)}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSupportOpen(false);
                          setSelectedTransaction(transaction);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
                      >
                        <ReceiptText className="h-3.5 w-3.5" />
                        View details
                      </button>

                      {transaction.complaint!.conversationId && (
                        <button
                          type="button"
                          onClick={() =>
                            continueWithBobby(
                              transaction.complaint!.conversationId,
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#EC5424] px-3 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#d9471b] active:translate-y-0"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Continue conversation
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </details>

      {/* Bobby conversations dropdown */}
      <details className="group mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-gray-50 p-4 transition hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E9] text-[#EC5424]">
              <MessageCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm font-extrabold text-gray-900">
                Bobby conversations
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Your previous chats with our virtual assistant
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-[#FFF0E9] px-2 text-sm font-extrabold text-[#EC5424]">
              {savedConversations.length}
            </span>

            <ChevronDown className="h-5 w-5 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
          </div>
        </summary>

        <div className="border-t border-gray-100 p-4">
          {loadingConversations ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-5 py-8 text-xs text-gray-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading conversations...
            </div>
          ) : savedConversations.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-5 py-8 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm">
                <MessageCircle className="h-5 w-5" />
              </div>

              <p className="text-sm font-semibold text-gray-700">
                No Bobby conversations yet
              </p>

              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-gray-500">
                Conversations you start using Chat now will appear here so you can
                return to them later.
              </p>

              <Link
                href="/?newChat=1"
                onClick={() => setSupportOpen(false)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#EC5424] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#d9471b]"
              >
                Start a conversation
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {savedConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="rounded-2xl border border-gray-100 p-4 transition duration-200 hover:border-gray-200 hover:bg-gray-50/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E9] text-[#EC5424]">
                      <MessageCircle className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold text-gray-800">
                        {conversation.title || "Bobby conversation"}
                      </p>

                      <p className="mt-1 text-[10px] text-gray-400">
                        Last activity: {formatDate(conversation.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={() => continueWithBobby(conversation.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#EC5424] px-3 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#d9471b] active:translate-y-0"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Continue conversation
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      {/* Response target notice */}
      <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4">
        <p className="text-xs leading-5 text-amber-800">
          For reports referred for specialist support, the expected response
          target is within 48 hours. This is a response target, not a
          guarantee of resolution. This demonstration does not contact a
          real bank or initiate an investigation.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setSupportOpen(false)}
        className="mt-5 w-full rounded-xl border border-gray-200 px-5 py-3 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
      >
        Close support centre
      </button>
    </section>
  </div>
)}

    </main>
  );
}
