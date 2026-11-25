'use client';

import { Globe } from 'lucide-react';
import { useI18n, LOCALES, LOCALE_LABELS, isLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors',
        className,
      )}
    >
      <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={locale}
        onChange={(e) => {
          if (isLocale(e.target.value)) setLocale(e.target.value);
        }}
        aria-label={t('common.language')}
        className="flex-1 bg-transparent text-sm text-gray-600 focus:outline-none cursor-pointer"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
