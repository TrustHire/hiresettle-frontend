"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, User as UserIcon, Mail, Bell, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usersApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/hooks/use-auth-store";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { userKeys } from "@/lib/query-keys";
import { shortAddress } from "@/lib/utils";
import { toReadableError } from "@/lib/utils/toast-error";
import type { NotificationPreferences, UpdateProfileInput, User } from "@/types";

const NAME_MAX_LENGTH = 80;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: false,
  retentionUnlocks: true,
  paymentReleased: true,
  disputes: true,
};

const PREFERENCE_OPTIONS: {
  key: Exclude<keyof NotificationPreferences, "emailEnabled">;
  label: string;
  description: string;
}[] = [
  {
    key: "retentionUnlocks",
    label: "Retention unlocks",
    description: "When a retention milestone's lock period ends and it can be unlocked.",
  },
  {
    key: "paymentReleased",
    label: "Payments released",
    description: "When a milestone payment is released from escrow.",
  },
  {
    key: "disputes",
    label: "Disputes",
    description: "When a dispute is raised or resolved on one of your engagements.",
  },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { address, isHydrated, setUser } = useAuthStore();
  const { user, query } = useCurrentUser();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [initialised, setInitialised] = useState(false);

  // Populate the form once the profile has loaded
  useEffect(() => {
    if (initialised || !user) return;
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setPreferences({ ...DEFAULT_PREFERENCES, ...(user.notificationPreferences ?? {}) });
    setInitialised(true);
  }, [user, initialised]);

  const nameError = useMemo<string | null>(() => {
    if (name.trim().length > NAME_MAX_LENGTH) {
      return `Display name must be ${NAME_MAX_LENGTH} characters or fewer.`;
    }
    return null;
  }, [name]);

  const emailError = useMemo<string | null>(() => {
    const v = email.trim();
    if (v === "") {
      return preferences.emailEnabled ? "An email address is required for email alerts." : null;
    }
    if (!EMAIL_PATTERN.test(v)) return "Enter a valid email address.";
    return null;
  }, [email, preferences.emailEnabled]);

  const dirty = useMemo(() => {
    if (!user) return false;
    const saved = { ...DEFAULT_PREFERENCES, ...(user.notificationPreferences ?? {}) };
    return (
      name.trim() !== (user.name ?? "") ||
      email.trim() !== (user.email ?? "") ||
      (Object.keys(saved) as (keyof NotificationPreferences)[]).some(
        (k) => saved[k] !== preferences[k],
      )
    );
  }, [user, name, email, preferences]);

  const save = useMutation({
    mutationFn: (input: UpdateProfileInput) => usersApi.updateMe(input),
    onSuccess: (updated: User) => {
      queryClient.setQueryData(userKeys.me(address), updated);
      setUser(updated);
      setName(updated.name ?? "");
      setEmail(updated.email ?? "");
      setPreferences({ ...DEFAULT_PREFERENCES, ...(updated.notificationPreferences ?? {}) });
      toast.success("Settings saved");
    },
    onError: (error) => toast.error(toReadableError(error)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameError || emailError || save.isPending) return;
    save.mutate({
      name: name.trim() || null,
      email: email.trim() || null,
      notificationPreferences: preferences,
    });
  };

  const togglePreference = (key: keyof NotificationPreferences) =>
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));

  const loading = !isHydrated || (query.isLoading && !user);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your profile and how HireSettle notifies you.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      ) : query.isError && !user ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-red-600">Failed to load your profile.</p>
          <button onClick={() => query.refetch()} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* ── Profile ── */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserIcon className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Stellar address</label>
                <input
                  value={address ?? ""}
                  readOnly
                  className="input bg-gray-50 text-gray-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="label" htmlFor="settings-name">Display name</label>
                <input
                  id="settings-name"
                  placeholder={address ? shortAddress(address) : "Your name or company"}
                  value={name}
                  maxLength={NAME_MAX_LENGTH + 20}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!nameError}
                  className={`input ${nameError ? "border-red-400 focus:ring-red-300" : ""}`}
                />
                {nameError ? (
                  <FieldError message={nameError} />
                ) : (
                  <p className="text-xs text-gray-400 mt-1">
                    Shown in the sidebar instead of your wallet address.
                  </p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="settings-email">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    id="settings-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!emailError}
                    className={`input pl-9 ${emailError ? "border-red-400 focus:ring-red-300" : ""}`}
                  />
                </div>
                {emailError && <FieldError message={emailError} />}
              </div>
            </div>
          </div>

          {/* ── Notifications ── */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Email notifications</h2>
            </div>

            <ToggleRow
              id="pref-email-enabled"
              label="Send me email alerts"
              description="In-app notifications are always on. Email alerts need an email address."
              checked={preferences.emailEnabled}
              onChange={() => togglePreference("emailEnabled")}
            />

            <div className="mt-2 pl-4 border-l border-gray-100 divide-y divide-gray-50">
              {PREFERENCE_OPTIONS.map(({ key, label, description }) => (
                <ToggleRow
                  key={key}
                  id={`pref-${key}`}
                  label={label}
                  description={description}
                  checked={preferences[key]}
                  disabled={!preferences.emailEnabled}
                  onChange={() => togglePreference(key)}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!dirty || !!nameError || !!emailError || save.isPending}
              className="btn-primary"
            >
              {save.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save changes
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-gray-900">
          {label}
        </label>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${
          checked ? "bg-brand-600" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-red-600">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      {message}
    </p>
  );
}
