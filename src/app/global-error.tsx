"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import "@/styles/globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
          <div className="card w-full max-w-md p-8 text-center" role="alert">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <h1 className="mb-2 text-xl font-semibold text-gray-900">
              HireSettle encountered an error
            </h1>
            <p className="mb-6 text-sm text-gray-500">
              Please try again. If the problem continues, refresh the page.
            </p>
            <button type="button" onClick={reset} className="btn-primary">
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
