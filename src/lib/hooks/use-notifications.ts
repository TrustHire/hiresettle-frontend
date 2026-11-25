import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { notificationsApi } from '@/lib/api/services';
import { isPushActive } from '@/lib/hooks/use-push-notifications';
import type { Notification } from '@/types';

const POLL_INTERVAL = 30_000; // 30 seconds

/** Resolve the in-app page a notification should deep-link to. */
export function notificationHref(n: Notification): string {
  const engagementId = n.data?.engagementId;
  return typeof engagementId === 'string' && engagementId
    ? `/dashboard/engagements/${encodeURIComponent(engagementId)}`
    : '/dashboard/notifications';
}

interface UseNotificationsOptions {
  /**
   * Show a browser notification for each newly-arrived unread notification
   * (only when the user has opted in from the notification settings).
   * Enable this in a single always-mounted component to avoid duplicates.
   */
  browserPush?: boolean;
}

export function useNotifications({ browserPush = false }: UseNotificationsOptions = {}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // IDs of unread notifications we've already seen; null until the first fetch
  // so that pre-existing unread items don't trigger a burst of alerts.
  const seenUnreadRef = useRef<Set<string> | null>(null);

  const showBrowserNotifications = useCallback(
    (unread: Notification[]) => {
      const seen = seenUnreadRef.current;
      seenUnreadRef.current = new Set([...(seen ?? []), ...unread.map((n) => n.id)]);
      if (!browserPush || !seen || !isPushActive()) return;

      unread
        .filter((n) => !seen.has(n.id))
        .forEach((n) => {
          try {
            const alert = new window.Notification(n.title, {
              body: n.message,
              tag: n.id,
              icon: '/favicon.svg',
            });
            alert.onclick = () => {
              window.focus();
              router.push(notificationHref(n));
              alert.close();
            };
          } catch {
            // Some browsers (e.g. Android Chrome) only allow notifications via a service worker
          }
        });
    },
    [browserPush, router],
  );

  const fetchUnread = useCallback(async () => {
    try {
      // Fetch enough for the dropdown (5) plus the total unread count in one go
      const [unreadRes, latestRes] = await Promise.all([
        notificationsApi.list({ unreadOnly: true, limit: 100 }),
        notificationsApi.list({ limit: 5 }),
      ]);

      showBrowserNotifications(unreadRes.data);

      // Merge: latest 5 items for the dropdown, but track unread count from the full unread list
      setNotifications((prev) => {
        // Build a map of previously known notifications so we can preserve local read state
        const prevMap = new Map(prev.map((n) => [n.id, n]));

        // Merge latest 5 with up-to-date server state
        const merged = latestRes.data.map((n) => ({
          ...n,
          // If we already locally marked it read, keep that until next poll confirms it
          read: prevMap.get(n.id)?.read ?? n.read,
        }));

        // Attach the unread notifications that aren't already in the top-5 list
        // so unreadCount reflects the real server state
        const top5Ids = new Set(merged.map((n) => n.id));
        const extraUnread = unreadRes.data
          .filter((n) => !top5Ids.has(n.id))
          .map((n) => ({ ...n, read: prevMap.get(n.id)?.read ?? n.read }));

        return [...merged, ...extraUnread];
      });
    } catch {
      // Silently swallow polling errors to avoid noisy UI
    } finally {
      setLoading(false);
    }
  }, [showBrowserNotifications]);

  // Keep polling in a background tab when browser notifications are on —
  // that's exactly when the user needs to be alerted.
  const shouldPoll = useCallback(
    () => document.visibilityState === 'visible' || (browserPush && isPushActive()),
    [browserPush],
  );

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      if (shouldPoll()) {
        fetchUnread();
      }
    }, POLL_INTERVAL);
  }, [fetchUnread, shouldPoll]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchUnread();

    // Start / stop polling based on tab visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUnread(); // Immediately refresh when tab becomes visible again
        startPolling();
      } else if (!shouldPoll()) {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    startPolling();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopPolling();
    };
  }, [fetchUnread, startPolling, stopPolling, shouldPoll]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await notificationsApi.markRead(id);
    } catch {
      // Roll back on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      // Re-fetch to restore real state on failure
      fetchUnread();
    }
  }, [fetchUnread]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  // The dropdown shows only the 5 most recent (first 5 from the merged list)
  const latest = notifications.slice(0, 5);

  return { notifications, latest, unreadCount, loading, markRead, markAllRead };
}
