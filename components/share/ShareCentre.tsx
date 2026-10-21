"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import ShareBar from "./ShareBar";
import type { Team } from "@/lib/squad";

type CentreMatch = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  round_number: number;
  status: string;
};

type Props = {
  tournamentName: string;
  slug: string;
  teams: Team[];
  matches: CentreMatch[];
};

type Kind = "tournament" | "match" | "lineup";
type Format = "square" | "story" | "og";

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "tournament", label: "Tournament", hint: "Name, teams and dates" },
  { id: "match", label: "Match", hint: "Teams, score or kickoff" },
  { id: "lineup", label: "Lineup", hint: "Published lineups on the pitch" },
];

const FORMATS: { id: Format; label: string }[] = [
  { id: "square", label: "Post (square)" },
  { id: "story", label: "Story (tall)" },
  { id: "og", label: "Link preview (wide)" },
];

export default function ShareCentre({
  tournamentName,
  slug,
  teams,
  matches,
}: Props) {
  const [kind, setKind] = useState<Kind>("tournament");
  const [format, setFormat] = useState<Format>("square");
  const [selectedMatchId, setSelectedMatchId] = useState("");

  const [loadedHref, setLoadedHref] = useState("");
  const [failedHref, setFailedHref] = useState("");

  const teamName = (id: string) =>
    teams.find((t) => t.id === id)?.name ?? "?";

  const sorted = [...matches].sort((a, b) => a.round_number - b.round_number);

  const matchId = sorted.some((m) => m.id === selectedMatchId)
    ? selectedMatchId
    : (sorted[0]?.id ?? "");

  const match = sorted.find((m) => m.id === matchId);

  const needsMatch = kind !== "tournament";
  const id = kind === "tournament" ? slug : matchId;

  const previewHref = id ? `/api/card/${kind}/${id}?format=${format}` : "";

  const path =
    kind === "tournament"
      ? `/t/${slug}`
      : kind === "match"
        ? `/t/${slug}/m/${matchId}`
        : `/t/${slug}/m/${matchId}?card=lineup`;

  const message =
    kind === "tournament"
      ? `Follow ${tournamentName} on Group Stage`
      : match
        ? kind === "lineup"
          ? `Lineups: ${teamName(match.home_team_id)} vs ${teamName(match.away_team_id)} (${tournamentName})`
          : `${teamName(match.home_team_id)} vs ${teamName(match.away_team_id)} (${tournamentName})`
        : tournamentName;

  const downloads = previewHref
    ? [
        {
          label: "Download post",
          href: `/api/card/${kind}/${id}?format=square&download=1`,
        },
        {
          label: "Download story",
          href: `/api/card/${kind}/${id}?format=story&download=1`,
        },
      ]
    : [];

  const loading =
    previewHref !== "" &&
    loadedHref !== previewHref &&
    failedHref !== previewHref;

  const aspect =
    format === "story"
      ? "aspect-[9/16] max-w-[300px]"
      : format === "og"
        ? "aspect-[1200/630] max-w-[560px]"
        : "aspect-square max-w-[420px]";

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-bold">Share Centre</h2>
        <p className="mt-1 text-sm text-gray-500">
          Cards use your teams&apos; kit colours and crests. Only public
          information appears on them. Links show a matching preview in
          WhatsApp and social apps.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {KINDS.map((item) => (
            <button
              key={item.id}
              onClick={() => setKind(item.id)}
              className={`rounded-xl border px-4 py-3 text-left ${
                kind === item.id
                  ? "border-emerald-400 bg-emerald-400/10"
                  : "border-white/10 hover:bg-white/5"
              }`}
            >
              <p
                className={`text-sm font-bold ${
                  kind === item.id ? "text-emerald-400" : ""
                }`}
              >
                {item.label}
              </p>
              <p className="text-xs text-gray-500">{item.hint}</p>
            </button>
          ))}
        </div>

        {needsMatch && (
          <div className="mt-4">
            {sorted.length === 0 ? (
              <p className="text-sm text-gray-500">There are no fixtures yet.</p>
            ) : (
              <select
                value={matchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="w-full max-w-md rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400"
              >
                {sorted.map((m) => (
                  <option key={m.id} value={m.id}>
                    Round {m.round_number}: {teamName(m.home_team_id)} vs{" "}
                    {teamName(m.away_team_id)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {FORMATS.map((item) => (
            <button
              key={item.id}
              onClick={() => setFormat(item.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                format === item.id
                  ? "border-emerald-400 bg-emerald-400/10 text-emerald-400"
                  : "border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {previewHref && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div
            className={`relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-xl bg-black/40 ${aspect}`}
          >
            {loading && (
              <Loader2
                size={26}
                className="absolute animate-spin text-gray-400"
              />
            )}

            {failedHref === previewHref ? (
              <p className="px-6 text-center text-sm text-gray-400">
                {kind === "lineup"
                  ? "No lineup is published for this match yet. Publish one in the Lineups tab first."
                  : "The preview could not be generated. Check that the match and tournament are public."}
              </p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewHref}
                alt="Card preview"
                onLoad={() => setLoadedHref(previewHref)}
                onError={() => setFailedHref(previewHref)}
                className="h-full w-full object-contain"
              />
            )}
          </div>

          <div className="mt-5 flex justify-center">
            <ShareBar
              path={path}
              message={message}
              downloads={failedHref === previewHref ? [] : downloads}
              theme="dark"
            />
          </div>

          <p className="mt-4 text-center text-xs text-gray-600">
            Cards are generated from live data when opened, so a downloaded
            image shows the score at that moment.
          </p>
        </div>
      )}
    </section>
  );
}
