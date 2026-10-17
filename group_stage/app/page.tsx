"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trophy } from "lucide-react";

import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup" | "forgot";

const MIN_PASSWORD = 8;

export default function HomePage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const linkError = new URLSearchParams(
      window.location.search
    ).get("error");

    supabase.auth.getSession().then(({ data }) => {
      if (linkError) setError(linkError);

      if (data.session) {
        router.replace("/dashboard");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setSuccess("");
    setPassword("");
    setConfirm("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Enter your email address.");
      return;
    }

    if (mode !== "forgot") {
      if (!password) {
        setError("Enter your password.");
        return;
      }

      if (mode === "signup") {
        if (password.length < MIN_PASSWORD) {
          setError(
            `Password must be at least ${MIN_PASSWORD} characters.`
          );
          return;
        }

        if (password !== confirm) {
          setError("Passwords do not match.");
          return;
        }
      }
    }

    setBusy(true);

    try {
      if (mode === "signin") {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (signInError) {
          setError(
            signInError.message === "Email not confirmed"
              ? "Confirm your email first. Check your inbox for the link we sent."
              : signInError.message
          );
          return;
        }

        router.replace("/dashboard");
        return;
      }

      if (mode === "signup") {
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        // Supabase returns a user with no identities when the
        // email is already registered.
        if (data.user && data.user.identities?.length === 0) {
          setError(
            "That email already has an account. Sign in instead, or reset your password."
          );
          return;
        }

        if (data.session) {
          router.replace("/dashboard");
          return;
        }

        setSuccess(
          "Account created. Check your email and open the confirmation link, then sign in."
        );
        setMode("signin");
        setPassword("");
        setConfirm("");
        return;
      }

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
        });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(
        "If an account exists for that email, a reset link is on its way."
      );
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-white">
        <Loader2 size={22} className="animate-spin text-gray-400" />
      </main>
    );
  }

  const title =
    mode === "signin"
      ? "Sign in"
      : mode === "signup"
        ? "Create administrator account"
        : "Reset your password";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07090d] px-4 py-10 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-black">
            <Trophy size={26} />
          </div>
          <h1 className="mt-4 text-3xl font-black">Group Stage</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create. Compete. Share.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h2 className="text-lg font-bold">{title}</h2>

          {error && (
            <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
              {success}
            </p>
          )}

          <label className="block">
            <span className="text-xs text-gray-500">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />
          </label>

          {mode !== "forgot" && (
            <label className="block">
              <span className="text-xs text-gray-500">Password</span>
              <input
                type="password"
                autoComplete={
                  mode === "signin"
                    ? "current-password"
                    : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </label>
          )}

          {mode === "signup" && (
            <label className="block">
              <span className="text-xs text-gray-500">
                Confirm password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"}
          </button>

          <div className="flex items-center justify-between text-sm text-gray-400">
            {mode === "signin" ? (
              <>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="hover:text-white"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  Create account
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-emerald-400 hover:text-emerald-300"
              >
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
