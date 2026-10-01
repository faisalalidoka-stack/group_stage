"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  CalendarDays,
  Camera,
  ChevronDown,
  Clock3,
  MapPin,
  Trophy,
  Users,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { calculateStandings } from "@/lib/algorithms";

import type {
  GalleryImage,
  Goal,
  Match,
  MatchStatus,
  Player,
  Team,
  Tournament,
} from "@/types";

type TournamentRow = {
  id: string;
  admin_id: string;
  name: string;
  format: string;
  public_slug: string;
  created_at: string;
};

type TeamRow = {
  id: string;
  tournament_id: string;
  name: string;
  logo_url: string | null;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
};

type PlayerRow = {
  id: string;
  team_id: string;
  name: string;
  number: number | null;
};

type MatchRow = {
  id: string;
  tournament_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: MatchStatus;
  stage: Match["stage"];
  round_number: number;
  scheduled_at: string | null;
  location: string | null;
  referee_name: string | null;
  mvp_player_id: string | null;
};

type GoalRow = {
  id: string;
  match_id: string;
  player_id: string;
  minute: number;
};

type GalleryRow = {
  id: string;
  tournament_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
};

type LeaderboardEntry = {
  player: Player;
  team: Team | undefined;
  count: number;
};
type PublicMatch = Match & {
  homeTeam: Team;
  awayTeam: Team;
};



type Tab =
  | "standings"
  | "fixtures"
  | "leaders"
  | "gallery";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function mapTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    adminId: row.admin_id,
    name: row.name,
    format:
      row.format === "SINGLE_ELIMINATION"
        ? "SINGLE_ELIMINATION"
        : "ROUND_ROBIN",
    publicSlug: row.public_slug,
    createdAt: row.created_at,
  };
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    logoUrl: row.logo_url,
    points: row.points,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    goalDiff: row.goal_diff,
  };
}

function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    number: row.number,
  };
}

function mapMatch(
  row: MatchRow,
  teams: Team[]
): PublicMatch | null {
  const homeTeam = teams.find(
    (team) => team.id === row.home_team_id
  );

  const awayTeam = teams.find(
    (team) => team.id === row.away_team_id
  );

  if (!homeTeam || !awayTeam) {
    return null;
  }

  return {
    id: row.id,
    tournamentId: row.tournament_id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    stage: row.stage,
    roundNumber: row.round_number,
    scheduledAt: row.scheduled_at,
    location: row.location,
    refereeName: row.referee_name,
    mvpPlayerId: row.mvp_player_id,
    homeTeam,
    awayTeam,
  };
}

function mapGallery(row: GalleryRow): GalleryImage {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    imageUrl: row.image_url,
    caption: row.caption,
    createdAt: row.created_at,
  };
}

