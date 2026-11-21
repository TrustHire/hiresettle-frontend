"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
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
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="card max-w-lg p-8 text-center" role="alert">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h1 className="mb-2 text-lg font-semibold text-gray-900">
          Something went wrong
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          We couldn&apos;t load this dashboard page. Please try again.
        </p>
        <button type="button" onClick={reset} className="btn-primary">
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
