import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main>
      <Suspense
        fallback={<p className="text-sm text-muted">Loading sign-in…</p>}
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
