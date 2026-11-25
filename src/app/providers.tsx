"use client";
import { useEffect } from "react";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useAuthStore } from "@/lib/hooks/use-auth-store";
import { I18nProvider, type Locale } from "@/lib/i18n";

export function Providers({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const rehydrate = useAuthStore((s) => s.rehydrate);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => {
    rehydrate();
  }, [rehydrate]);
  return (
    <I18nProvider initialLocale={locale}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{ duration: 6000 }}
        />
      </QueryClientProvider>
    </I18nProvider>
  );
}
