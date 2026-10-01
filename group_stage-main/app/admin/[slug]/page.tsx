"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Loader2,
  MapPin,
  Pencil,
  Trophy,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type Team = {
  id: string;
  tournament_id: string;
  name: string;
  logo_url: string | null;
};

type Player = {
  id: string;
  team_id: string;
  name: string;
  number: number | null;
};

type Match = {
  id: string;
  tournament_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  stage: string;
  round_number: number;
  scheduled_at: string | null;
  location: string | null;
  referee_name: string | null;
  mvp_player_id: string | null;
};

type Goal = {
  id: string;
  match_id: string;
  player_id: string;
  minute: number;
};

type Tournament = {
  id: string;
  name: string;
  public_slug: string;
  format: string;
};

type MatchEditor = {
  match: Match;
  homeScore: number;
  awayScore: number;
  status: Match["status"];
  location: string;
  refereeName: string;
  scheduledAt: string;
  mvpPlayerId: string;
};

type GoalEditor = {
  playerId: string;
  minute: number;
};

export default function AdminPage() {
  const params = useParams();
  const router = useRouter();

  const slug = params.slug as string;

  const [tournament, setTournament] =
    useState<Tournament | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingMatch, setEditingMatch] =
    useState<MatchEditor | null>(null);

  const [editingGoals, setEditingGoals] = useState<GoalEditor[]>([]);

  const [activeTab, setActiveTab] = useState<
    "fixtures" | "teams"
  >("fixtures");

  const teamMap = useMemo(() => {
    return new Map(teams.map((team) => [team.id, team]));
  }, [teams]);

  const playerMap = useMemo(() => {
    return new Map(players.map((player) => [player.id, player]));
  }, [players]);

  const groupedMatches = useMemo(() => {
    const groups = new Map<number, Match[]>();

    for (const match of matches) {
      const current = groups.get(match.round_number) ?? [];
      current.push(match);
      groups.set(match.round_number, current);
    }

    return Array.from(groups.entries()).sort(
      ([a], [b]) => a - b
    );
  }, [matches]);

  const finishedMatches = matches.filter(
    (match) => match.status === "FINISHED"
  ).length;

  const liveMatches = matches.filter(
    (match) => match.status === "LIVE"
  ).length;

  useEffect(() => {
    loadDashboard();
  }, [slug]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  async function loadDashboard() {
    setLoading(true);
    clearMessages();

    try {
      const {
        data: tournamentData,
        error: tournamentError,
      } = await supabase
        .from("tournaments")
        .select("*")
        .eq("public_slug", slug)
        .single();

      if (tournamentError || !tournamentData) {
        throw new Error(
          tournamentError?.message ||
            "Tournament not found."
        );
      }

      setTournament(tournamentData);

      const [
        teamsResult,
        playersResult,
        matchesResult,
        goalsResult,
      ] = await Promise.all([
        supabase
          .from("teams")
          .select("*")
          .eq("tournament_id", tournamentData.id)
          .order("name"),

        supabase
          .from("players")
          .select("*")
          .order("team_id")
          .order("number"),

        supabase
          .from("matches")
          .select("*")
          .eq("tournament_id", tournamentData.id)
          .order("round_number")
          .order("scheduled_at"),

        supabase
          .from("goals")
          .select("*"),
      ]);

      if (teamsResult.error) {
        throw new Error(teamsResult.error.message);
      }

      if (playersResult.error) {
        throw new Error(playersResult.error.message);
      }

      if (matchesResult.error) {
        throw new Error(matchesResult.error.message);
      }

      if (goalsResult.error) {
        throw new Error(goalsResult.error.message);
      }

      setTeams(teamsResult.data ?? []);
      setPlayers(playersResult.data ?? []);
      setMatches(matchesResult.data ?? []);

      setGoals(
        (goalsResult.data ?? []).filter((goal) =>
          (matchesResult.data ?? []).some(
            (match) => match.id === goal.match_id
          )
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  function openMatchEditor(match: Match) {
    const matchGoals = goals.filter(
      (goal) => goal.match_id === match.id
    );

    setEditingMatch({
      match,
      homeScore: match.home_score,
      awayScore: match.away_score,
      status: match.status,
      location: match.location ?? "",
      refereeName: match.referee_name ?? "",
      scheduledAt: match.scheduled_at
        ? formatDateTimeLocal(match.scheduled_at)
        : "",
      mvpPlayerId: match.mvp_player_id ?? "",
    });

    setEditingGoals(
      matchGoals.map((goal) => ({
        playerId: goal.player_id,
        minute: goal.minute,
      }))
    );

    clearMessages();
  }

  function formatDateTimeLocal(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const offset = date.getTimezoneOffset();
    const localDate = new Date(
      date.getTime() - offset * 60 * 1000
    );

    return localDate.toISOString().slice(0, 16);
  }

  function addGoal() {
    setEditingGoals((current) => [
      ...current,
      {
        playerId: "",
        minute: 1,
      },
    ]);
  }

  function updateGoal(
    index: number,
    field: keyof GoalEditor,
    value: string | number
  ) {
    setEditingGoals((current) =>
      current.map((goal, i) =>
        i === index
          ? {
              ...goal,
              [field]:
                field === "minute"
                  ? Number(value)
                  : value,
            }
          : goal
      )
    );
  }

  function removeGoal(index: number) {
    setEditingGoals((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  function getMatchPlayers(match: Match) {
    const homePlayers = players.filter(
      (player) => player.team_id === match.home_team_id
    );

    const awayPlayers = players.filter(
      (player) => player.team_id === match.away_team_id
    );

    return [...homePlayers, ...awayPlayers];
  }

  async function saveMatch() {
    if (!editingMatch) return;

    clearMessages();
    setSaving(true);

    try {
      const match = editingMatch.match;

      const validGoals = editingGoals.filter(
        (goal) =>
          goal.playerId &&
          Number.isFinite(goal.minute) &&
          goal.minute >= 0 &&
          goal.minute <= 120
      );

      const matchPlayers = getMatchPlayers(match);

      const validPlayerIds = new Set(
        matchPlayers.map((player) => player.id)
      );

      const invalidGoal = validGoals.find(
        (goal) => !validPlayerIds.has(goal.playerId)
      );

      if (invalidGoal) {
        throw new Error(
          "Every goal scorer must belong to one of the teams in this match."
        );
      }

      if (
        editingMatch.mvpPlayerId &&
        !validPlayerIds.has(editingMatch.mvpPlayerId)
      ) {
        throw new Error(
          "MVP must belong to one of the teams in this match."
        );
      }

      const { error: matchError } = await supabase
        .from("matches")
        .update({
          home_score: editingMatch.homeScore,
          away_score: editingMatch.awayScore,
          status: editingMatch.status,
          location:
            editingMatch.location.trim() || null,
          referee_name:
            editingMatch.refereeName.trim() || null,
          scheduled_at:
            editingMatch.scheduledAt
              ? new Date(
                  editingMatch.scheduledAt
                ).toISOString()
              : null,
          mvp_player_id:
            editingMatch.mvpPlayerId || null,
        })
        .eq("id", match.id);

      if (matchError) {
        throw new Error(matchError.message);
      }

      const { error: deleteGoalsError } = await supabase
        .from("goals")
        .delete()
        .eq("match_id", match.id);

      if (deleteGoalsError) {
        throw new Error(deleteGoalsError.message);
      }

      if (validGoals.length > 0) {
        const goalPayload = validGoals.map((goal) => ({
          match_id: match.id,
          player_id: goal.playerId,
          minute: goal.minute,
        }));

        const { error: goalsError } = await supabase
          .from("goals")
          .insert(goalPayload);

        if (goalsError) {
          throw new Error(goalsError.message);
        }
      }

      await loadDashboard();

      setEditingMatch(null);
      setEditingGoals([]);

      setSuccess("Match updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save match."
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyPublicLink() {
    if (!tournament) return;

    const url = `${window.location.origin}/t/${tournament.public_slug}`;

    await navigator.clipboard.writeText(url);

    setSuccess("Public league link copied.");
  }

  function getTeamName(teamId: string) {
    return teamMap.get(teamId)?.name ?? "Unknown Team";
  }

  function getPlayerName(playerId: string) {
    return playerMap.get(playerId)?.name ?? "Unknown Player";
  }

  function formatMatchTime(value: string | null) {
    if (!value) return "Time not set";

    const date = new Date(value);

    return date.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function getStatusStyle(status: Match["status"]) {
    if (status === "LIVE") {
      return "bg-red-400/10 text-red-300 border-red-400/20";
    }

    if (status === "FINISHED") {
      return "bg-emerald-400/10 text-emerald-300 border-emerald-400/20";
    }

    return "bg-white/5 text-gray-400 border-white/10";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-white">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2
            size={22}
            className="animate-spin"
          />
          Loading tournament...
        </div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] px-4 text-white">
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-6 text-center">
          <p className="font-semibold">
            Tournament not found
          </p>

          {error && (
            <p className="mt-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-black">
                  <Trophy size={19} />
                </div>

                <span className="text-sm font-medium text-gray-500">
                  ADMIN DASHBOARD
                </span>
              </div>

              <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                {tournament.name}
              </h1>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyPublicLink}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5"
              >
                <Copy size={16} />
                Public Link
              </button>

              <button
                onClick={() =>
                  router.push(
                    `/admin/${tournament.public_slug}/manage`
                  )
                }
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5"
              >
                Manage Teams
              </button>

              <button
                onClick={() =>
                  router.push(
                    `/t/${tournament.public_slug}`
                  )
                }
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400"
              >
                View League
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">
              Total Fixtures
            </p>
            <p className="mt-2 text-2xl font-black">
              {matches.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">
              Completed
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-400">
              {finishedMatches}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">
              Live
            </p>
            <p className="mt-2 text-2xl font-black text-red-400">
              {liveMatches}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">
              Teams
            </p>
            <p className="mt-2 text-2xl font-black">
              {teams.length}
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
            <span>{success}</span>

            <button
              onClick={() => setSuccess("")}
              className="text-emerald-300/60 hover:text-emerald-300"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-8 flex gap-2 overflow-x-auto border-b border-white/10">
          <button
            onClick={() => setActiveTab("fixtures")}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${
              activeTab === "fixtures"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-gray-500"
            }`}
          >
            Fixtures & Scoring
          </button>

          <button
            onClick={() => setActiveTab("teams")}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${
              activeTab === "teams"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-gray-500"
            }`}
          >
            Teams & Players
          </button>
        </div>

        {activeTab === "fixtures" && (
          <section className="mt-6 space-y-8">
            {groupedMatches.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-gray-500">
                No fixtures found.
              </div>
            )}

            {groupedMatches.map(
              ([round, roundMatches]) => (
                <div key={round}>
                  <div className="mb-3 flex items-center gap-2">
                    <Calendar
                      size={18}
                      className="text-emerald-400"
                    />

                    <h2 className="text-lg font-bold">
                      Round {round}
                    </h2>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {roundMatches.map((match) => {
                      const homeTeam = teamMap.get(
                        match.home_team_id
                      );

                      const awayTeam = teamMap.get(
                        match.away_team_id
                      );

                      const matchGoals = goals.filter(
                        (goal) =>
                          goal.match_id === match.id
                      );

                      return (
                        <div
                          key={match.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                                match.status
                              )}`}
                            >
                              {match.status}
                            </span>

                            <span className="text-xs text-gray-500">
                              {match.stage}
                            </span>
                          </div>

                          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                            <div className="text-center">
                              <p className="font-bold">
                                {homeTeam?.name ??
                                  "Home Team"}
                              </p>
                            </div>

                            <div className="text-3xl font-black">
                              {match.home_score}
                              <span className="mx-2 text-gray-600">
                                -
                              </span>
                              {match.away_score}
                            </div>

                            <div className="text-center">
                              <p className="font-bold">
                                {awayTeam?.name ??
                                  "Away Team"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 space-y-2 text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                              <Clock size={14} />
                              {formatMatchTime(
                                match.scheduled_at
                              )}
                            </div>

                            {match.location && (
                              <div className="flex items-center gap-2">
                                <MapPin size={14} />
                                {match.location}
                              </div>
                            )}

                            {match.referee_name && (
                              <div className="flex items-center gap-2">
                                <UserCheck size={14} />
                                {match.referee_name}
                              </div>
                            )}
                          </div>

                          {matchGoals.length > 0 && (
                            <div className="mt-4 border-t border-white/10 pt-4">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Goals
                              </p>

                              <div className="space-y-1">
                                {matchGoals.map((goal) => (
                                  <div
                                    key={goal.id}
                                    className="text-sm text-gray-300"
                                  >
                                    {getPlayerName(
                                      goal.player_id
                                    )}{" "}
                                    <span className="text-gray-600">
                                      {goal.minute}&apos;
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {match.mvp_player_id && (
                            <div className="mt-4 flex items-center gap-2 rounded-lg bg-yellow-400/10 px-3 py-2 text-xs text-yellow-300">
                              <Trophy size={14} />
                              MVP:{" "}
                              {getPlayerName(
                                match.mvp_player_id
                              )}
                            </div>
                          )}

                          <button
                            onClick={() =>
                              openMatchEditor(match)
                            }
                            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold transition hover:bg-white/10"
                          >
                            <Pencil size={16} />
                            Manage Match
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </section>
        )}

        {activeTab === "teams" && (
          <section className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {teams.map((team) => {
                const teamPlayers = players.filter(
                  (player) =>
                    player.team_id === team.id
                );

                return (
                  <div
                    key={team.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                        <Users size={20} />
                      </div>

                      <div>
                        <h3 className="font-bold">
                          {team.name}
                        </h3>

                        <p className="text-xs text-gray-500">
                          {teamPlayers.length} player
                          {teamPlayers.length === 1
                            ? ""
                            : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2">
                      {teamPlayers.length === 0 ? (
                        <p className="rounded-lg bg-black/20 px-3 py-3 text-sm text-gray-600">
                          No players registered yet.
                        </p>
                      ) : (
                        teamPlayers.map((player) => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2"
                          >
                            <span className="text-sm">
                              {player.name}
                            </span>

                            {player.number !== null && (
                              <span className="text-xs text-gray-500">
                                #{player.number}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </section>

      {/* Match editor */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#0d1117] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Match management
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {getTeamName(
                    editingMatch.match.home_team_id
                  )}{" "}
                  vs{" "}
                  {getTeamName(
                    editingMatch.match.away_team_id
                  )}
                </h2>
              </div>

              <button
                onClick={() => setEditingMatch(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-xs text-gray-500">
                  Home score
                </label>

                <input
                  type="number"
                  min="0"
                  value={editingMatch.homeScore}
                  onChange={(e) =>
                    setEditingMatch((current) =>
                      current
                        ? {
                            ...current,
                            homeScore: Math.max(
                              0,
                              Number(e.target.value)
                            ),
                          }
                        : current
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-2xl font-black outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-gray-500">
                  Away score
                </label>

                <input
                  type="number"
                  min="0"
                  value={editingMatch.awayScore}
                  onChange={(e) =>
                    setEditingMatch((current) =>
                      current
                        ? {
                            ...current,
                            awayScore: Math.max(
                              0,
                              Number(e.target.value)
                            ),
                          }
                        : current
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-2xl font-black outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-xs text-gray-500">
                Match status
              </label>

              <select
                value={editingMatch.status}
                onChange={(e) =>
                  setEditingMatch((current) =>
                    current
                      ? {
                          ...current,
                          status:
                            e.target.value as Match["status"],
                        }
                      : current
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
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

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs text-gray-500">
                  Kickoff
                </label>

                <input
                  type="datetime-local"
                  value={editingMatch.scheduledAt}
                  onChange={(e) =>
                    setEditingMatch((current) =>
                      current
                        ? {
                            ...current,
                            scheduledAt:
                              e.target.value,
                          }
                        : current
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-gray-500">
                  Pitch / Location
                </label>

                <input
                  value={editingMatch.location}
                  onChange={(e) =>
                    setEditingMatch((current) =>
                      current
                        ? {
                            ...current,
                            location: e.target.value,
                          }
                        : current
                    )
                  }
                  placeholder="Main Grounds"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs text-gray-500">
                Referee
              </label>

              <input
                value={editingMatch.refereeName}
                onChange={(e) =>
                  setEditingMatch((current) =>
                    current
                      ? {
                          ...current,
                          refereeName: e.target.value,
                        }
                      : current
                  )
                }
                placeholder="Referee name"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>

            {/* Goals */}
            <div className="mt-7 border-t border-white/10 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold">
                    Goal scorers
                  </h3>

                  <p className="mt-1 text-xs text-gray-500">
                    Add the players who scored in this match.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addGoal}
                  className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-400/20"
                >
                  + Add goal
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {editingGoals.length === 0 && (
                  <p className="rounded-xl bg-black/20 px-4 py-3 text-sm text-gray-600">
                    No goals recorded.
                  </p>
                )}

                {editingGoals.map((goal, index) => (
                  <div
                    key={index}
                    className="flex gap-2"
                  >
                    <select
                      value={goal.playerId}
                      onChange={(e) =>
                        updateGoal(
                          index,
                          "playerId",
                          e.target.value
                        )
                      }
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400"
                    >
                      <option value="">
                        Select scorer
                      </option>

                      {getMatchPlayers(
                        editingMatch.match
                      ).map((player) => (
                        <option
                          key={player.id}
                          value={player.id}
                        >
                          {player.number !== null
                            ? `#${player.number} `
                            : ""}
                          {player.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={goal.minute}
                      onChange={(e) =>
                        updateGoal(
                          index,
                          "minute",
                          e.target.value
                        )
                      }
                      className="w-20 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400"
                      placeholder="Min"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removeGoal(index)
                      }
                      className="rounded-xl border border-white/10 px-3 text-gray-500 hover:border-red-400/30 hover:text-red-400"
                    >
                      <X size={17} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* MVP */}
            <div className="mt-7 border-t border-white/10 pt-6">
              <div className="flex items-center gap-2">
                <Trophy
                  size={17}
                  className="text-yellow-400"
                />

                <h3 className="font-bold">
                  Player of the Match
                </h3>
              </div>

              <select
                value={editingMatch.mvpPlayerId}
                onChange={(e) =>
                  setEditingMatch((current) =>
                    current
                      ? {
                          ...current,
                          mvpPlayerId:
                            e.target.value,
                        }
                      : current
                  )
                }
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              >
                <option value="">No MVP selected</option>

                {getMatchPlayers(
                  editingMatch.match
                ).map((player) => (
                  <option
                    key={player.id}
                    value={player.id}
                  >
                    {player.number !== null
                      ? `#${player.number} `
                      : ""}
                    {player.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-7 flex gap-3">
              <button
                onClick={() => setEditingMatch(null)}
                disabled={saving}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={saveMatch}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={17} />
                    Save Match
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}