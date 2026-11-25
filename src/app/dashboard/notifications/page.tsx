"use client";

import { Bell, CheckCheck, Loader2, Clock } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationsApi } from "@/lib/api/services";
import { PushNotificationToggle } from "@/components/notifications/PushNotificationToggle";
import { notificationKeys } from "@/lib/query-keys";
import { timeAgo } from "@/lib/utils";
import { toReadableError } from "@/lib/utils/toast-error";
import type { Notification, PaginatedResponse } from "@/types";

const TYPE_COLORS: Record<string, string> = {
  PAYMENT_RELEASED: "bg-green-50 text-green-700",
  MILESTONE_UNLOCKED: "bg-sky-50 text-sky-700",
  PROOF_SUBMITTED: "bg-amber-50 text-amber-700",
  DISPUTE_RAISED: "bg-red-50 text-red-700",
  DISPUTE_RESOLVED: "bg-purple-50 text-purple-700",
  REPLACEMENT_REQUESTED: "bg-orange-50 text-orange-700",
  RETENTION_WINDOW_APPROACHING: "bg-yellow-50 text-yellow-700",
  ENGAGEMENT_CANCELLED: "bg-gray-100 text-gray-600",
  ENGAGEMENT_CREATED: "bg-brand-50 text-brand-700",
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: notificationKeys.list(),
    queryFn: () => notificationsApi.list(),
  });
  const notifications = notificationsQuery.data?.data ?? [];
  const loading = notificationsQuery.isLoading;
  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    onError: (error) => toast.error(toReadableError(error)),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: async (_, id) => {
      queryClient.setQueryData<PaginatedResponse<Notification>>(
        notificationKeys.list(),
        (current) =>
          current && {
            ...current,
            data: current.data.map((notification) =>
              notification.id === id
                ? { ...notification, read: true }
                : notification,
            ),
          },
      );
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (error) => toast.error(toReadableError(error)),
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="btn-secondary text-xs"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <PushNotificationToggle />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      ) : notificationsQuery.isError && !notificationsQuery.data ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-red-600">Failed to load notifications.</p>
          <button
            onClick={() => notificationsQuery.refetch()}
            className="btn-secondary mt-4"
          >
            Retry
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && markRead.mutate(n.id)}
              className={`p-4 flex items-start gap-3 transition-colors ${
                n.read ? "opacity-60" : "cursor-pointer hover:bg-gray-50"
              }`}
            >
              {/* Unread dot */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                  n.read ? "bg-gray-200" : "bg-brand-600"
                }`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <span
                    className={`badge text-[10px] flex-shrink-0 ${
                      TYPE_COLORS[n.type] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {n.type.replace(/_/g, " ").toLowerCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {n.message}
                </p>
                <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(n.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
