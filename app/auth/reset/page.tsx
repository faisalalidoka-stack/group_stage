"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trophy } from "lucide-react";

import { supabase } from "@/lib/supabase";

const MIN_PASSWORD = 8;

export default function ResetPasswordPage() {
  const router = useRouter();

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.replace("/dashboard"), 1200);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07090d] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-black">
          <Trophy size={22} />
        </div>

        <h1 className="mt-4 text-xl font-bold">Choose a new password</h1>

        {hasSession === null && (
          <div className="mt-6 flex items-center gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" /> Checking link...
          </div>
        )}

        {hasSession === false && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-400">
              This reset link is invalid or has expired. Request a new one
              from the sign-in page.
            </p>
            <button
              onClick={() => router.replace("/")}
              className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:bg-emerald-400"
            >
              Back to sign in
            </button>
          </div>
        )}

        {hasSession && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            {done && (
              <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                Password updated. Taking you to your tournaments...
              </p>
            )}

            <label className="block">
              <span className="text-xs text-gray-500">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </label>

            <button
              type="submit"
              disabled={busy || done}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Update password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
