export type TournamentInfo = {
  id: string;
  name: string;
  public_slug: string;
  admin_id: string;
};

export type Team = {
  id: string;
  tournament_id: string;
  name: string;
  logo_url: string | null;
};

export type Player = {
  id: string;
  team_id: string;
  name: string;
  number: number | null;
  photo_url: string | null;
};

export type Notice = { type: "error" | "success"; text: string } | null;

export const MIN_SHIRT = 0;
export const MAX_SHIRT = 99;

export function sortTeams(list: Team[]) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

export function sortPlayers(list: Player[]) {
  return [...list].sort((a, b) => {
    if (a.number === null && b.number === null) {
      return a.name.localeCompare(b.name);
    }
    if (a.number === null) return 1;
    if (b.number === null) return -1;
    return a.number - b.number;
  });
}

/** Empty string means "no number". Throws a readable error otherwise. */
export function parseShirt(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const number = Number(trimmed);

  if (
    !Number.isInteger(number) ||
    number < MIN_SHIRT ||
    number > MAX_SHIRT
  ) {
    throw new Error(
      `Shirt number must be a whole number from ${MIN_SHIRT} to ${MAX_SHIRT}.`
    );
  }

  return number;
}

export function describeDbError(
  error: { code?: string; message: string } | null | undefined,
  fallback: string
) {
  if (!error) return fallback;

  if (error.code === "23505") {
    return "That shirt number is already taken in this team.";
  }

  if (error.code === "23503") {
    return "This record is still referenced elsewhere (for example by a match), so it cannot be removed.";
  }

  return error.message || fallback;
}
