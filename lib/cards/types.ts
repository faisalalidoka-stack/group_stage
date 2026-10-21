import type { Kit, LineupSide } from "@/lib/lineups";

export type CardFormat = "og" | "story" | "square";

export const FORMATS: Record<CardFormat, { width: number; height: number }> = {
  og: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

export function parseFormat(value: string | null): CardFormat {
  return value === "story" || value === "square" ? value : "og";
}

export type CardTeam = {
  id: string;
  name: string;
  /** Embedded image (data URI) or null to fall back to a coloured disc. */
  logo: string | null;
  kit: Kit;
};

export type TournamentCardData = {
  slug: string;
  name: string;
  logo: string | null;
  venue: string | null;
  dates: string | null;
  teamCount: number;
  matchCount: number;
  finishedCount: number;
  teams: CardTeam[];
  host: string;
  fileName: string;
};

export type MatchCardData = {
  slug: string;
  matchId: string;
  tournamentName: string;
  stageLabel: string;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  home: CardTeam;
  away: CardTeam;
  homeScore: number;
  awayScore: number;
  kickoff: string | null;
  location: string | null;
  host: string;
  fileName: string;
};

export type LineupCardData = {
  slug: string;
  matchId: string;
  tournamentName: string;
  stageLabel: string;
  homeName: string;
  awayName: string;
  home: LineupSide | null;
  away: LineupSide | null;
  host: string;
  fileName: string;
};
