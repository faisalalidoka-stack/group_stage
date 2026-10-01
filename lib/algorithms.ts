export type RoundRobinTeam = {
  id: string;
  name: string;
};

export type ScheduledMatch = {
  home_team_id: string;
  away_team_id: string;
  round_number: number;
};

export function generateRoundRobinSchedule(
  teams: RoundRobinTeam[]
): ScheduledMatch[] {
  if (teams.length < 2) {
    return [];
  }

  const teamList = [...teams];

  // Round-robin scheduling works with an even number of teams.
  if (teamList.length % 2 !== 0) {
    teamList.push({
      id: "BYE",
      name: "BYE",
    });
  }

  const totalTeams = teamList.length;
  const rounds = totalTeams - 1;
  const matchesPerRound = totalTeams / 2;

  const schedule: ScheduledMatch[] = [];

  let rotation = [...teamList];

  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const home = rotation[i];
      const away = rotation[totalTeams - 1 - i];

      if (home.id !== "BYE" && away.id !== "BYE") {
        schedule.push({
          home_team_id: home.id,
          away_team_id: away.id,
          round_number: round,
        });
      }
    }

    // Keep first team fixed and rotate the remaining teams.
    const fixed = rotation[0];
    const rotating = rotation.slice(1);

    rotating.unshift(rotating.pop()!);

    rotation = [fixed, ...rotating];
  }

  return schedule;
}