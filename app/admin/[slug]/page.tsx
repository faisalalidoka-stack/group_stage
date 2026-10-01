"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateRoundRobinSchedule } from "@/lib/algorithms";

type Team = {
  id: string;
  name: string;
  logo_url: string | null;
};

type Match = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: string;
  round_number: number;
  location: string | null;
  referee_name: string | null;
  scheduled_at: string | null;
};

export default function AdminPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTournament();
  }, [slug]);

  async function loadTournament() {
    setLoading(true);

    const { data: tournamentData } = await supabase
      .from("tournaments")
      .select("*")
      .eq("public_slug", slug)
      .single();

    if (!tournamentData) {
      setLoading(false);
      setMessage("Tournament not found.");
      return;
    }

    setTournament(tournamentData);

    const { data: teamsData } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentData.id)
      .order("name");

    const { data: matchesData } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentData.id)
      .order("round_number")
      .order("scheduled_at");

    setTeams(teamsData ?? []);
    setMatches(matchesData ?? []);
    setLoading(false);
  }

  async function addTeam() {
    if (!teamName.trim() || !tournament) return;

    setMessage("");

    const { error } = await supabase.from("teams").insert({
      tournament_id: tournament.id,
      name: teamName.trim(),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setTeamName("");
    await loadTournament();
  }

  async function generateSchedule() {
    if (!tournament || teams.length < 2) {
      setMessage("Add at least two teams first.");
      return;
    }

    if (matches.length > 0) {
      setMessage(
        "A schedule already exists. Delete the existing matches before generating another."
      );
      return;
    }

    const schedule = generateRoundRobinSchedule(teams);

    const rows = schedule.map((match) => ({
      tournament_id: tournament.id,
      home_team_id: match.home_team_id,
      away_team_id: match.away_team_id,
      round_number: match.round_number,
      status: "SCHEDULED",
      home_score: 0,
      away_score: 0,
    }));

    const { error } = await supabase
      .from("matches")
      .insert(rows);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadTournament();
  }

  async function updateMatch(
    matchId: string,
    values: Partial<Match>
  ) {
    const { error } = await supabase
      .from("matches")
      .update(values)
      .eq("id", matchId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadTournament();
  }

  function teamNameById(id: string) {
    return teams.find((team) => team.id === id)?.name ?? "Unknown";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        Loading dashboard...
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <h1 className="text-2xl font-bold">Tournament not found</h1>
        <p className="mt-2 text-slate-400">{message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10">
          <p className="text-sm uppercase tracking-widest text-blue-400">
            Admin Dashboard
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            {tournament.name}
          </h1>

          <p className="mt-2 text-slate-400">
            Public page:{" "}
            <a
              href={`/t/${tournament.public_slug}`}
              className="text-blue-400 hover:underline"
            >
              /t/{tournament.public_slug}
            </a>
          </p>
        </header>

        {message && (
          <div className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/40 p-4 text-yellow-300">
            {message}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[350px_1fr]">
          <aside className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">
                Add Team
              </h2>

              <div className="mt-4 flex gap-2">
                <input
                  value={teamName}
                  onChange={(e) =>
                    setTeamName(e.target.value)
                  }
                  placeholder="Team name"
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-blue-500"
                />

                <button
                  onClick={addTeam}
                  className="rounded-lg bg-blue-600 px-4 font-semibold hover:bg-blue-500"
                >
                  Add
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Teams
                </h2>

                <span className="text-sm text-slate-500">
                  {teams.length}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="rounded-lg bg-slate-950 px-4 py-3"
                  >
                    {team.name}
                  </div>
                ))}
              </div>

              <button
                onClick={generateSchedule}
                className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold hover:bg-emerald-500"
              >
                Generate Round-Robin
              </button>
            </section>
          </aside>

          <section>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  Matches
                </h2>

                <p className="text-sm text-slate-400">
                  {matches.length} scheduled matches
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {matches.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-500">
                  No matches yet. Add teams and generate the
                  round-robin schedule.
                </div>
              )}

              {matches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-400">
                      Round {match.round_number}
                    </span>

                    <select
                      value={match.status}
                      onChange={(e) =>
                        updateMatch(match.id, {
                          status: e.target.value,
                        })
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    >
                      <option value="SCHEDULED">
                        Scheduled
                      </option>
                      <option value="LIVE">Live</option>
                      <option value="FINISHED">
                        Finished
                      </option>
                    </select>
                  </div>

                  <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
                    <div className="text-right font-semibold">
                      {teamNameById(match.home_team_id)}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={match.home_score}
                        onChange={(e) =>
                          updateMatch(match.id, {
                            home_score:
                              Number(e.target.value) || 0,
                          })
                        }
                        className="w-16 rounded-lg border border-slate-700 bg-slate-950 p-3 text-center text-xl font-bold"
                      />

                      <span className="text-slate-500">
                        -
                      </span>

                      <input
                        type="number"
                        min="0"
                        value={match.away_score}
                        onChange={(e) =>
                          updateMatch(match.id, {
                            away_score:
                              Number(e.target.value) || 0,
                          })
                        }
                        className="w-16 rounded-lg border border-slate-700 bg-slate-950 p-3 text-center text-xl font-bold"
                      />
                    </div>

                    <div className="font-semibold">
                      {teamNameById(match.away_team_id)}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Pitch / location"
                      value={match.location ?? ""}
                      onChange={(e) =>
                        updateMatch(match.id, {
                          location: e.target.value,
                        })
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />

                    <input
                      type="text"
                      placeholder="Referee"
                      value={match.referee_name ?? ""}
                      onChange={(e) =>
                        updateMatch(match.id, {
                          referee_name: e.target.value,
                        })
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />

                    <input
                      type="datetime-local"
                      value={
                        match.scheduled_at
                          ? new Date(match.scheduled_at)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        updateMatch(match.id, {
                          scheduled_at: e.target.value
                            ? new Date(
                                e.target.value
                              ).toISOString()
                            : null,
                        })
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
