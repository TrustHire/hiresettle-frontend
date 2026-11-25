'use client';

import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { usePushNotifications } from '@/lib/hooks/use-push-notifications';

/**
 * Settings toggle for browser notifications. Permission is only requested
 * when the user switches this on — never on page load.
 */
export function PushNotificationToggle() {
  const { enabled, permission, supported, setPushEnabled } = usePushNotifications();
  const [pending, setPending] = useState(false);

  const denied = permission === 'denied';

  const handleToggle = async () => {
    setPending(true);
    try {
      const next = !enabled;
      const result = await setPushEnabled(next);
      if (next && !result) {
        toast.error('Browser notifications were blocked. Allow them in your browser settings.');
      } else if (next) {
        toast.success('Browser notifications enabled');
      }
    } finally {
      setPending(false);
    }
  };

  const description = !supported
    ? 'Your browser does not support notifications.'
    : denied
      ? 'Notifications are blocked for this site. Allow them in your browser settings.'
      : 'Get an alert for retention unlocks, disputes and other updates, even when this tab is in the background.';

  return (
    <div className="card p-4 mb-4 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <BellRing className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p id="push-toggle-label" className="text-sm font-medium text-gray-900">
            Browser notifications
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby="push-toggle-label"
        onClick={handleToggle}
        disabled={pending || !supported || (denied && !enabled)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          enabled ? 'bg-brand-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
