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
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <BrandMark />
        <h1 className="mt-6 text-2xl font-semibold text-charcoal">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
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
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Spinner /></div>}>
      <LoginForm />
    </Suspense>
  );
}