function formatDate(
  value: string | null
): string {
  if (!value) {
    return "TBC";
  }

  return new Intl.DateTimeFormat("en-UG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: MatchStatus): string {
  switch (status) {
    case "LIVE":
      return "LIVE";
    case "FINISHED":
      return "FT";
    default:
      return "Scheduled";
  }
}

function stageLabel(stage: Match["stage"]): string {
  switch (stage) {
    case "SEMI_FINAL":
      return "Semi-final";
    case "THIRD_PLACE":
      return "3rd Place";
    case "FINAL":
      return "Final";
    default:
      return "Group Stage";
  }
}

function TeamBadge({
  team,
}: {
  team: Team;
}) {
  if (team.logoUrl) {
    return (
      <img
        src={team.logoUrl}
        alt=""
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
      {team.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()}
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
          {icon}
        </div>

        <h2 className="text-xl font-bold text-slate-900">
          {title}
        </h2>
      </div>

      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-200" />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="h-96 animate-pulse rounded-2xl bg-white" />
          <div className="h-96 animate-pulse rounded-2xl bg-white lg:col-span-2" />
        </div>
      </div>
    </main>
  );
}

export default function PublicTournamentPage({
  params,
}: PageProps) {
  const [slug, setSlug] = useState<string | null>(null);

  const [tournament, setTournament] =
    useState<Tournament | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] =
    useState<Player[]>([]);
  const [matches, setMatches] =
    useState<PublicMatch[]>([]);
  const [goals, setGoals] =
    useState<Goal[]>([]);
  const [gallery, setGallery] =
    useState<GalleryImage[]>([]);

  const [activeTab, setActiveTab] =
    useState<Tab>("standings");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [selectedImage, setSelectedImage] =
    useState<GalleryImage | null>(null);

  useEffect(() => {
    let mounted = true;

    params.then(({ slug: routeSlug }) => {
      if (mounted) {
        setSlug(routeSlug);
      }
    });

    return () => {
      mounted = false;
    };
  }, [params]);

  useEffect(() => {
    if (!slug) {
      return;
    }

    let mounted = true;

    async function loadTournament() {
      setLoading(true);
      setError(null);

      const {
        data: tournamentRow,
        error: tournamentError,
      } = await supabase
        .from("tournaments")
        .select(
          "id, admin_id, name, format, public_slug, created_at"
        )
        .eq("public_slug", slug)
        .maybeSingle();

      if (tournamentError) {
        if (mounted) {
          setError(tournamentError.message);
          setLoading(false);
        }
        return;
      }

      if (!tournamentRow) {
        if (mounted) {
          setError("Tournament not found.");
          setLoading(false);
        }
        return;
      }

      const tournament = mapTournament(
        tournamentRow as TournamentRow
      );

      const [
        teamsResult,
        playersResult,
        matchesResult,
        galleryResult,
      ] = await Promise.all([
        supabase
          .from("teams")
          .select(
            "id, tournament_id, name, logo_url, points, played, won, drawn, lost, goals_for, goals_against, goal_diff"
          )
          .eq("tournament_id", tournament.id)
          .order("name"),

        supabase
          .from("players")
          .select(
            "id, team_id, name, number"
          )
          .order("name"),

        supabase
          .from("matches")
          .select(
            "id, tournament_id, home_team_id, away_team_id, home_score, away_score, status, stage, round_number, scheduled_at, location, referee_name, mvp_player_id"
          )
          .eq("tournament_id", tournament.id)
          .order("round_number")
          .order("scheduled_at", {
            ascending: true,
            nullsFirst: true,
          }),

        supabase
          .from("gallery_images")
          .select(
            "id, tournament_id, image_url, caption, created_at"
          )
          .eq("tournament_id", tournament.id)
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (
        teamsResult.error ||
        playersResult.error ||
        matchesResult.error ||
        galleryResult.error
      ) {
        if (mounted) {
          setError(
            teamsResult.error?.message ??
              playersResult.error?.message ??
              matchesResult.error?.message ??
              galleryResult.error?.message ??
              "Failed to load tournament data."
          );

          setLoading(false);
        }

        return;
      }

      const mappedTeams = (
        (teamsResult.data ?? []) as TeamRow[]
      ).map(mapTeam);

      const mappedPlayers = (
        (playersResult.data ?? []) as PlayerRow[]
      ).map(mapPlayer);

      const mappedMatches = (
        (matchesResult.data ?? []) as MatchRow[]
      )
        .map((row) =>
          mapMatch(row, mappedTeams)
        )
        .filter(
          (
            match
          ): match is PublicMatch =>
            match !== null
        );

      const matchIds = mappedMatches.map(
        (match) => match.id
      );

      let mappedGoals: Goal[] = [];

      if (matchIds.length > 0) {
        const { data: goalsData, error: goalsError } =
          await supabase
            .from("goals")
            .select(
              "id, match_id, player_id, minute"
            )
            .in("match_id", matchIds);

        if (goalsError) {
          if (mounted) {
            setError(goalsError.message);
            setLoading(false);
          }

          return;
        }

        mappedGoals = (
          (goalsData ?? []) as GoalRow[]
        ).map((row) => ({
          id: row.id,
          matchId: row.match_id,
          playerId: row.player_id,
          minute: row.minute,
        }));
      }

      if (!mounted) {
        return;
      }

      setTournament(tournament);
      setTeams(mappedTeams);
      setPlayers(mappedPlayers);
      setMatches(mappedMatches);
      setGoals(mappedGoals);
      setGallery(
        (
          (galleryResult.data ?? []) as GalleryRow[]
        ).map(mapGallery)
      );
      setLoading(false);
    }

    void loadTournament();

    const channel = supabase
      .channel(`public-tournament-${slug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        () => {
          void loadTournament();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goals",
        },
        () => {
          void loadTournament();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [slug]);

  const standings = useMemo(() => {
    return calculateStandings(
      teams,
      matches
    );
  }, [teams, matches]);

  const teamMap = useMemo(() => {
    return new Map(
      teams.map((team) => [
        team.id,
        team,
      ])
    );
  }, [teams]);

  const playerMap = useMemo(() => {
    return new Map(
      players.map((player) => [
        player.id,
        player,
      ])
    );
  }, [players]);

  const goalScorers = useMemo<LeaderboardEntry[]>(
    () => {
      const counts = new Map<
        string,
        number
      >();

      for (const goal of goals) {
        counts.set(
          goal.playerId,
          (counts.get(goal.playerId) ?? 0) + 1
        );
      }

      return Array.from(counts.entries())
        .map(([playerId, count]) => {
          const player =
            playerMap.get(playerId);

          if (!player) {
            return null;
          }

          return {
            player,
            team: teamMap.get(player.teamId),
            count,
          };
        })
        .filter(
          (
            entry
          ): entry is LeaderboardEntry =>
            entry !== null
        )
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }

          return a.player.name.localeCompare(
            b.player.name
          );
        });
    },
    [goals, playerMap, teamMap]
  );

  const mvpLeaderboard =
    useMemo<LeaderboardEntry[]>(
      () => {
        const counts = new Map<
          string,
          number
        >();

        for (const match of matches) {
          if (
            match.status !== "FINISHED" ||
            !match.mvpPlayerId
          ) {
            continue;
          }

          counts.set(
            match.mvpPlayerId,
            (counts.get(match.mvpPlayerId) ?? 0) + 1
          );
        }

        return Array.from(counts.entries())
          .map(([playerId, count]) => {
            const player =
              playerMap.get(playerId);

            if (!player) {
              return null;
            }

            return {
              player,
              team: teamMap.get(
                player.teamId
              ),
              count,
            };
          })
          .filter(
            (
              entry
            ): entry is LeaderboardEntry =>
              entry !== null
          )
          .sort((a, b) => {
            if (b.count !== a.count) {
              return b.count - a.count;
            }

            return a.player.name.localeCompare(
              b.player.name
            );
          });
      },
      [matches, playerMap, teamMap]
    );

  const topScorer =
    goalScorers.length > 0
      ? goalScorers[0]
      : undefined;

  const topMvp =
    mvpLeaderboard.length > 0
      ? mvpLeaderboard[0]
      : undefined;

  const groupedMatches = useMemo(() => {
    const groups = new Map<
      number,
      PublicMatch[]
    >();

    for (const match of matches) {
      const existing =
        groups.get(match.roundNumber) ?? [];

      existing.push(match);
      groups.set(
        match.roundNumber,
        existing
      );
    }

    return Array.from(groups.entries());
  }, [matches]);

  const finishedMatches = matches.filter(
    (match) =>
      match.status === "FINISHED"
  );

  const liveMatches = matches.filter(
    (match) =>
      match.status === "LIVE"
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !tournament) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-slate-400" />

          <h1 className="text-2xl font-bold text-slate-900">
            Tournament unavailable
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {error ??
              "This tournament could not be found."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-400">
                <Trophy className="h-4 w-4" />
                Tournament
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                {tournament.name}
              </h1>

              <p className="mt-3 text-slate-400">
                {tournament.format ===
                "ROUND_ROBIN"
                  ? "Round-robin tournament"
                  : "Tournament"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HeaderStat
                label="Teams"
                value={teams.length}
              />

              <HeaderStat
                label="Matches"
                value={matches.length}
              />

              <HeaderStat
                label="Finished"
                value={finishedMatches.length}
              />

              <HeaderStat
                label="Live"
                value={liveMatches.length}
              />
            </div>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          <TabButton
            active={
              activeTab === "standings"
            }
            onClick={() =>
              setActiveTab("standings")
            }
          >
            Standings
          </TabButton>

          <TabButton
            active={
              activeTab === "fixtures"
            }
            onClick={() =>
              setActiveTab("fixtures")
            }
          >
            Fixtures & Results
          </TabButton>

          <TabButton
            active={
              activeTab === "leaders"
            }
            onClick={() =>
              setActiveTab("leaders")
            }
          >
            Leaders
          </TabButton>

          <TabButton
            active={
              activeTab === "gallery"
            }
            onClick={() =>
              setActiveTab("gallery")
            }
          >
            Gallery
          </TabButton>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {activeTab === "standings" && (
          <section>
            <SectionTitle
              icon={
                <Trophy className="h-5 w-5" />
              }
              title="League Standings"
            />

            {standings.length === 0 ? (
              <EmptyState text="No teams have been added yet." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-300">
                      <tr>
                        <th className="px-4 py-3">
                          #
                        </th>
                        <th className="px-4 py-3">
                          Team
                        </th>
                        <th className="px-4 py-3 text-center">
                          P
                        </th>
                        <th className="px-4 py-3 text-center">
                          W
                        </th>
                        <th className="px-4 py-3 text-center">
                          D
                        </th>
                        <th className="px-4 py-3 text-center">
                          L
                        </th>
                        <th className="px-4 py-3 text-center">
                          GF
                        </th>
                        <th className="px-4 py-3 text-center">
                          GA
                        </th>
                        <th className="px-4 py-3 text-center">
                          GD
                        </th>
                        <th className="px-4 py-3 text-center">
                          Pts
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {standings.map(
                        (team, index) => (
                          <tr
                            key={team.id}
                            className="hover:bg-slate-50"
                          >
                            <td className="px-4 py-4 font-bold text-slate-500">
                              {index + 1}
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <TeamBadge
                                  team={team}
                                />

                                <span className="font-semibold">
                                  {team.name}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-4 text-center">
                              {team.played}
                            </td>

                            <td className="px-4 py-4 text-center">
                              {team.won}
                            </td>

                            <td className="px-4 py-4 text-center">
                              {team.drawn}
                            </td>

                            <td className="px-4 py-4 text-center">
                              {team.lost}
                            </td>

                            <td className="px-4 py-4 text-center">
                              {team.goalsFor}
                            </td>

                            <td className="px-4 py-4 text-center">
                              {team.goalsAgainst}
                            </td>

                            <td className="px-4 py-4 text-center font-semibold">
                              {team.goalDiff >
                              0
                                ? `+${team.goalDiff}`
                                : team.goalDiff}
                            </td>

                            <td className="px-4 py-4 text-center text-base font-black">
                              {team.points}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "fixtures" && (
          <section>
            <SectionTitle
              icon={
                <CalendarDays className="h-5 w-5" />
              }
              title="Fixtures & Results"
            />

            {groupedMatches.length === 0 ? (
              <EmptyState text="No fixtures have been created yet." />
            ) : (
              <div className="space-y-6">
                {groupedMatches.map(
                  ([round, roundMatches]) => (
                    <div key={round}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                          Round {round}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {roundMatches.map(
                          (match) => (
                            <MatchCard
                              key={match.id}
                              match={match}
                            />
                          )
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === "leaders" && (
          <section>
            <SectionTitle
              icon={
                <Users className="h-5 w-5" />
              }
              title="Tournament Leaders"
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <LeaderboardCard
                title="Top Scorers"
                entries={goalScorers}
                suffix="goals"
              />

              <LeaderboardCard
                title="Most MVP Awards"
                entries={mvpLeaderboard}
                suffix="MVP"
              />
            </div>

            {(topScorer || topMvp) && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {topScorer && (
                  <LeaderHighlight
                    title="Current Top Scorer"
                    entry={topScorer}
                  />
                )}

                {topMvp && (
                  <LeaderHighlight
                    title="Most MVP Awards"
                    entry={topMvp}
                  />
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === "gallery" && (
          <section>
            <SectionTitle
              icon={
                <Camera className="h-5 w-5" />
              }
              title="Tournament Gallery"
            />

            {gallery.length === 0 ? (
              <EmptyState text="No tournament photos have been uploaded yet." />
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {gallery.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() =>
                      setSelectedImage(
                        image
                      )
                    }
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm"
                  >
                    <div className="aspect-square overflow-hidden bg-slate-100">
                      <img
                        src={image.imageUrl}
                        alt={
                          image.caption ??
                          "Tournament photo"
                        }
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </div>

                    {image.caption && (
                      <div className="p-3">
                        <p className="line-clamp-2 text-sm font-medium text-slate-700">
                          {image.caption}
                        </p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="mt-16 border-t border-slate-200 py-8 text-center text-sm text-slate-400">
          {tournament.name}
        </footer>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() =>
            setSelectedImage(null)
          }
        >
          <button
            type="button"
            onClick={() =>
              setSelectedImage(null)
            }
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close image"
          >
            <X className="h-6 w-6" />
          </button>

          <div
            className="max-h-[90vh] max-w-5xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <img
              src={selectedImage.imageUrl}
              alt={
                selectedImage.caption ??
                "Tournament photo"
              }
              className="max-h-[80vh] max-w-full rounded-xl object-contain"
            />

            {selectedImage.caption && (
              <p className="mt-3 text-center text-sm text-white">
                {selectedImage.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function HeaderStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-2xl font-black">
        {value}
      </div>

      <div className="text-xs text-slate-400">
        {label}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-semibold transition ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-sm text-slate-500">
        {text}
      </p>
    </div>
  );
}

function MatchCard({
  match,
}: {
  match: PublicMatch;
}) {
  const isLive =
    match.status === "LIVE";

  const isFinished =
    match.status === "FINISHED";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-500">
          {stageLabel(match.stage)}
        </span>

        <span
          className={`rounded-full px-2.5 py-1 font-bold ${
            isLive
              ? "bg-red-100 text-red-700"
              : isFinished
                ? "bg-slate-100 text-slate-600"
                : "bg-blue-100 text-blue-700"
          }`}
        >
          {statusLabel(match.status)}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <TeamMatchSide
          team={match.homeTeam}
          align="right"
        />

        <div className="min-w-[70px] text-center">
          {isFinished || isLive ? (
            <div className="text-2xl font-black">
              {match.homeScore}
              <span className="mx-2 text-slate-300">
                -
              </span>
              {match.awayScore}
            </div>
          ) : (
            <div className="text-sm font-bold text-slate-400">
              VS
            </div>
          )}
        </div>

        <TeamMatchSide
          team={match.awayTeam}
          align="left"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-400">
        {match.scheduledAt && (
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {formatDate(
              match.scheduledAt
            )}
          </span>
        )}

        {match.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {match.location}
          </span>
        )}

        {match.refereeName && (
          <span>
            Referee: {match.refereeName}
          </span>
        )}
      </div>
    </div>
  );
}

function TeamMatchSide({
  team,
  align,
}: {
  team: Team;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-3 ${
        align === "right"
          ? "justify-end text-right"
          : "justify-start text-left"
      }`}
    >
      {align === "right" && (
        <span className="font-semibold">
          {team.name}
        </span>
      )}

      <TeamBadge team={team} />

      {align === "left" && (
        <span className="font-semibold">
          {team.name}
        </span>
      )}
    </div>
  );
}

function LeaderboardCard({
  title,
  entries,
  suffix,
}: {
  title: string;
  entries: LeaderboardEntry[];
  suffix: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-slate-900">
          {title}
        </h3>
      </div>

      {entries.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-500">
          No data yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {entries
            .slice(0, 10)
            .map((entry, index) => (
              <div
                key={entry.player.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-5 text-sm font-bold text-slate-400">
                    {index + 1}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {entry.player.name}
                    </p>

                    {entry.team && (
                      <p className="truncate text-xs text-slate-400">
                        {entry.team.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-lg font-black">
                    {entry.count}
                  </span>

                  <span className="ml-1 text-xs text-slate-400">
                    {suffix}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function LeaderHighlight({
  title,
  entry,
}: {
  title: string;
  entry: LeaderboardEntry;
}) {
  return (
    <div className="rounded-2xl bg-slate-900 p-5 text-white">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-xl font-black">
            {entry.player.name}
          </p>

          {entry.team && (
            <p className="mt-1 text-sm text-slate-400">
              {entry.team.name}
            </p>
          )}
        </div>

        <div className="text-right">
          <div className="text-3xl font-black">
            {entry.count}
          </div>

          <div className="text-xs text-slate-400">
            {title.includes("Scorer")
              ? "goals"
              : "MVP"}
          </div>
        </div>
      </div>
    </div>
  );
}