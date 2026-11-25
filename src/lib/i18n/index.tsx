'use client';

/**
 * lib/i18n/index.tsx
 *
 * Lightweight, App Router–compatible i18n:
 *  - The root layout (a Server Component) reads the locale cookie and passes it
 *    down, so the first render — server and client — is already localised and
 *    `<html lang>` is correct.
 *  - Messages live in `src/messages/<locale>.json` and are looked up with
 *    dot-separated keys, with `{name}` placeholders for interpolation.
 *  - Switching locale writes the cookie, updates client state immediately and
 *    refreshes the server tree.
 *  - Dates are formatted with the active locale (see `formatDate` / `timeAgo`
 *    in `@/lib/utils`, which read the locale set here).
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setDateLocale, formatDate, timeAgo } from '@/lib/utils';
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from './config';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';

export * from './config';

type Messages = typeof en;

const MESSAGES: Record<Locale, Messages> = { en, es, fr };

type Vars = Record<string, string | number>;

function lookup(messages: unknown, key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      messages,
    );
  return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Translate `key` for `locale`, falling back to English and then to the key itself. */
export function translate(locale: Locale, key: string, vars?: Vars): string {
  const template = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES[DEFAULT_LOCALE], key) ?? key;
  return interpolate(template, vars);
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Vars) => string;
  formatDate: (date: string | null) => string;
  timeAgo: (date: string | null) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Keep the shared date formatters in sync before any child renders.
  setDateLocale(locale);

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      setDateLocale(next);
      setLocaleState(next);
      router.refresh();
    },
    [router],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      formatDate: (date) => formatDate(date, locale),
      timeAgo: (date) => timeAgo(date, locale),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** Shorthand for components that only need `t`. */
export function useTranslations() {
  return useI18n().t;
}
