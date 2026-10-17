"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Shield, Users } from "lucide-react";

import { supabase } from "@/lib/supabase";
import {
  sortPlayers,
  sortTeams,
  type Notice,
  type Player,
  type Team,
  type TournamentInfo,
} from "@/lib/squad";
import TeamsPanel from "@/components/squad/TeamsPanel";
import PlayersPanel from "@/components/squad/PlayersPanel";

type Tab = "teams" | "players";

export default function SquadManagerPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [tournament, setTournament] = useState<TournamentInfo | null>(
    null
  );
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  const [tab, setTab] = useState<Tab>("teams");
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      const { data: t, error: tournamentError } = await supabase
        .from("tournaments")
        .select("id, name, public_slug, admin_id")
        .eq("public_slug", slug)
        .maybeSingle();

      if (!active) return;

      if (tournamentError || !t) {
        setLoadError(tournamentError?.message ?? "Tournament not found.");
        setLoading(false);
        return;
      }

      if (t.admin_id !== user.id) {
        setDenied(true);
        setLoading(false);
        return;
      }

      const teamsResult = await supabase
        .from("teams")
        .select("*")
        .eq("tournament_id", t.id)
        .order("name");

      if (teamsResult.error) {
        if (active) {
          setLoadError(teamsResult.error.message);
          setLoading(false);
        }
        return;
      }

      const teamRows = (teamsResult.data ?? []) as Team[];

      const playersResult = await supabase
        .from("players")
        .select("*")
        .in(
          "team_id",
          teamRows.map((team) => team.id)
        );

      if (!active) return;

      if (playersResult.error) {
        setLoadError(playersResult.error.message);
        setLoading(false);
        return;
      }

      setTournament(t as TournamentInfo);
      setTeams(sortTeams(teamRows));
      setPlayers(sortPlayers((playersResult.data ?? []) as Player[]));
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [slug, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-white">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin" />
          Loading squads...
        </div>
      </main>
    );
  }

  if (denied || !tournament) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-red-400/20 bg-red-400/10 p-6 text-center">
          <h1 className="text-xl font-bold">
            {denied ? "Access denied" : "Unavailable"}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {denied
              ? "You are not authorized to manage this tournament."
              : loadError || "Tournament unavailable."}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:bg-emerald-400"
          >
            My Tournaments
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <button
              onClick={() => router.push(`/admin/${slug}`)}
              className="mb-2 flex items-center gap-2 text-sm text-gray-500 hover:text-white"
            >
              <ArrowLeft size={15} />
              Back to dashboard
            </button>
            <h1 className="text-2xl font-black">Squad Manager</h1>
            <p className="text-sm text-gray-500">{tournament.name}</p>
          </div>

          <button
            onClick={() => router.push(`/t/${slug}`)}
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-emerald-400"
          >
            View public page
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex gap-1 border-b border-white/10">
          {(
            [
              ["teams", "Teams", Shield, teams.length],
              ["players", "Players", Users, players.length],
            ] as const
          ).map(([id, label, Icon, count]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setNotice(null);
              }}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
                tab === id
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-gray-500"
              }`}
            >
              <Icon size={16} />
              {label}
              <span className="text-xs opacity-70">{count}</span>
            </button>
          ))}
        </div>

        {notice && (
          <p
            className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
              notice.type === "error"
                ? "border-red-400/20 bg-red-400/10 text-red-300"
                : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
            }`}
          >
            {notice.text}
          </p>
        )}

        <div className="mt-6">
          {tab === "teams" ? (
            <TeamsPanel
              tournament={tournament}
              teams={teams}
              players={players}
              setTeams={setTeams}
              setPlayers={setPlayers}
              notify={setNotice}
            />
          ) : (
            <PlayersPanel
              tournament={tournament}
              teams={teams}
              players={players}
              setPlayers={setPlayers}
              notify={setNotice}
            />
          )}
        </div>
      </section>
    </main>
  );
}
