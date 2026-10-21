"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { MATCH_SIZES, type MatchSize } from "@/lib/formations";
import {
  buildSide,
  type LineupPlayerRow,
  type LineupRow,
} from "@/lib/lineups";
import { describeDbError, type Player, type Team } from "@/lib/squad";
import LineupEditor from "./LineupEditor";
import LineupView from "./LineupView";

type StudioMatch = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  round_number: number;
  status: string;
};

type Props = {
  tournamentId: string;
  matchSize: MatchSize;
  teams: Team[];
  players: Player[];
  matches: StudioMatch[];
  onMatchSizeChange: (size: MatchSize) => void;
};

export default function LineupStudio({
  tournamentId,
  matchSize,
  teams,
  players,
  matches,
  onMatchSizeChange,
}: Props) {
  const [lineups, setLineups] = useState<LineupRow[]>([]);
  const [lineupPlayers, setLineupPlayers] = useState<LineupPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [side, setSide] = useState<"home" | "away">("home");
  const [showPreview, setShowPreview] = useState(false);

  const [sizeBusy, setSizeBusy] = useState(false);
  const [sizeError, setSizeError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const lineupsResult = await supabase
        .from("lineups")
        .select("*")
        .eq("tournament_id", tournamentId);

      if (!active) return;

      if (lineupsResult.error) {
        setLoadError(
          describeDbError(
            lineupsResult.error,
            "Could not load lineups."
          )
        );
        setLoading(false);
        return;
      }

      const rows = (lineupsResult.data ?? []) as LineupRow[];

      let playerRows: LineupPlayerRow[] = [];

      if (rows.length > 0) {
        const playersResult = await supabase
          .from("lineup_players")
          .select("*")
          .in(
            "lineup_id",
            rows.map((row) => row.id)
          );

        if (!active) return;

        if (playersResult.error) {
          setLoadError(
            describeDbError(playersResult.error, "Could not load lineups.")
          );
          setLoading(false);
          return;
        }

        playerRows = (playersResult.data ?? []) as LineupPlayerRow[];
      }

      setLineups(rows);
      setLineupPlayers(playerRows);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [tournamentId]);

  const teamById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams]
  );

  const sortedMatches = useMemo(
    () =>
      [...matches].sort(
        (a, b) => a.round_number - b.round_number
      ),
    [matches]
  );

  const activeMatchId = sortedMatches.some((m) => m.id === selectedMatchId)
    ? selectedMatchId
    : (sortedMatches[0]?.id ?? "");

  const match = sortedMatches.find((m) => m.id === activeMatchId);

  const homeTeam = match ? teamById.get(match.home_team_id) : undefined;
  const awayTeam = match ? teamById.get(match.away_team_id) : undefined;

  const lineupFor = (matchId: string, teamId: string) =>
    lineups.find((l) => l.match_id === matchId && l.team_id === teamId) ??
    null;

  const statusDot = (matchId: string, teamId: string) => {
    const lineup = lineupFor(matchId, teamId);

    return lineup?.status === "PUBLISHED"
      ? "bg-emerald-400"
      : lineup
        ? "bg-amber-400"
        : "bg-white/15";
  };

  async function changeSize(size: MatchSize) {
    if (size === matchSize) return;

    setSizeError("");
    setSizeBusy(true);

    const { error } = await supabase.rpc("set_match_size", {
      p_tournament_id: tournamentId,
      p_size: size,
    });

    setSizeBusy(false);

    if (error) {
      setSizeError(describeDbError(error, "Could not change the format."));
      return;
    }

    onMatchSizeChange(size);
  }

  function handleSaved(lineup: LineupRow, rows: LineupPlayerRow[]) {
    setLineups((current) => [
      ...current.filter((l) => l.id !== lineup.id),
      lineup,
    ]);
    setLineupPlayers((current) => [
      ...current.filter((row) => row.lineup_id !== lineup.id),
      ...rows,
    ]);
  }

  function handleDeleted(lineupId: string) {
    setLineups((current) => current.filter((l) => l.id !== lineupId));
    setLineupPlayers((current) =>
      current.filter((row) => row.lineup_id !== lineupId)
    );
  }

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-3 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        Loading lineups...
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
        {loadError}
      </p>
    );
  }

  const editingTeam = side === "home" ? homeTeam : awayTeam;
  const opponent = side === "home" ? awayTeam : homeTeam;

  const previewSide = (team: Team | undefined, which: "home" | "away") => {
    if (!match || !team) return null;

    const lineup = lineupFor(match.id, team.id);

    return lineup
      ? buildSide(team, lineup, lineupPlayers, players, which)
      : null;
  };

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Lineup Studio</h2>
            <p className="mt-1 text-sm text-gray-500">
              Choose a match, pick a formation and place the players. Only
              published lineups appear on the public page.
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs text-gray-500">Match format</p>
            <div className="flex gap-1">
              {MATCH_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => changeSize(size)}
                  disabled={sizeBusy || lineups.length > 0}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed ${
                    size === matchSize
                      ? "border-emerald-400 bg-emerald-400/10 text-emerald-400"
                      : "border-white/10 text-gray-400 hover:text-white disabled:opacity-40"
                  }`}
                >
                  {size}-a-side
                </button>
              ))}
            </div>
          </div>
        </div>

        {lineups.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            The match format is locked because lineups already exist. Delete
            them first to change it.
          </p>
        )}

        {sizeError && (
          <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {sizeError}
          </p>
        )}
      </div>

      {sortedMatches.length === 0 || !match || !homeTeam || !awayTeam ? (
        <p className="rounded-xl bg-black/20 p-6 text-center text-sm text-gray-500">
          There are no fixtures to build lineups for yet.
        </p>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={activeMatchId}
              onChange={(e) => {
                setSelectedMatchId(e.target.value);
                setSide("home");
              }}
              className="min-w-[240px] rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400"
            >
              {sortedMatches.map((m) => (
                <option key={m.id} value={m.id}>
                  Round {m.round_number}:{" "}
                  {teamById.get(m.home_team_id)?.name ?? "?"} vs{" "}
                  {teamById.get(m.away_team_id)?.name ?? "?"}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowPreview((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/5"
            >
              {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPreview ? "Hide preview" : "Preview both teams"}
            </button>
          </div>

          <div className="mt-5 flex gap-1 border-b border-white/10">
            {(
              [
                ["home", homeTeam],
                ["away", awayTeam],
              ] as const
            ).map(([which, team]) => (
              <button
                key={which}
                onClick={() => setSide(which)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
                  side === which
                    ? "border-emerald-400 text-emerald-400"
                    : "border-transparent text-gray-500"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${statusDot(
                    match.id,
                    team.id
                  )}`}
                />
                {team.name}
                <span className="text-xs opacity-60">
                  {which === "home" ? "home" : "away"}
                </span>
              </button>
            ))}
          </div>

          <p className="mt-2 text-xs text-gray-600">
            Dot: green published, amber draft, grey not started.
          </p>

          {showPreview && (
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
              <LineupView
                homeName={homeTeam.name}
                awayName={awayTeam.name}
                home={previewSide(homeTeam, "home")}
                away={previewSide(awayTeam, "away")}
                theme="dark"
                note="Admin preview (drafts included)"
              />
            </div>
          )}

          {editingTeam && opponent && (
            <div className="mt-6">
              <LineupEditor
                key={`${match.id}-${editingTeam.id}-${matchSize}`}
                matchId={match.id}
                matchSize={matchSize}
                team={editingTeam}
                side={side}
                opponentName={opponent.name}
                players={players.filter((p) => p.team_id === editingTeam.id)}
                lineup={lineupFor(match.id, editingTeam.id)}
                lineupPlayers={lineupPlayers.filter(
                  (row) =>
                    row.lineup_id ===
                    lineupFor(match.id, editingTeam.id)?.id
                )}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
