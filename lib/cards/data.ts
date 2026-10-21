import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase-server";
import { getServerSiteUrl } from "@/lib/site";
import {
  buildSide,
  kitFor,
  readableTextOn,
  separateKits,
  type Kit,
  type LineupPlayerRow,
  type LineupRow,
} from "@/lib/lineups";
import type {
  CardTeam,
  LineupCardData,
  MatchCardData,
  TournamentCardData,
} from "@/lib/cards/types";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,100}$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSlug = (value: string) => SLUG_PATTERN.test(value);
export const isUuid = (value: string) => UUID_PATTERN.test(value);

// Used when a team has not chosen kit colours, so cards are never all-white.
const PALETTE: [string, string][] = [
  ["#ef4444", "#ffffff"],
  ["#3b82f6", "#ffffff"],
  ["#f59e0b", "#1c1917"],
  ["#8b5cf6", "#ffffff"],
  ["#14b8a6", "#042f2e"],
  ["#ec4899", "#ffffff"],
  ["#84cc16", "#1a2e05"],
  ["#f97316", "#ffffff"],
];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function paletteKit(id: string): Kit {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;

  const [primary, secondary] = PALETTE[hash % PALETTE.length];

  return { primary, secondary, text: readableTextOn(primary) };
}

export function cardKit(team: Row): Kit {
  return team.primary_color
    ? kitFor(team, "home")
    : paletteKit(String(team.id));
}

/** Only embeds PNG/JPEG images hosted on our own Supabase project. */
export async function fetchImageDataUri(
  url: string | null | undefined
): Promise<string | null> {
  if (!url) return null;

  try {
    const supabaseHost = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    ).host;
    const target = new URL(url);

    if (target.host !== supabaseHost) return null;

    const response = await fetch(target, {
      signal: AbortSignal.timeout(3500),
    });

    if (!response.ok) return null;

    const bytes = Buffer.from(await response.arrayBuffer());

    if (bytes.length === 0 || bytes.length > 700_000) return null;

    const isPng =
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e;
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

    if (!isPng && !isJpeg) return null;

    return `data:${isPng ? "image/png" : "image/jpeg"};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

const TIMEZONE = process.env.TOURNAMENT_TIMEZONE || "Africa/Kampala";

export function formatKickoff(iso: string | null): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return null;

  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .toUpperCase();

  return `${day} · ${time}`;
}

export function formatDateRange(
  starts: string | null,
  ends: string | null
): string | null {
  const fmt = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${value}T00:00:00Z`));

  if (starts && ends && starts !== ends) return `${fmt(starts)} – ${fmt(ends)}`;
  if (starts) return fmt(starts);
  if (ends) return fmt(ends);

  return null;
}

export function stageLabel(stage: string, round: number | null) {
  if (stage === "SEMI_FINAL") return "Semi-final";
  if (stage === "THIRD_PLACE") return "Third place";
  if (stage === "FINAL") return "Final";

  return round ? `Round ${round}` : "Group stage";
}

const fileSafe = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "card";

async function loadTournamentBySlug(slug: string): Promise<Row | null> {
  if (!isSlug(slug)) return null;

  const { data, error } = await createServerSupabase()
    .from("tournaments")
    .select("*")
    .eq("public_slug", slug)
    .limit(1);

  return error || !data || data.length === 0 ? null : (data[0] as Row);
}

async function toCardTeam(team: Row): Promise<CardTeam> {
  return {
    id: team.id,
    name: team.name,
    logo: await fetchImageDataUri(team.logo_url),
    kit: cardKit(team),
  };
}

/** Light summary for link-preview metadata. */
export async function getTournamentSummary(slug: string) {
  const tournament = await loadTournamentBySlug(slug);

  if (!tournament) return null;

  const supabase = createServerSupabase();

  const [teams, matches] = await Promise.all([
    supabase.from("teams").select("id").eq("tournament_id", tournament.id),
    supabase
      .from("matches")
      .select("id, status")
      .eq("tournament_id", tournament.id),
  ]);

  const matchRows = (matches.data ?? []) as Row[];

  return {
    name: tournament.name as string,
    venue: (tournament.venue as string | null) ?? null,
    teamCount: (teams.data ?? []).length,
    matchCount: matchRows.length,
    finishedCount: matchRows.filter((m) => m.status === "FINISHED").length,
  };
}

export async function getTournamentCardData(
  slug: string
): Promise<TournamentCardData | null> {
  const tournament = await loadTournamentBySlug(slug);

  if (!tournament) return null;

  const supabase = createServerSupabase();

  const [teamsResult, matchesResult, logo] = await Promise.all([
    supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("name"),
    supabase
      .from("matches")
      .select("id, status")
      .eq("tournament_id", tournament.id),
    fetchImageDataUri(tournament.logo_url),
  ]);

  const teamRows = (teamsResult.data ?? []) as Row[];
  const matchRows = (matchesResult.data ?? []) as Row[];

  return {
    slug,
    name: tournament.name,
    logo,
    venue: tournament.venue ?? null,
    dates: formatDateRange(tournament.starts_on ?? null, tournament.ends_on ?? null),
    teamCount: teamRows.length,
    matchCount: matchRows.length,
    finishedCount: matchRows.filter((m) => m.status === "FINISHED").length,
    teams: await Promise.all(teamRows.slice(0, 16).map(toCardTeam)),
    host: new URL(getServerSiteUrl()).host,
    fileName: fileSafe(tournament.name),
  };
}

