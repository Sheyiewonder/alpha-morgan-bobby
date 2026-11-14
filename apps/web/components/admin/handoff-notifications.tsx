
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  X,
  Headset,
  Clock,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

interface HandoffNotification {
  id: string;
  status: string;
  source: string;
  reason: string;
  assignedTo: string | null;
  updatedAt: string;
  conversation: {
    id: string;
    title: string | null;
    customer: {
      firstName: string;
      lastName: string;
    } | null;
    messages: {
      id: string;
      role: string;
      content: string;
      createdAt: string;
    }[];
  };
}

interface NotificationResponse {
  success: boolean;
  counts: {
    unattended: number;
    newMessages: number;
  };
  notifications: HandoffNotification[];
}

export default function HandoffNotifications() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    unattended: 0,
    newMessages: 0,
  });
  const [notifications, setNotifications] = useState<
    HandoffNotification[]
  >([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/human-handoffs/notifications`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Could not fetch notifications.");
      }

      const data: NotificationResponse = await response.json();

      if (!data.success) {
        throw new Error("Invalid notification response.");
      }

      setCounts(data.counts);
      setNotifications(data.notifications);
    } catch (error) {
      console.error("[Handoff Notifications]", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();

    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  const totalNotifications =
    counts.unattended + counts.newMessages;

  return (
    <div className="fixed bottom-5 right-5 z-[60]">
      {open && (
        <div className="mb-4 w-[min(370px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-2xl shadow-black/15">
          <div className="flex items-center justify-between border-b border-[#EEEEEE] px-5 py-4">
            <div>
              <h3 className="font-bold text-[#141A1C]">
                Human Handoffs
              </h3>
              <p className="mt-0.5 text-xs text-[#888888]">
                Live support notifications
              </p>
            </div>

            <button
              onClick={() => void fetchNotifications()}
              aria-label="Refresh notifications"
              className="rounded-lg p-2 text-[#777777] transition hover:bg-[#F5F5F5] hover:text-[#141A1C]"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 border-b border-[#EEEEEE] p-4">
            <div className="rounded-xl bg-orange-50 p-3">
              <div className="flex items-center gap-2 text-[#C94B20]">
                <Headset size={16} />
                <span className="text-xs font-medium">
                  Unattended
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-[#141A1C]">
                {counts.unattended}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-3">
              <div className="flex items-center gap-2 text-blue-700">
                <MessageCircle size={16} />
                <span className="text-xs font-medium">
                  New messages
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-[#141A1C]">
                {counts.newMessages}
              </p>
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#888888]">
                Awaiting response
              </p>
              <span className="text-xs text-[#999999]">
                {notifications.length} shown
              </span>
            </div>

            {notifications.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <MessageCircle
                  size={27}
                  className="mx-auto text-[#C8C8C8]"
                />
                <p className="mt-3 text-sm font-semibold text-[#333333]">
                  All caught up
                </p>
                <p className="mt-1 text-xs text-[#999999]">
                  No customer messages are awaiting a reply.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F0]">
                {notifications.map((item) => {
                  const latestMessage =
                    item.conversation.messages[0];

                  const customer = item.conversation.customer;
                  const customerName = customer
                    ? `${customer.firstName} ${customer.lastName}`
                    : "Customer";

                  return (
                    <Link
                      key={item.id}
                      href="/admin/human-handoffs"
                      onClick={() => setOpen(false)}
                      className="block px-5 py-4 transition hover:bg-[#FAFAFA]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#202729]">
                            {customerName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[#929292]">
                            {item.conversation.title ||
                              "Customer conversation"}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                          Reply needed
                        </span>
                      </div>

                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#666666]">
                        {latestMessage?.content || "New customer message"}
                      </p>

                      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#999999]">
                        <Clock size={12} />
                        {latestMessage
                          ? new Date(
                              latestMessage.createdAt
                            ).toLocaleString()
                          : "Recently updated"}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            href="/admin/human-handoffs"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 border-t border-[#EEEEEE] px-5 py-4 text-sm font-semibold text-[#D94F25] transition hover:bg-[#FFF8F5]"
          >
            Open Human Handoffs
            <ArrowUpRight size={16} />
          </Link>
        </div>
      )}

      <button
        onClick={() => setOpen((previous) => !previous)}
        aria-label={
          open ? "Close notifications" : "Open handoff notifications"
        }
        aria-expanded={open}
        className="relative ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EC5424] text-white shadow-xl shadow-orange-900/25 transition duration-200 hover:scale-105 hover:bg-[#D9471B] active:scale-95"
      >
        {open ? <X size={23} /> : <MessageCircle size={24} />}

        {totalNotifications > 0 && !open && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-bold text-white">
            {totalNotifications > 99 ? "99+" : totalNotifications}
          </span>
        )}
      </button>
    </div>
  );
}
