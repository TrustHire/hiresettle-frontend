import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import '@/styles/globals.css';
import { LOCALE_COOKIE, resolveLocale } from '@/lib/i18n/config';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'HireSettle', template: '%s | HireSettle' },
  description: 'Milestone-based recruiter fee escrow on Stellar Soroban',
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.json',
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = resolveLocale(cookies().get(LOCALE_COOKIE)?.value);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <Providers locale={locale}>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'));}`,
          }}
        />
      </body>
    </html>
  );
}
