"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminNotificationItem } from "@/services/admin.service";

const lastSeenKey = "ga-admin-notifications-last-seen";

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminNotificationBell({
  initialNotifications,
  refreshKey = 0,
}: {
  initialNotifications: AdminNotificationItem[];
  refreshKey?: number;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(0);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const unreadNotificationsCount = notifications.filter(
    (item) => Date.parse(item.createdAt) > seenAt,
  ).length;

  useEffect(() => {
    function syncSeen() {
      try {
        setSeenAt(Date.parse(window.localStorage.getItem(lastSeenKey) || "") || 0);
      } catch {
        // The bell still works during this visit when storage is unavailable.
      }
    }
    syncSeen();
    window.addEventListener("storage", syncSeen);
    return () => window.removeEventListener("storage", syncSeen);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/admin/notifications", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const result = await response.json() as { notifications: AdminNotificationItem[] };
          if (!controller.signal.aborted) setNotifications(result.notifications);
        }
      } catch {
        // Keep the last successful feed until the next refresh.
      }
    }
    if (refreshKey) void refresh();
    const interval = window.setInterval(refresh, 45000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!isNotificationsOpen) return;
    function closeOutside(event: MouseEvent) {
      if (!notificationPanelRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [isNotificationsOpen]);

  function markRead() {
    if (unreadNotificationsCount) {
      const latest = Math.max(seenAt, ...notifications.map((item) => Date.parse(item.createdAt)));
      setSeenAt(latest);
      try {
        window.localStorage.setItem(lastSeenKey, new Date(latest).toISOString());
      } catch {
        // Keep the current read state in memory.
      }
    }
  }

  return (
    <div className="ga-admin-notification-wrap" ref={notificationPanelRef}>
      <button
        type="button"
        className="ga-admin-bell-btn"
        aria-label={unreadNotificationsCount ? `Notifications, ${unreadNotificationsCount} unread` : "Notifications"}
        aria-expanded={isNotificationsOpen}
        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="ga-admin-bell-icon">
          <path
            d="M12 3a4 4 0 0 0-4 4v1.1c0 1.1-.4 2.1-1.1 2.9L5.7 12.3A3 3 0 0 0 8 17h8a3 3 0 0 0 2.3-4.7l-1.2-1.4A4.5 4.5 0 0 1 16 8.1V7a4 4 0 0 0-4-4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 19a2 2 0 0 0 4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        {unreadNotificationsCount > 0 ? (
          <span className="ga-admin-bell-badge">{unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}</span>
        ) : null}
      </button>

      {isNotificationsOpen ? (
        <div className="ga-admin-notification-panel">
          <div className="ga-admin-notification-head">
            <div>
              <strong>Notifications</strong>
              <p>{unreadNotificationsCount > 0 ? `${unreadNotificationsCount} new updates` : "All caught up"}</p>
            </div>
            <div className="ga-admin-actions">
              {unreadNotificationsCount > 0 && (
                <button type="button" className="ga-admin-notification-close" onClick={markRead}>
                  Mark all read
                </button>
              )}
              <button type="button" className="ga-admin-notification-close" onClick={() => setIsNotificationsOpen(false)}>
                Close
              </button>
            </div>
          </div>

          <div className="ga-admin-notification-list">
            {notifications.length > 0 ? (
              notifications.map((item) => {
                const isUnread = Date.parse(item.createdAt) > seenAt;
                return (
                  <article key={item.id} className={`ga-admin-notification-item ${isUnread ? "is-unread" : ""}`}>
                    <div className="ga-admin-notification-item-head">
                      <strong>{item.title}</strong>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                    <p>{item.message}</p>
                    {item.href && <a href={item.href}>Find registration</a>}
                  </article>
                );
              })
            ) : (
              <p className="ga-admin-notification-empty">No notifications yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
