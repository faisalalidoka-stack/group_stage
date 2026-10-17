export type TournamentFormat =
  | "ROUND_ROBIN"
  | "SINGLE_ELIMINATION";

export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED";

export type MatchStage =
  | "GROUP"
  | "SEMI_FINAL"
  | "THIRD_PLACE"
  | "FINAL";

export interface Tournament {
  id: string;
  adminId: string;
  name: string;
  format: TournamentFormat;
  publicSlug: string;
  createdAt: string;
}

export interface Team {
  id: string;
  tournamentId: string;
  name: string;
  logoUrl: string | null;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  number: number | null;
}

export interface Match {
  id: string;
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  stage: MatchStage;
  roundNumber: number;
  scheduledAt: string | null;
  location: string | null;
  refereeName: string | null;
  mvpPlayerId: string | null;
  homeTeam?: Team;
  awayTeam?: Team;
}

export interface Goal {
  id: string;
  matchId: string;
  playerId: string;
  minute: number;
}

export interface GalleryImage {
  id: string;
  tournamentId: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
}