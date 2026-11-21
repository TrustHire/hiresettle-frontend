import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md text-center">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2.5"
          aria-label="HireSettle home"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <ShieldCheck className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-semibold text-gray-900">
            HireSettle
          </span>
        </Link>

        <div className="card px-6 py-12">
          <p className="mb-2 text-sm font-semibold text-brand-600">404</p>
          <h1 className="mb-3 text-2xl font-semibold text-gray-900">
            Page not found
          </h1>
          <p className="mx-auto mb-7 max-w-sm text-sm text-gray-500">
            Sorry, we couldn&apos;t find the page you&apos;re looking for.
          </p>
          <Link href="/dashboard" className="btn-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
