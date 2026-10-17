"use client";

import { useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type Team = {
  id: string;
  tournament_id: string;
  name: string;
  logo_url: string | null;
};

type Player = {
  id: string;
  team_id: string;
  name: string;
  number: number | null;
};

type Props = {
  tournamentId: string;
  teams: Team[];
  players: Player[];
  onChanged: () => Promise<void>;
};

export default function TeamsManager({
  tournamentId,
  teams,
  players,
  onChanged,
}: Props) {
  const [teamName, setTeamName] = useState("");

  const [playerName, setPlayerName] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");
  const [playerTeamId, setPlayerTeamId] = useState("");

  const [editingTeamId, setEditingTeamId] =
    useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] =
    useState("");

  const [editingPlayerId, setEditingPlayerId] =
    useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] =
    useState("");
  const [editingPlayerNumber, setEditingPlayerNumber] =
    useState("");
  const [editingPlayerTeamId, setEditingPlayerTeamId] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sortedTeams = useMemo(
    () =>
      [...teams].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [teams]
  );

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function validateName(
    value: string,
    label: string
  ) {
    const name = value.trim();

    if (!name) {
      throw new Error(
        `Enter a ${label} name.`
      );
    }

    if (name.length > 80) {
      throw new Error(
        `${label} name must be 80 characters or fewer.`
      );
    }

    return name;
  }

  function validateNumber(value: string) {
    if (!value.trim()) {
      return null;
    }

    const number = Number(value);

    if (
      !Number.isInteger(number) ||
      number < 0 ||
      number > 99
    ) {
      throw new Error(
        "Player number must be a whole number from 0 to 99."
      );
    }

    return number;
  }

  // --------------------------------------------------
  // TEAMS
  // --------------------------------------------------

  async function addTeam() {
    clearMessages();

    try {
      const name = validateName(teamName, "team");

      const duplicate = teams.some(
        (team) =>
          team.name.trim().toLowerCase() ===
          name.toLowerCase()
      );

      if (duplicate) {
        throw new Error(
          "A team with that name already exists."
        );
      }

      setSaving(true);

      const { error } = await supabase
        .from("teams")
        .insert({
          tournament_id: tournamentId,
          name,
        });

      if (error) {
        throw new Error(error.message);
      }

      setTeamName("");

      await onChanged();

      setSuccess(
        "Team added successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add team."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditTeam(team: Team) {
    clearMessages();

    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
  }

  function cancelEditTeam() {
    setEditingTeamId(null);
    setEditingTeamName("");
  }

  async function saveTeam(teamId: string) {
    clearMessages();

    try {
      const name = validateName(
        editingTeamName,
        "team"
      );

      const duplicate = teams.some(
        (team) =>
          team.id !== teamId &&
          team.name.trim().toLowerCase() ===
            name.toLowerCase()
      );

      if (duplicate) {
        throw new Error(
          "A team with that name already exists."
        );
      }

      setSaving(true);

      const { error } = await supabase
        .from("teams")
        .update({ name })
        .eq("id", teamId)
        .eq(
          "tournament_id",
          tournamentId
        );

      if (error) {
        throw new Error(error.message);
      }

      cancelEditTeam();

      await onChanged();

      setSuccess(
        "Team updated successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update team."
      );
    } finally {
      setSaving(false);
    }
  }

  async function hasTeamMatches(
    teamId: string
  ) {
    const { data, error } = await supabase
      .from("matches")
      .select("id")
      .eq(
        "tournament_id",
        tournamentId
      )
      .or(
        `home_team_id.eq.${teamId},away_team_id.eq.${teamId}`
      )
      .limit(1);

    if (error) {
      setError(error.message);
      return true;
    }

    return (data?.length ?? 0) > 0;
  }

  async function deleteTeam(team: Team) {
    clearMessages();

    const hasMatches =
      await hasTeamMatches(team.id);

    if (hasMatches) {
      setError(
        "This team cannot be deleted because it already has fixtures. Keep it to preserve tournament history."
      );

      return;
    }

    const confirmed = window.confirm(
      `Delete "${team.name}"? This will also remove its registered players.`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", team.id)
        .eq(
          "tournament_id",
          tournamentId
        );

      if (error) {
        throw new Error(error.message);
      }

      await onChanged();

      setSuccess(
        "Team deleted successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete team."
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // PLAYERS
  // --------------------------------------------------

  async function addPlayer() {
    clearMessages();

    try {
      const name = validateName(
        playerName,
        "player"
      );

      if (!playerTeamId) {
        throw new Error(
          "Select a team for the player."
        );
      }

      const number =
        validateNumber(playerNumber);

      const duplicateNumber =
        players.some(
          (player) =>
            player.team_id ===
              playerTeamId &&
            player.number !== null &&
            number !== null &&
            player.number === number
        );

      if (duplicateNumber) {
        throw new Error(
          "That shirt number is already used by this team."
        );
      }

      setSaving(true);

      const { error } = await supabase
        .from("players")
        .insert({
          team_id: playerTeamId,
          name,
          number,
        });

      if (error) {
        throw new Error(error.message);
      }

      setPlayerName("");
      setPlayerNumber("");

      await onChanged();

      setSuccess(
        "Player added successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add player."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditPlayer(
    player: Player
  ) {
    clearMessages();

    setEditingPlayerId(player.id);
    setEditingPlayerName(player.name);

    setEditingPlayerNumber(
      player.number === null
        ? ""
        : String(player.number)
    );

    setEditingPlayerTeamId(
      player.team_id
    );
  }

  function cancelEditPlayer() {
    setEditingPlayerId(null);
    setEditingPlayerName("");
    setEditingPlayerNumber("");
    setEditingPlayerTeamId("");
  }

  async function savePlayer(
    playerId: string
  ) {
    clearMessages();

    try {
      const name = validateName(
        editingPlayerName,
        "player"
      );

      if (!editingPlayerTeamId) {
        throw new Error(
          "Select a team for the player."
        );
      }

      const number =
        validateNumber(
          editingPlayerNumber
        );

      const duplicateNumber =
        players.some(
          (player) =>
            player.id !== playerId &&
            player.team_id ===
              editingPlayerTeamId &&
            player.number !== null &&
            number !== null &&
            player.number === number
        );

      if (duplicateNumber) {
        throw new Error(
          "That shirt number is already used by this team."
        );
      }

      setSaving(true);

      const { error } = await supabase
        .from("players")
        .update({
          name,
          number,
          team_id:
            editingPlayerTeamId,
        })
        .eq("id", playerId);

      if (error) {
        throw new Error(error.message);
      }

      cancelEditPlayer();

      await onChanged();

      setSuccess(
        "Player updated successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update player."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePlayer(
    player: Player
  ) {
    clearMessages();

    const { data, error } =
      await supabase
        .from("goals")
        .select("id")
        .eq(
          "player_id",
          player.id
        )
        .limit(1);

    if (error) {
      setError(error.message);
      return;
    }

    if ((data?.length ?? 0) > 0) {
      setError(
        "This player cannot be deleted because they have recorded goals. Edit the player instead to preserve tournament history."
      );

      return;
    }

    const confirmed = window.confirm(
      `Delete player "${player.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      const { error } =
        await supabase
          .from("players")
          .delete()
          .eq("id", player.id);

      if (error) {
        throw new Error(error.message);
      }

      await onChanged();

      setSuccess(
        "Player deleted successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete player."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 space-y-6">
      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          <span>{success}</span>

          <button
            onClick={() => setSuccess("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* TEAMS */}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
              <Users size={19} />
            </div>

            <div>
              <h2 className="font-bold">
                Teams
              </h2>

              <p className="text-xs text-gray-500">
                Add and maintain tournament teams.
              </p>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <input
              value={teamName}
              onChange={(e) =>
                setTeamName(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void addTeam();
                }
              }}
              placeholder="Team name"
              maxLength={80}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />

            <button
              disabled={saving}
              onClick={() =>
                void addTeam()
              }
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {sortedTeams.map((team) => {
              const count =
                players.filter(
                  (player) =>
                    player.team_id ===
                    team.id
                ).length;

              const editing =
                editingTeamId ===
                team.id;

              return (
                <div
                  key={team.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  {editing ? (
                    <div className="flex gap-2">
                      <input
                        value={
                          editingTeamName
                        }
                        onChange={(e) =>
                          setEditingTeamName(
                            e.target.value
                          )
                        }
                        maxLength={80}
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                      />

                      <button
                        disabled={saving}
                        onClick={() =>
                          void saveTeam(
                            team.id
                          )
                        }
                        className="rounded-lg bg-emerald-500 p-2 text-black"
                      >
                        <Save
                          size={16}
                        />
                      </button>

                      <button
                        onClick={
                          cancelEditTeam
                        }
                        className="rounded-lg bg-white/5 p-2 text-gray-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {team.name}
                        </p>

                        <p className="text-xs text-gray-500">
                          {count} player
                          {count === 1
                            ? ""
                            : "s"}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            startEditTeam(
                              team
                            )
                          }
                          className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white"
                        >
                          <Pencil
                            size={16}
                          />
                        </button>

                        <button
                          disabled={saving}
                          onClick={() =>
                            void deleteTeam(
                              team
                            )
                          }
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-400/10 hover:text-red-300"
                        >
                          <Trash2
                            size={16}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* PLAYERS */}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="font-bold">
            Players
          </h2>

          <p className="text-xs text-gray-500">
            Register players and shirt numbers.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_90px_1fr_auto]">
            <input
              value={playerName}
              onChange={(e) =>
                setPlayerName(
                  e.target.value
                )
              }
              placeholder="Player name"
              maxLength={80}
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />

            <input
              value={playerNumber}
              onChange={(e) =>
                setPlayerNumber(
                  e.target.value
                )
              }
              placeholder="#"
              type="number"
              min="0"
              max="99"
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />

            <select
              value={playerTeamId}
              onChange={(e) =>
                setPlayerTeamId(
                  e.target.value
                )
              }
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            >
              <option value="">
                Select team
              </option>

              {sortedTeams.map(
                (team) => (
                  <option
                    key={team.id}
                    value={team.id}
                  >
                    {team.name}
                  </option>
                )
              )}
            </select>

            <button
              disabled={saving}
              onClick={() =>
                void addPlayer()
              }
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {sortedTeams.map(
              (team) => {
                const teamPlayers =
                  players
                    .filter(
                      (player) =>
                        player.team_id ===
                        team.id
                    )
                    .sort(
                      (a, b) => {
                        if (
                          a.number ===
                          null
                        )
                          return 1;

                        if (
                          b.number ===
                          null
                        )
                          return -1;

                        return (
                          a.number -
                          b.number
                        );
                      }
                    );

                return (
                  <div
                    key={team.id}
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {team.name}
                    </p>

                    {teamPlayers.length ===
                    0 ? (
                      <p className="rounded-lg bg-black/20 px-3 py-3 text-sm text-gray-600">
                        No players registered.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {teamPlayers.map(
                          (player) => {
                            const editing =
                              editingPlayerId ===
                              player.id;

                            if (
                              editing
                            ) {
                              return (
                                <div
                                  key={
                                    player.id
                                  }
                                  className="grid gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 sm:grid-cols-[1fr_80px_1fr_auto_auto]"
                                >
                                  <input
                                    value={
                                      editingPlayerName
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      setEditingPlayerName(
                                        e
                                          .target
                                          .value
                                      )
                                    }
                                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                                  />

                                  <input
                                    value={
                                      editingPlayerNumber
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      setEditingPlayerNumber(
                                        e
                                          .target
                                          .value
                                      )
                                    }
                                    type="number"
                                    min="0"
                                    max="99"
                                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                                  />

                                  <select
                                    value={
                                      editingPlayerTeamId
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      setEditingPlayerTeamId(
                                        e
                                          .target
                                          .value
                                      )
                                    }
                                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                                  >
                                    {sortedTeams.map(
                                      (
                                        option
                                      ) => (
                                        <option
                                          key={
                                            option.id
                                          }
                                          value={
                                            option.id
                                          }
                                        >
                                          {
                                            option.name
                                          }
                                        </option>
                                      )
                                    )}
                                  </select>

                                  <button
                                    disabled={
                                      saving
                                    }
                                    onClick={() =>
                                      void savePlayer(
                                        player.id
                                      )
                                    }
                                    className="rounded-lg bg-emerald-500 p-2 text-black"
                                  >
                                    <Save
                                      size={
                                        16
                                      }
                                    />
                                  </button>

                                  <button
                                    onClick={
                                      cancelEditPlayer
                                    }
                                    className="rounded-lg bg-white/5 p-2 text-gray-400"
                                  >
                                    <X
                                      size={
                                        16
                                      }
                                    />
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={
                                  player.id
                                }
                                className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2"
                              >
                                <div>
                                  <span className="text-sm font-medium">
                                    {
                                      player.name
                                    }
                                  </span>

                                  {player.number !==
                                    null && (
                                    <span className="ml-2 text-xs text-gray-500">
                                      #
                                      {
                                        player.number
                                      }
                                    </span>
                                  )}
                                </div>

                                <div className="flex gap-1">
                                  <button
                                    onClick={() =>
                                      startEditPlayer(
                                        player
                                      )
                                    }
                                    className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white"
                                  >
                                    <Pencil
                                      size={
                                        15
                                      }
                                    />
                                  </button>

                                  <button
                                    disabled={
                                      saving
                                    }
                                    onClick={() =>
                                      void deletePlayer(
                                        player
                                      )
                                    }
                                    className="rounded-lg p-2 text-gray-500 hover:bg-red-400/10 hover:text-red-300"
                                  >
                                    <Trash2
                                      size={
                                        15
                                      }
                                    />
                                  </button>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>
    </section>
  );
}