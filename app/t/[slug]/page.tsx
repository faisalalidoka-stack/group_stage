import { supabase } from "@/lib/supabase";

type Team = {
  id: string;
  name: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
};

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("public_slug", slug)
    .single();

  if (!tournament) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <h1 className="text-3xl font-bold">
          Tournament not found
        </h1>
      </main>
    );
  }

  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("tournament_id", tournament.id)
    .order("points", { ascending: false })
    .order("goal_diff", { ascending: false })
    .order("goals_for", { ascending: false });

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournament.id)
    .order("round_number")
    .order("scheduled_at");

  const { data: goals } = await supabase
    .from("goals")
    .select(
      `
      id,
      minute,
      player_id,
      players (
        id,
        name,
        team_id,
        teams (
          name
        )
      )
    `
    )
    .in(
      "match_id",
      (matches ?? []).map((match) => match.id)
    );

  const { data: gallery } = await supabase
    .from("gallery_images")
    .select("*")
    .eq("tournament_id", tournament.id)
    .order("created_at", { ascending: false });

  const teamMap = new Map(
    (teams ?? []).map((team) => [team.id, team])
  );

  const playerGoals = new Map<
    string,
    {
      name: string;
      team: string;
      goals: number;
    }
  >();

  for (const goal of goals ?? []) {
    const player = goal.players as any;

    if (!player) continue;

    const existing = playerGoals.get(goal.player_id);

    playerGoals.set(goal.player_id, {
      name: player.name,
      team: player.teams?.name ?? "Unknown",
      goals: (existing?.goals ?? 0) + 1,
    });
  }

  const mvpRankings = [...playerGoals.values()].sort(
    (a, b) => b.goals - a.goals
  );

  function teamName(id: string) {
    return teamMap.get(id)?.name ?? "Unknown";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
            Tournament
          </p>

          <h1 className="mt-2 text-4xl font-bold md:text-5xl">
            {tournament.name}
          </h1>

          <p className="mt-3 text-slate-400">
            Round-robin competition
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.7fr_1fr]">
          <section className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 p-5">
              <h2 className="text-2xl font-bold">
                Standings
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-3 py-3">P</th>
                    <th className="px-3 py-3">W</th>
                    <th className="px-3 py-3">D</th>
                    <th className="px-3 py-3">L</th>
                    <th className="px-3 py-3">GD</th>
                    <th className="px-3 py-3">Pts</th>
                  </tr>
                </thead>

                <tbody>
                  {(teams as Team[] | null)?.map(
                    (team, index) => (
                      <tr
                        key={team.id}
                        className="border-t border-slate-800"
                      >
                        <td className="px-4 py-4 text-slate-500">
                          {index + 1}
                        </td>

                        <td className="px-4 py-4 font-semibold">
                          {team.name}
                        </td>

                        <td className="px-3 py-4">
                          {team.played}
                        </td>

                        <td className="px-3 py-4">
                          {team.won}
                        </td>

                        <td className="px-3 py-4">
                          {team.drawn}
                        </td>

                        <td className="px-3 py-4">
                          {team.lost}
                        </td>

                        <td className="px-3 py-4">
                          {team.goal_diff}
                        </td>

                        <td className="px-3 py-4 font-bold">
                          {team.points}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-2xl font-bold">
              Top Scorers
            </h2>

            <div className="mt-5 space-y-3">
              {mvpRankings.length === 0 && (
                <p className="text-slate-500">
                  No goals recorded yet.
                </p>
              )}

              {mvpRankings.slice(0, 10).map((player, index) => (
                <div
                  key={`${player.name}-${index}`}
                  className="flex items-center justify-between rounded-lg bg-slate-950 p-4"
                >
                  <div>
                    <p className="font-semibold">
                      {index + 1}. {player.name}
                    </p>

                    <p className="text-sm text-slate-500">
                      {player.team}
                    </p>
                  </div>

                  <span className="font-bold text-blue-400">
                    {player.goals}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-8">
          <h2 className="mb-5 text-2xl font-bold">
            Matches
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {(matches ?? []).map((match) => (
              <div
                key={match.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="mb-4 flex items-center justify-between text-sm">
                  <span className="text-blue-400">
                    Round {match.round_number}
                  </span>

                  <span className="text-slate-500">
                    {match.status}
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <span className="text-right font-semibold">
                    {teamName(match.home_team_id)}
                  </span>

                  <span className="text-xl font-bold">
                    {match.home_score} -{" "}
                    {match.away_score}
                  </span>

                  <span className="font-semibold">
                    {teamName(match.away_team_id)}
                  </span>
                </div>

                {(match.location ||
                  match.referee_name) && (
                  <div className="mt-4 border-t border-slate-800 pt-4 text-sm text-slate-500">
                    {match.location && (
                      <p>📍 {match.location}</p>
                    )}

                    {match.referee_name && (
                      <p className="mt-1">
                        Referee: {match.referee_name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">
            Photo Gallery
          </h2>

          {(!gallery || gallery.length === 0) && (
            <p className="mt-4 text-slate-500">
              No photos have been added yet.
            </p>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {gallery?.map((image) => (
              <figure
                key={image.id}
                className="overflow-hidden rounded-lg bg-slate-950"
              >
                <img
                  src={image.image_url}
                  alt={image.caption ?? "Tournament photo"}
                  className="aspect-square w-full object-cover"
                />

                {image.caption && (
                  <figcaption className="p-3 text-sm text-slate-400">
                    {image.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}