'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Loader2, Clock } from 'lucide-react';
import { notificationsApi } from '@/lib/api/services';
import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/types';

const TYPE_COLORS: Record<string, string> = {
  PAYMENT_RELEASED:             'bg-green-50 text-green-700',
  MILESTONE_UNLOCKED:           'bg-sky-50 text-sky-700',
  PROOF_SUBMITTED:              'bg-amber-50 text-amber-700',
  DISPUTE_RAISED:               'bg-red-50 text-red-700',
  DISPUTE_RESOLVED:             'bg-purple-50 text-purple-700',
  REPLACEMENT_REQUESTED:        'bg-orange-50 text-orange-700',
  RETENTION_WINDOW_APPROACHING: 'bg-yellow-50 text-yellow-700',
  ENGAGEMENT_CANCELLED:         'bg-gray-100 text-gray-600',
  ENGAGEMENT_CREATED:           'bg-brand-50 text-brand-700',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    notificationsApi.list()
      .then((res) => setNotifications(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    load();
  };

  const handleMarkRead = async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read: true } : n),
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="btn-secondary text-xs">
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
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
              onClick={() => !n.read && handleMarkRead(n.id)}
              className={`p-4 flex items-start gap-3 transition-colors ${
                n.read ? 'opacity-60' : 'cursor-pointer hover:bg-gray-50'
              }`}
            >
              {/* Unread dot */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                n.read ? 'bg-gray-200' : 'bg-brand-600'
              }`} />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <span className={`badge text-[10px] flex-shrink-0 ${
                    TYPE_COLORS[n.type] ?? 'bg-gray-100 text-gray-600'
                  }`}>
                    {n.type.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{n.message}</p>
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
