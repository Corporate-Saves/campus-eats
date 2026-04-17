import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-text">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold text-text">Page not found</h1>
        <p className="mt-3 text-sm text-muted">
          That link may be broken or the page was moved. Head back to your
          dashboard to keep ordering.
        </p>
        <Link
          href="/student/dashboard"
          className="mt-8 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-95"
        >
          Go to Dashboard
        </Link>
        <p className="mt-6">
          <Link
            href="/"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Home
          </Link>
        </p>
      </div>
    </main>
  );
}