async function loadMatchContext(matchId: string) {
  if (!isUuid(matchId)) return null;

  const supabase = createServerSupabase();

  const matchResult = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .limit(1);

  const match = (matchResult.data?.[0] ?? null) as Row | null;

  if (!match) return null;

  const [tournamentResult, teamsResult] = await Promise.all([
    supabase
      .from("tournaments")
      .select("*")
      .eq("id", match.tournament_id)
      .limit(1),
    supabase
      .from("teams")
      .select("*")
      .in("id", [match.home_team_id, match.away_team_id]),
  ]);

  const tournament = (tournamentResult.data?.[0] ?? null) as Row | null;
  const teams = (teamsResult.data ?? []) as Row[];
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);

  if (!tournament || !home || !away) return null;

  return { match, tournament, home, away };
}

export async function getMatchCardData(
  matchId: string
): Promise<MatchCardData | null> {
  const context = await loadMatchContext(matchId);

  if (!context) return null;

  const { match, tournament, home, away } = context;

  const [homeTeam, awayTeam] = await Promise.all([
    toCardTeam(home),
    toCardTeam(away),
  ]);

  awayTeam.kit = separateKits(homeTeam.kit, awayTeam.kit);

  return {
    slug: tournament.public_slug,
    matchId,
    tournamentName: tournament.name,
    stageLabel: stageLabel(match.stage, match.round_number),
    status: match.status,
    home: homeTeam,
    away: awayTeam,
    homeScore: match.home_score ?? 0,
    awayScore: match.away_score ?? 0,
    kickoff: formatKickoff(match.scheduled_at),
    location: match.location ?? null,
    host: new URL(getServerSiteUrl()).host,
    fileName: `${fileSafe(home.name)}-vs-${fileSafe(away.name)}`,
  };
}

/** Published lineups for a match, as ready-to-draw sides. */
async function loadPublishedSides(context: NonNullable<Awaited<ReturnType<typeof loadMatchContext>>>) {
  const { match, home, away } = context;
  const supabase = createServerSupabase();

  const lineupsResult = await supabase
    .from("lineups")
    .select("*")
    .eq("match_id", match.id)
    .eq("status", "PUBLISHED");

  // Before phase4.sql there is no lineups table: that simply means "none".
  if (lineupsResult.error || !lineupsResult.data?.length) {
    return { home: null, away: null };
  }

  const lineups = lineupsResult.data as LineupRow[];

  const [rowsResult, playersResult] = await Promise.all([
    supabase
      .from("lineup_players")
      .select("*")
      .in(
        "lineup_id",
        lineups.map((l) => l.id)
      ),
    supabase
      .from("players")
      .select("id, name, number, team_id")
      .in("team_id", [home.id, away.id]),
  ]);

  const rows = (rowsResult.data ?? []) as LineupPlayerRow[];
  const players = (playersResult.data ?? []) as Row[];

  const sideFor = (team: Row, which: "home" | "away") => {
    const lineup = lineups.find((l) => l.team_id === team.id);

    return lineup
      ? buildSide(
          {
            id: team.id,
            name: team.name,
            primary_color: team.primary_color,
            secondary_color: team.secondary_color,
          },
          lineup,
          rows,
          players as { id: string; name: string; number: number | null }[],
          which
        )
      : null;
  };

  return { home: sideFor(home, "home"), away: sideFor(away, "away") };
}

export async function getLineupCardData(
  matchId: string
): Promise<LineupCardData | null> {
  const context = await loadMatchContext(matchId);

  if (!context) return null;

  const sides = await loadPublishedSides(context);

  if (!sides.home && !sides.away) return null;

  const { match, tournament, home, away } = context;

  return {
    slug: tournament.public_slug,
    matchId,
    tournamentName: tournament.name,
    stageLabel: stageLabel(match.stage, match.round_number),
    homeName: home.name,
    awayName: away.name,
    home: sides.home,
    away: sides.away,
    host: new URL(getServerSiteUrl()).host,
    fileName: `${fileSafe(home.name)}-vs-${fileSafe(away.name)}-lineups`,
  };
}

/** Everything the public match page needs, in one place. */
export const getMatchPageData = cache(async function getMatchPageData(
  slug: string,
  matchId: string
) {
  const context = await loadMatchContext(matchId);

  if (!context || context.tournament.public_slug !== slug) return null;

  const supabase = createServerSupabase();

  const [sides, goalsResult, playersResult] = await Promise.all([
    loadPublishedSides(context),
    supabase.from("goals").select("*").eq("match_id", matchId),
    supabase
      .from("players")
      .select("id, name, number, team_id")
      .in("team_id", [context.home.id, context.away.id]),
  ]);

  return {
    ...context,
    sides,
    goals: ((goalsResult.data ?? []) as Row[]).sort(
      (a, b) => (a.minute ?? 0) - (b.minute ?? 0)
    ),
    players: (playersResult.data ?? []) as Row[],
  };
});
