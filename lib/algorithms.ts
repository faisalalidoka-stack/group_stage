import { Match, Team } from "@/types";

export interface GeneratedMatch {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}

/**
 * Generates a standard single round-robin fixture list.
 *
 * Every team plays every other team once.
 * If there is an odd number of teams, a BYE is added internally.
 */
export function generateRoundRobinSchedule(
  teamIds: string[]
): GeneratedMatch[] {
  if (teamIds.length < 2) {
    return [];
  }

  const teams = [...teamIds];

  if (teams.length % 2 !== 0) {
    teams.push("BYE");
  }

  const totalTeams = teams.length;
  const totalRounds = totalTeams - 1;
  const matchesPerRound = totalTeams / 2;

  const fixtures: GeneratedMatch[] = [];

  let rotation = [...teams];

  for (let round = 1; round <= totalRounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const home = rotation[i];
      const away = rotation[totalTeams - 1 - i];

      if (home === "BYE" || away === "BYE") {
        continue;
      }

      fixtures.push({
        round,
        homeTeamId: home,
        awayTeamId: away,
      });
    }

    const fixed = rotation[0];
    const rotating = rotation.slice(1);

    const last = rotating.pop();

    if (last) {
      rotating.unshift(last);
    }

    rotation = [fixed, ...rotating];
  }

  return fixtures;
}

/**
 * Calculates league standings from finished matches.
 *
 * Sorting:
 * 1. Points
 * 2. Goal Difference
 * 3. Goals For
 */
export function calculateStandings(
  teams: Team[],
  matches: Match[]
): Team[] {
  const standings = teams.map((team) => ({
    ...team,
    points: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
  }));

  const teamMap = new Map(
    standings.map((team) => [team.id, team])
  );

  const completedMatches = matches.filter(
    (match) => match.status === "FINISHED"
  );

  for (const match of completedMatches) {
    const home = teamMap.get(match.homeTeamId);
    const away = teamMap.get(match.awayTeamId);

    if (!home || !away) {
      continue;
    }

    home.played += 1;
    away.played += 1;

    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;

    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.homeScore < match.awayScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;

      home.points += 1;
      away.points += 1;
    }
  }

  for (const team of standings) {
    team.goalDiff =
      team.goalsFor - team.goalsAgainst;
  }

  return standings.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (b.goalDiff !== a.goalDiff) {
      return b.goalDiff - a.goalDiff;
    }

    return b.goalsFor - a.goalsFor;
  });
}