"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { Button, ErrorBanner, Field, Input, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { sessionApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/errors";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const user = await sessionApi.login(username.trim(), password);
      setUser(user);
      router.replace(params.get("next") || "/dashboard");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="bg-charcoal px-6 py-5 sm:px-8 sm:py-6">
          <BrandMark inverted large />
        </div>
        <div className="p-6 sm:p-8">
          <h1 className="page-title text-charcoal">Sign in</h1>
          <p className="mt-1 body-text text-muted">
            Use the shop Staff session for daily work, or Admin for staff management.
          </p>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {error ? <ErrorBanner message={error} /> : null}
            <Field label="Username">
              <Input
                name="username"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </Field>
            <Field label="Password">
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Spinner /></div>}>
      <LoginForm />
    </Suspense>
  );
}
