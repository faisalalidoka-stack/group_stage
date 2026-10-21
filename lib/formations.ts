export type MatchSize = 5 | 7 | 11;
export type Role = "GK" | "DEF" | "MID" | "FWD";

export const MATCH_SIZES: MatchSize[] = [5, 7, 11];
export const MAX_SUBS = 7;

export const FORMATIONS: Record<MatchSize, string[]> = {
  5: ["2-2", "1-2-1", "2-1-1", "1-1-2"],
  7: ["2-3-1", "3-2-1", "2-2-2", "3-1-2", "1-3-2"],
  11: [
    "4-4-2",
    "4-3-3",
    "4-2-3-1",
    "3-5-2",
    "3-4-3",
    "5-3-2",
    "4-1-4-1",
    "4-5-1",
  ],
};

export const DEFAULT_FORMATION: Record<MatchSize, string> = {
  5: "2-2",
  7: "2-3-1",
  11: "4-4-2",
};

export function toMatchSize(value: unknown): MatchSize {
  return value === 5 || value === 7 || value === 11 ? value : 11;
}

export const ROLES: Role[] = ["GK", "DEF", "MID", "FWD"];

export const ROLE_LABEL: Record<Role, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export type Slot = {
  index: number;
  role: Role;
  /** 0-100 across the pitch, left to right. */
  x: number;
  /** 0-100 along the pitch. 90 = own goal line (bottom), 0 = opposition goal. */
  y: number;
};

/** Slot 0 is the goalkeeper; the rest run defence to attack, left to right. */
export function buildSlots(formation: string): Slot[] {
  const rows = formation.split("-").map(Number);
  const slots: Slot[] = [{ index: 0, role: "GK", x: 50, y: 90 }];

  const attackY = 10;
  const defenceY = 68;

  let index = 1;

  rows.forEach((count, row) => {
    const y =
      rows.length === 1
        ? 42
        : defenceY - (row * (defenceY - attackY)) / (rows.length - 1);

    const role: Role =
      row === 0 ? "DEF" : row === rows.length - 1 ? "FWD" : "MID";

    for (let i = 0; i < count; i++) {
      slots.push({
        index: index++,
        role,
        x: ((i + 1) / (count + 1)) * 100,
        y,
      });
    }
  });

  return slots;
}

/**
 * Moves the starters into a new formation, keeping each player in the same
 * line (defence/midfield/attack) where possible.
 */
export function remapStarters(
  oldFormation: string,
  newFormation: string,
  assignments: Record<number, string>
): Record<number, string> {
  const oldSlots = buildSlots(oldFormation);
  const newSlots = buildSlots(newFormation);

  const byRole: Record<Role, string[]> = {
    GK: [],
    DEF: [],
    MID: [],
    FWD: [],
  };

  for (const slot of oldSlots) {
    const playerId = assignments[slot.index];
    if (playerId) byRole[slot.role].push(playerId);
  }

  const result: Record<number, string> = {};
  const leftover: string[] = [];

  for (const role of ROLES) {
    const targets = newSlots.filter((slot) => slot.role === role);
    const ids = byRole[role];

    targets.forEach((slot, i) => {
      if (ids[i]) result[slot.index] = ids[i];
    });

    leftover.push(...ids.slice(targets.length));
  }

  for (const slot of newSlots) {
    if (!result[slot.index] && leftover.length > 0) {
      result[slot.index] = leftover.shift() as string;
    }
  }

  return result;
}

export type Candidate = {
  id: string;
  number: number | null;
  preferred: Role | null;
};

/** Fills empty slots, preferring each player's preferred position. */
export function autoFill(
  formation: string,
  assignments: Record<number, string>,
  candidates: Candidate[]
): Record<number, string> {
  const slots = buildSlots(formation);
  const result = { ...assignments };
  const used = new Set(Object.values(result));

  const pool = [...candidates]
    .filter((c) => !used.has(c.id))
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999));

  const take = (match: (c: Candidate) => boolean) => {
    const index = pool.findIndex(match);
    return index >= 0 ? pool.splice(index, 1)[0] : undefined;
  };

  for (const slot of slots) {
    if (result[slot.index]) continue;

    const pick = take((c) => c.preferred === slot.role);
    if (pick) result[slot.index] = pick.id;
  }

  for (const slot of slots) {
    if (result[slot.index]) continue;

    // Never put an outfield player in goal automatically unless nobody else is left.
    const pick =
      slot.role === "GK"
        ? take((c) => c.preferred === null)
        : take((c) => c.preferred !== "GK") ?? take(() => true);

    if (pick) result[slot.index] = pick.id;
  }

  return result;
}
