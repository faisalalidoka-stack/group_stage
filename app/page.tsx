"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function createSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleNameChange(value: string) {
    setName(value);

    if (!slug) {
      setSlug(createSlug(value));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!name.trim() || !slug.trim()) {
      setError("Tournament name and slug are required.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "You must be signed in before creating a tournament."
        );
        return;
      }

      const { data, error: insertError } = await supabase
        .from("tournaments")
        .insert({
          admin_id: user.id,
          name: name.trim(),
          public_slug: slug.trim(),
          format: "ROUND_ROBIN",
        })
        .select("public_slug")
        .single();

      if (insertError) {
        throw insertError;
      }

      router.push(`/admin/${data.public_slug}`);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while creating the tournament."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div className="grid w-full gap-12 md:grid-cols-2 md:items-center">
          <section>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              Group Stage
            </p>

            <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
              Run your tournament.
              <span className="block text-blue-400">
                Let everyone follow it.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
              Create a round-robin tournament, schedule matches,
              manage teams, update scores and give spectators a
              public tournament page.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
            <h2 className="text-2xl font-semibold">
              Create Tournament
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Start a new round-robin competition.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Tournament name
                </label>

                <input
                  value={name}
                  onChange={(e) =>
                    handleNameChange(e.target.value)
                  }
                  placeholder="Kampala Community League"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Public URL
                </label>

                <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                  <span className="flex items-center border-r border-slate-700 px-3 text-sm text-slate-500">
                    /t/
                  </span>

                  <input
                    value={slug}
                    onChange={(e) =>
                      setSlug(createSlug(e.target.value))
                    }
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
                    placeholder="kampala-community-league"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Creating..."
                  : "Create Tournament"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}