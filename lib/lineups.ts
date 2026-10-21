import type { Role } from "@/lib/formations";

export type LineupStatus = "DRAFT" | "PUBLISHED";

export type LineupRow = {
  id: string;
  tournament_id: string;
  match_id: string;
  team_id: string;
  formation: string;
  status: LineupStatus;
  published_at: string | null;
  updated_at: string;
};

export type LineupPlayerRow = {
  id: string;
  lineup_id: string;
  player_id: string;
  role: "STARTER" | "SUB";
  slot: number | null;
  position: Role | null;
  sort_order: number;
};

export type Kit = {
  primary: string;
  secondary: string;
  /** Colour for the shirt number so it is always readable. */
  text: string;
};

export type SidePlayer = {
  playerId: string;
  name: string;
  number: number | null;
};

export type LineupSide = {
  teamId: string;
  teamName: string;
  formation: string;
  kit: Kit;
  starters: (SidePlayer & { slot: number; role: Role })[];
  subs: SidePlayer[];
};

export const GOALKEEPER_KIT: Kit = {
  primary: "#f59e0b",
  secondary: "#78350f",
  text: "#1c1917",
};

const HOME_FALLBACK = { primary: "#ffffff", secondary: "#0f172a" };
const AWAY_FALLBACK = { primary: "#0f172a", secondary: "#ffffff" };

function isHex(value: string | null | undefined): value is string {
  return !!value && /^#[0-9a-fA-F]{6}$/.test(value);
}

function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function readableTextOn(hex: string) {
  const [r, g, b] = toRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.6 ? "#0f172a" : "#ffffff";
}

function distance(a: string, b: string) {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);

  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

export function kitFor(
  team: { primary_color?: string | null; secondary_color?: string | null } | undefined,
  side: "home" | "away"
): Kit {
  const fallback = side === "home" ? HOME_FALLBACK : AWAY_FALLBACK;

  const primary = isHex(team?.primary_color)
    ? team.primary_color
    : fallback.primary;

  const secondary = isHex(team?.secondary_color)
    ? team.secondary_color
    : fallback.secondary;

  return { primary, secondary, text: readableTextOn(primary) };
}

/** If both teams wear nearly the same colour, the away side switches kit. */
export function separateKits(home: Kit, away: Kit): Kit {
  if (distance(home.primary, away.primary) >= 90) return away;

  const alternative =
    distance(home.primary, away.secondary) >= 90
      ? away.secondary
      : home.primary === "#0f172a"
        ? "#ffffff"
        : "#0f172a";

  return {
    primary: alternative,
    secondary: away.primary,
    text: readableTextOn(alternative),
  };
}

export function shortName(name: string, max: number) {
  const trimmed = name.trim();

  if (trimmed.length <= max) return trimmed;

  const parts = trimmed.split(/\s+/);

  if (parts.length > 1) {
    const surname = parts[parts.length - 1];
    const initial = `${parts[0][0]}. ${surname}`;

    if (initial.length <= max) return initial;
    if (surname.length <= max) return surname;
  }

  return `${trimmed.slice(0, max - 1)}…`;
}

type PlayerLite = { id: string; name: string; number: number | null };

export function buildSide(
  team: {
    id: string;
    name: string;
    primary_color?: string | null;
    secondary_color?: string | null;
  },
  lineup: LineupRow,
  rows: LineupPlayerRow[],
  players: PlayerLite[],
  side: "home" | "away"
): LineupSide {
  const byId = new Map(players.map((p) => [p.id, p]));

  const mine = rows.filter((row) => row.lineup_id === lineup.id);

  const toPlayer = (row: LineupPlayerRow): SidePlayer | null => {
    const player = byId.get(row.player_id);

    return player
      ? { playerId: player.id, name: player.name, number: player.number }
      : null;
  };

  const starters: LineupSide["starters"] = [];

  for (const row of mine.filter((r) => r.role === "STARTER")) {
    const player = toPlayer(row);

    if (player && row.slot !== null && row.position) {
      starters.push({ ...player, slot: row.slot, role: row.position });
    }
  }

  const subs = mine
    .filter((r) => r.role === "SUB")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(toPlayer)
    .filter((p): p is SidePlayer => p !== null);

  return {
    teamId: team.id,
    teamName: team.name,
    formation: lineup.formation,
    kit: kitFor(team, side),
    starters: starters.sort((a, b) => a.slot - b.slot),
    subs,
  };
}
