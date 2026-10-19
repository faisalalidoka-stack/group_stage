"use client";

import { Dispatch, SetStateAction, useState } from "react";
import { Shield, Users } from "lucide-react";

import type { Notice, Player, Team } from "@/lib/squad";
import TeamsPanel from "./TeamsPanel";
import PlayersPanel from "./PlayersPanel";

type SquadManagerProps = {
  tournamentId: string;
  teams: Team[];
  players: Player[];
  setTeams: Dispatch<SetStateAction<Team[]>>;
  setPlayers: Dispatch<SetStateAction<Player[]>>;
};

type Tab = "teams" | "players";

export default function SquadManager({
  tournamentId,
  teams,
  players,
  setTeams,
  setPlayers,
}: SquadManagerProps) {
  const [tab, setTab] = useState<Tab>("teams");
  const [notice, setNotice] = useState<Notice>(null);

  const tabs = [
    { id: "teams" as const, label: "Teams", Icon: Shield, count: teams.length },
    { id: "players" as const, label: "Players", Icon: Users, count: players.length },
  ];

  return (
    <section className="mt-6">
      <div className="flex gap-1 border-b border-white/10">
        {tabs.map(({ id, label, Icon, count }) => (
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
            tournamentId={tournamentId}
            teams={teams}
            players={players}
            setTeams={setTeams}
            setPlayers={setPlayers}
            notify={setNotice}
          />
        ) : (
          <PlayersPanel
            tournamentId={tournamentId}
            teams={teams}
            players={players}
            setPlayers={setPlayers}
            notify={setNotice}
          />
        )}
      </div>
    </section>
  );
}
