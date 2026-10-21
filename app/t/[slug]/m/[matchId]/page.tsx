import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, MapPin } from "lucide-react";

import LineupView from "@/components/lineup/LineupView";
import ShareBar from "@/components/share/ShareBar";
import {
  cardKit,
  formatKickoff,
  getMatchPageData,
  stageLabel,
} from "@/lib/cards/data";

type Props = {
  params: Promise<{ slug: string; matchId: string }>;
  searchParams: Promise<{ card?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug, matchId } = await params;
  const { card } = await searchParams;
  const data = await getMatchPageData(slug, matchId).catch(() => null);

  if (!data) return { title: "Match · Group Stage" };

  const { match, tournament, home, away, sides } = data;
  const played = match.status !== "SCHEDULED";

  const title = played
    ? `${home.name} ${match.home_score}-${match.away_score} ${away.name} · ${tournament.name}`
    : `${home.name} vs ${away.name} · ${tournament.name}`;

  const description = [
    stageLabel(match.stage, match.round_number),
    formatKickoff(match.scheduled_at),
    match.location,
  ]
    .filter(Boolean)
    .join(" · ");

  const wantsLineup = card === "lineup" && (sides.home || sides.away);
  const image = `/api/card/${wantsLineup ? "lineup" : "match"}/${matchId}?format=og`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `/t/${slug}/m/${matchId}`,
      siteName: "Group Stage",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

type TeamRow = {
  id: string;
  name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
};

function Crest({ team }: { team: TeamRow }) {
  const kit = cardKit(team);

  return team.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={team.logo_url}
      alt=""
      className="h-20 w-20 rounded-full bg-white object-cover sm:h-24 sm:w-24"
      style={{ border: `4px solid ${kit.secondary}` }}
    />
  ) : (
    <div
      className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black sm:h-24 sm:w-24 sm:text-3xl"
      style={{
        background: kit.primary,
        color: kit.text,
        border: `4px solid ${kit.secondary}`,
      }}
    >
      {initials(team.name)}
    </div>
  );
}

export default async function MatchPage({ params }: Props) {
  const { slug, matchId } = await params;
  const data = await getMatchPageData(slug, matchId).catch(() => null);

  if (!data) notFound();

  const { match, tournament, home, away, sides, goals, players } = data;

  const played = match.status !== "SCHEDULED";
  const kickoff = formatKickoff(match.scheduled_at);
  const playerById = new Map(players.map((p) => [p.id, p]));
  const mvp = match.mvp_player_id ? playerById.get(match.mvp_player_id) : null;

  const hasLineup = Boolean(sides.home || sides.away);
  const base = `/t/${slug}/m/${matchId}`;

  const message = played
    ? `${home.name} ${match.home_score}-${match.away_score} ${away.name} (${tournament.name})`
    : `${home.name} vs ${away.name}${kickoff ? `, ${kickoff}` : ""} (${tournament.name})`;

  const goalList = (teamId: string) =>
    goals
      .filter((g) => playerById.get(g.player_id)?.team_id === teamId)
      .map((g) => ({
        id: g.id as string,
        name: playerById.get(g.player_id)?.name as string,
        minute: g.minute as number | null,
      }));

  const homeGoals = goalList(home.id);
  const awayGoals = goalList(away.id);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
          <Link
            href={`/t/${slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {tournament.name}
          </Link>

          <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-emerald-400">
            {stageLabel(match.stage, match.round_number)}
            {match.status === "LIVE" && (
              <span className="ml-3 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                LIVE
              </span>
            )}
          </p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex w-1/3 flex-col items-center text-center">
              <Crest team={home as TeamRow} />
              <p className="mt-3 text-sm font-bold sm:text-lg">{home.name}</p>
            </div>

            <div className="text-center">
              {played ? (
                <p className="text-4xl font-black sm:text-6xl">
                  {match.home_score} - {match.away_score}
                </p>
              ) : (
                <p className="text-2xl font-black text-slate-500 sm:text-4xl">
                  VS
                </p>
              )}
              {match.status === "FINISHED" && (
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Full time
                </p>
              )}
            </div>

            <div className="flex w-1/3 flex-col items-center text-center">
              <Crest team={away as TeamRow} />
              <p className="mt-3 text-sm font-bold sm:text-lg">{away.name}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
            {kickoff && (
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-4 w-4" />
                {kickoff}
              </span>
            )}
            {match.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {match.location}
              </span>
            )}
            {match.referee_name && <span>Referee: {match.referee_name}</span>}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {played && (homeGoals.length > 0 || awayGoals.length > 0 || mvp) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Match events
            </h2>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {[
                { team: home, list: homeGoals },
                { team: away, list: awayGoals },
              ].map(({ team, list }) => (
                <div key={team.id}>
                  <p className="text-sm font-bold">{team.name}</p>
                  {list.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-400">No goals</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {list.map((goal) => (
                        <li key={goal.id}>
                          ⚽ {goal.name}
                          {goal.minute !== null && (
                            <span className="ml-1 text-slate-400">
                              {goal.minute}&apos;
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {mvp && (
              <p className="mt-4 border-t border-slate-100 pt-3 text-sm">
                <span className="font-bold">Player of the match:</span>{" "}
                {mvp.name}
              </p>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Lineups
          </h2>

          <div className="mt-4">
            {hasLineup ? (
              <LineupView
                homeName={home.name}
                awayName={away.name}
                home={sides.home}
                away={sides.away}
                theme="light"
              />
            ) : (
              <p className="text-sm text-slate-500">
                Lineups have not been published yet.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Share this match
          </h2>

          <div className="mt-3">
            <ShareBar
              path={base}
              message={message}
              downloads={[
                {
                  label: "Post image",
                  href: `/api/card/match/${matchId}?format=square&download=1`,
                },
                {
                  label: "Story image",
                  href: `/api/card/match/${matchId}?format=story&download=1`,
                },
                ...(hasLineup
                  ? [
                      {
                        label: "Lineup image",
                        href: `/api/card/lineup/${matchId}?format=story&download=1`,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
