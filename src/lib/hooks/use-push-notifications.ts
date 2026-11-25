'use client';

/**
 * usePushNotifications
 *
 * Manages the user's opt-in for browser (OS-level) notifications.
 *
 * Permission is never requested on page load — only when the user flips the
 * toggle in the notification settings (see PushNotificationToggle). The
 * preference is persisted in localStorage so it survives reloads, and a small
 * in-memory pub/sub keeps every mounted hook instance in sync.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'hiresettle_push_enabled';

export type PushPermission = NotificationPermission | 'unsupported';

const listeners = new Set<() => void>();

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function readPermission(): PushPermission {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

function readPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writePreference(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, 'true');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode) — keep the in-memory value only
  }
  listeners.forEach((l) => l());
}

/** True when the user opted in AND the browser granted permission. */
export function isPushActive(): boolean {
  return readPreference() && readPermission() === 'granted';
}

export function usePushNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<PushPermission>('default');

  useEffect(() => {
    const sync = () => {
      setEnabled(readPreference());
      setPermission(readPermission());
    };
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  /**
   * Turn browser notifications on or off. Turning them on requests
   * permission if it hasn't been decided yet. Returns the resulting state.
   */
  const setPushEnabled = useCallback(async (next: boolean): Promise<boolean> => {
    if (!next) {
      writePreference(false);
      return false;
    }
    if (!isPushSupported()) return false;

    let result = Notification.permission;
    if (result === 'default') {
      result = await Notification.requestPermission();
    }
    const granted = result === 'granted';
    writePreference(granted);
    setPermission(result);
    return granted;
  }, []);

  return {
    /** User preference combined with granted permission */
    enabled: enabled && permission === 'granted',
    permission,
    supported: permission !== 'unsupported',
    setPushEnabled,
  };
}
