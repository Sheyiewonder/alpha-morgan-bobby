"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  source: string | null;
  version: number;
  updatedAt: string;
}

interface KnowledgeResponse {
  success: boolean;
  count: number;
  documents: KnowledgeDocument[];
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

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDocument, setSelectedDocument] =
    useState<KnowledgeDocument | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/knowledge`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to retrieve knowledge documents.");
      }

      const data: KnowledgeResponse = await response.json();
      setDocuments(data.documents ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading documents."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const categories = useMemo(
    () => ["All", ...new Set(documents.map((doc) => doc.category))],
    [documents]
  );

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((doc) => {
      const matchesCategory =
        selectedCategory === "All" || doc.category === selectedCategory;

      const matchesSearch =
        !query ||
        doc.title.toLowerCase().includes(query) ||
        doc.category.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query) ||
        (doc.source ?? "").toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [documents, search, selectedCategory]);

  return (
    <div className="space-y-7 animate-fade-up">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#EC5424]">
            Bobby intelligence
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Knowledge Base
          </h2>
          <p className="mt-2 text-sm text-[#737373]">
            Manage the banking information Bobby uses to answer questions.
          </p>
        </div>

        <button
          onClick={() => void loadDocuments()}
          disabled={loading}
          className="flex items-center justify-center gap-2 self-start rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F8F8F8] disabled:opacity-50 sm:self-auto"
        >
          <span aria-hidden="true">↻</span>
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Approved documents</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : documents.length}
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Available to Bobby for responses
          </p>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Categories</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : categories.length - 1}
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Knowledge classifications
          </p>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <p className="text-xs text-[#929292]">Search results</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {loading ? "—" : filteredDocuments.length}
          </p>
          <p className="mt-1 text-xs text-[#929292]">
            Matching documents
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
        <div className="space-y-4 border-b border-[#EAEAEA] p-5">
          <div>
            <h3 className="font-bold">Banking knowledge documents</h3>
            <p className="mt-1 text-xs text-[#929292]">
              Browse and inspect the approved information available to Bobby.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search titles, content or sources..."
              className="min-w-0 flex-1 rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 text-sm outline-none transition focus:border-[#EC5424]"
            />

            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-3 text-sm outline-none focus:border-[#EC5424]"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === "All" ? "All categories" : category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              onClick={() => void loadDocuments()}
              className="ml-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4 p-6">
            {[1, 2, 3].map((item) => (
              <div key={item} className="animate-pulse space-y-3">
                <div className="h-4 w-1/3 rounded bg-[#F0F0F0]" />
                <div className="h-3 w-2/3 rounded bg-[#F0F0F0]" />
              </div>
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FCE5DC] text-2xl">
              📚
            </div>
            <h4 className="mt-4 font-semibold">No documents found</h4>
            <p className="mt-2 text-sm text-[#929292]">
              Try another search term or category.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0F0F0]">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col gap-4 p-5 transition hover:bg-[#FAFAFA] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FCE5DC] text-xl">
                    📄
                  </div>

                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold">
                      {doc.title}
                    </h4>
                    <p className="mt-1 text-xs text-[#737373]">
                      {doc.category}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#929292]">
                      {doc.content}
                    </p>
                    <p className="mt-2 text-[11px] text-[#929292]">
                      Updated {formatDate(doc.updatedAt)} · Version {doc.version}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDocument(doc)}
                  className="shrink-0 self-start rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-xs font-semibold transition hover:border-[#EC5424] hover:text-[#EC5424] sm:self-center"
                >
                  View document →
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-[#EAEAEA] px-5 py-4">
          <p className="text-xs text-[#929292]">
            Showing {filteredDocuments.length} of {documents.length} approved documents
          </p>
        </div>
      </div>

      {selectedDocument && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] p-5 sm:p-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#EC5424]">
                  Knowledge document
                </p>
                <h3 className="mt-1 truncate font-bold">
                  {selectedDocument.title}
                </h3>
              </div>

              <button
                onClick={() => setSelectedDocument(null)}
                aria-label="Close document"
                className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-lg hover:bg-[#EAEAEA]"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-7">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#FCE5DC] px-3 py-1.5 text-xs font-semibold text-[#C7471D]">
                  {selectedDocument.category}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  Approved
                </span>
                <span className="rounded-full bg-[#F5F5F5] px-3 py-1.5 text-xs text-[#737373]">
                  Version {selectedDocument.version}
                </span>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#929292]">
                  Document content
                </p>
                <div className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] p-5">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[#303638]">
                    {selectedDocument.content}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[#929292]">Source</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedDocument.source || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#929292]">Last updated</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatDate(selectedDocument.updatedAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#EAEAEA] p-4">
              <p className="text-[11px] text-[#929292]">
                Read-only document preview
              </p>
              <button
                onClick={() => setSelectedDocument(null)}
                className="rounded-xl bg-[#141A1C] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#303638]"
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
