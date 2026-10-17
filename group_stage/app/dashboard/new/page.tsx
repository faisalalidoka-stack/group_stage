"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { generateRoundRobinSchedule } from "@/lib/algorithms";
import { useRequireUser } from "@/lib/useRequireUser";

const MIN_TEAMS = 3;
const MAX_TEAMS = 16;

function generateSlug(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "league"}-${crypto.randomUUID().slice(0, 4)}`;
}

export default function NewTournamentPage() {
  const router = useRouter();
  const { loading: authLoading } = useRequireUser();

  const [leagueName, setLeagueName] = useState("");
  const [venue, setVenue] = useState("");
  const [teams, setTeams] = useState<string[]>(["", "", "", ""]);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function updateTeam(index: number, value: string) {
    setTeams((current) =>
      current.map((team, i) => (i === index ? value : team))
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const name = leagueName.trim();

    if (!name) {
      setError("Enter a tournament name.");
      return;
    }

    const cleanTeams = teams.map((t) => t.trim()).filter(Boolean);

    if (cleanTeams.length < MIN_TEAMS) {
      setError(`You need at least ${MIN_TEAMS} teams.`);
      return;
    }

    const lowered = cleanTeams.map((t) => t.toLowerCase());

    if (new Set(lowered).size !== lowered.length) {
      setError("Team names must be unique.");
      return;
    }

    // Fixtures refer to teams by their position in cleanTeams;
    // the database function swaps positions for real team ids.
    const fixtures = generateRoundRobinSchedule(
      cleanTeams.map((_, index) => String(index))
    ).map((fixture) => ({
      round: fixture.round,
      home: Number(fixture.homeTeamId),
      away: Number(fixture.awayTeamId),
    }));

    setCreating(true);

    try {
      let slug = "";
      let lastError = "Failed to create tournament.";

      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = generateSlug(name);

        const { error: rpcError } = await supabase.rpc(
          "create_tournament",
          {
            p_name: name,
            p_slug: candidate,
            p_venue: venue.trim() || null,
            p_teams: cleanTeams,
            p_fixtures: fixtures,
          }
        );

        if (!rpcError) {
          slug = candidate;
          break;
        }

        lastError = rpcError.message;

        // 23505 = slug collision, try a new suffix.
        if (rpcError.code !== "23505") break;
      }

      if (!slug) throw new Error(lastError);

      router.push(`/admin/${slug}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create tournament."
      );
      setCreating(false);
    }
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d]">
        <Loader2 size={22} className="animate-spin text-gray-400" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft size={16} />
          My Tournaments
        </button>

        <h1 className="mt-4 text-3xl font-black">New tournament</h1>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          {error && (
            <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <label className="block">
            <span className="text-xs text-gray-500">
              Tournament name
            </span>
            <input
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />
          </label>

          <label className="block">
            <span className="text-xs text-gray-500">
              Default venue (optional)
            </span>
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Teams ({MIN_TEAMS} to {MAX_TEAMS})
              </span>
              <button
                type="button"
                disabled={teams.length >= MAX_TEAMS}
                onClick={() => setTeams((c) => [...c, ""])}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-400 disabled:opacity-40"
              >
                <Plus size={14} />
                Add team
              </button>
            </div>

            <div className="mt-2 space-y-2">
              {teams.map((team, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={team}
                    placeholder={`Team ${index + 1}`}
                    onChange={(e) => updateTeam(index, e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    disabled={teams.length <= MIN_TEAMS}
                    onClick={() =>
                      setTeams((c) => c.filter((_, i) => i !== index))
                    }
                    className="rounded-xl border border-white/10 px-3 text-gray-500 hover:text-red-300 disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            {creating && <Loader2 size={16} className="animate-spin" />}
            Create tournament and generate fixtures
          </button>
        </form>
      </div>
    </main>
  );
}
