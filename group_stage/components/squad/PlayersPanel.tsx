"use client";

import {
  ChangeEvent,
  Dispatch,
  SetStateAction,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import {
  MAX_SHIRT,
  MIN_SHIRT,
  describeDbError,
  parseShirt,
  sortPlayers,
  type Notice,
  type Player,
  type Team,
  type TournamentInfo,
} from "@/lib/squad";
import {
  removeImageByUrl,
  uploadImage,
  validateImage,
} from "@/lib/storage";
import Avatar from "./Avatar";

type PlayersPanelProps = {
  tournament: TournamentInfo;
  teams: Team[];
  players: Player[];
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  notify: (notice: Notice) => void;
};

type Draft = { name: string; number: string; teamId: string };

const inputClass =
  "rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400";

/** "7 John Doe", "#7 John Doe" or "John Doe" (one player per line). */
function parseBulk(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^#?(\d{1,2})\s*[.\-:)]?\s+(.+)$/);

      return match
        ? { line: index + 1, number: Number(match[1]), name: match[2].trim() }
        : { line: index + 1, number: null as number | null, name: line };
    });
}

export default function PlayersPanel({
  tournament,
  teams,
  players,
  setPlayers,
  notify,
}: PlayersPanelProps) {
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [form, setForm] = useState({ name: "", number: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    number: "",
    teamId: "",
  });

  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fail = (text: string) => notify({ type: "error", text });
  const ok = (text: string) => notify({ type: "success", text });

  const activeTeamId = teams.some((t) => t.id === selectedTeamId)
    ? selectedTeamId
    : (teams[0]?.id ?? "");

  const roster = sortPlayers(
    players.filter((p) => p.team_id === activeTeamId)
  );

  const takenNumbers = roster
    .map((p) => p.number)
    .filter((n): n is number => n !== null);

  function numberOwner(
    teamId: string,
    number: number | null,
    ignoreId?: string
  ) {
    if (number === null) return undefined;

    return players.find(
      (p) =>
        p.team_id === teamId &&
        p.id !== ignoreId &&
        p.number === number
    );
  }

  function nameTaken(teamId: string, name: string, ignoreId?: string) {
    return players.some(
      (p) =>
        p.team_id === teamId &&
        p.id !== ignoreId &&
        p.name.toLowerCase() === name.toLowerCase()
    );
  }

  async function addPlayer() {
    notify(null);

    const name = form.name.trim();

    if (!activeTeamId) return fail("Add a team first.");
    if (!name) return fail("Enter the player's name.");

    let number: number | null;

    try {
      number = parseShirt(form.number);
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Invalid number.");
    }

    const owner = numberOwner(activeTeamId, number);

    if (owner) {
      return fail(`#${number} is already worn by ${owner.name}.`);
    }

    if (nameTaken(activeTeamId, name)) {
      return fail("That player is already in this squad.");
    }

    if (photo) {
      const problem = validateImage(photo);
      if (problem) return fail(problem);
    }

    setSaving(true);

    let photoUrl: string | null = null;

    try {
      if (photo) {
        photoUrl = await uploadImage(tournament.id, "players", photo);
      }

      const { data, error } = await supabase
        .from("players")
        .insert({
          team_id: activeTeamId,
          name,
          number,
          photo_url: photoUrl,
        })
        .select()
        .single();

      if (error || !data) {
        await removeImageByUrl(photoUrl);
        throw new Error(describeDbError(error, "Failed to add player."));
      }

      setPlayers((current) => [...current, data]);
      setForm({ name: "", number: "" });
      setPhoto(null);
      setFileKey((key) => key + 1);
      ok(`${name} added.`);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Failed to add player.");
    } finally {
      setSaving(false);
    }
  }

  async function addBulk() {
    notify(null);

    if (!activeTeamId) return fail("Add a team first.");

    const rows = parseBulk(bulkText);

    if (rows.length === 0) return fail("Paste at least one player.");

    const problems: string[] = [];
    const seenNumbers = new Set<number>();
    const seenNames = new Set<string>();

    for (const row of rows) {
      if (row.number !== null && row.number > MAX_SHIRT) {
        problems.push(`Line ${row.line}: number must be ${MIN_SHIRT}-${MAX_SHIRT}.`);
        continue;
      }

      if (!row.name) {
        problems.push(`Line ${row.line}: missing name.`);
        continue;
      }

      const lowered = row.name.toLowerCase();

      if (seenNames.has(lowered) || nameTaken(activeTeamId, row.name)) {
        problems.push(`Line ${row.line}: ${row.name} is already in the squad.`);
      }

      if (row.number !== null) {
        if (
          seenNumbers.has(row.number) ||
          numberOwner(activeTeamId, row.number)
        ) {
          problems.push(`Line ${row.line}: #${row.number} is already taken.`);
        }

        seenNumbers.add(row.number);
      }

      seenNames.add(lowered);
    }

    if (problems.length > 0) {
      return fail(
        problems.slice(0, 4).join(" ") +
          (problems.length > 4 ? ` (+${problems.length - 4} more)` : "")
      );
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("players")
      .insert(
        rows.map((row) => ({
          team_id: activeTeamId,
          name: row.name,
          number: row.number,
        }))
      )
      .select();

    setSaving(false);

    if (error || !data) {
      return fail(describeDbError(error, "Failed to add players."));
    }

    setPlayers((current) => [...current, ...data]);
    setBulkText("");
    ok(`${data.length} player(s) added.`);
  }

  function startEdit(player: Player) {
    notify(null);
    setEditingId(player.id);
    setDraft({
      name: player.name,
      number: player.number === null ? "" : String(player.number),
      teamId: player.team_id,
    });
  }

  /** Goals and MVP awards tie a player to a specific match record. */
  async function matchRecordCount(playerId: string) {
    const [goals, mvps] = await Promise.all([
      supabase
        .from("goals")
        .select("id", { count: "exact", head: true })
        .eq("player_id", playerId),
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("mvp_player_id", playerId),
    ]);

    if (goals.error || mvps.error) {
      throw new Error(
        goals.error?.message ?? mvps.error?.message ?? "Check failed."
      );
    }

    return { goals: goals.count ?? 0, mvps: mvps.count ?? 0 };
  }

  async function savePlayer(player: Player) {
    notify(null);

    const name = draft.name.trim();

    if (!name) return fail("Player name cannot be empty.");

    let number: number | null;

    try {
      number = parseShirt(draft.number);
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Invalid number.");
    }

    const owner = numberOwner(draft.teamId, number, player.id);

    if (owner) {
      return fail(`#${number} is already worn by ${owner.name}.`);
    }

    if (nameTaken(draft.teamId, name, player.id)) {
      return fail("That player is already in the selected squad.");
    }

    setBusyId(player.id);

    try {
      if (draft.teamId !== player.team_id) {
        const records = await matchRecordCount(player.id);

        if (records.goals > 0 || records.mvps > 0) {
          throw new Error(
            `${player.name} has ${records.goals} goal(s) and ${records.mvps} MVP award(s) on record, so they cannot move to another team.`
          );
        }
      }

      const { data, error } = await supabase
        .from("players")
        .update({ name, number, team_id: draft.teamId })
        .eq("id", player.id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(describeDbError(error, "Failed to update player."));
      }

      setPlayers((current) =>
        current.map((p) => (p.id === player.id ? data : p))
      );
      setEditingId(null);
      ok("Player updated.");
    } catch (err) {
      fail(err instanceof Error ? err.message : "Failed to update player.");
    } finally {
      setBusyId(null);
    }
  }

  async function changePhoto(
    player: Player,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    notify(null);

    const problem = validateImage(file);

    if (problem) return fail(problem);

    setBusyId(player.id);

    try {
      const url = await uploadImage(tournament.id, "players", file);

      const { data, error } = await supabase
        .from("players")
        .update({ photo_url: url })
        .eq("id", player.id)
        .select()
        .single();

      if (error || !data) {
        await removeImageByUrl(url);
        throw new Error(describeDbError(error, "Failed to save photo."));
      }

      await removeImageByUrl(player.photo_url);

      setPlayers((current) =>
        current.map((p) => (p.id === player.id ? data : p))
      );
      ok("Photo updated.");
    } catch (err) {
      fail(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function removePhoto(player: Player) {
    notify(null);
    setBusyId(player.id);

    const { data, error } = await supabase
      .from("players")
      .update({ photo_url: null })
      .eq("id", player.id)
      .select()
      .single();

    setBusyId(null);

    if (error || !data) {
      return fail(describeDbError(error, "Failed to remove photo."));
    }

    await removeImageByUrl(player.photo_url);

    setPlayers((current) =>
      current.map((p) => (p.id === player.id ? data : p))
    );
    ok("Photo removed.");
  }

  async function deletePlayer(player: Player) {
    notify(null);
    setBusyId(player.id);

    try {
      const records = await matchRecordCount(player.id);

      if (records.goals > 0 || records.mvps > 0) {
        throw new Error(
          `${player.name} has ${records.goals} goal(s) and ${records.mvps} MVP award(s) on record, so they cannot be deleted. Edit those matches first.`
        );
      }

      if (!window.confirm(`Delete ${player.name}?`)) return;

      const { error } = await supabase
        .from("players")
        .delete()
        .eq("id", player.id);

      if (error) {
        throw new Error(describeDbError(error, "Failed to delete player."));
      }

      await removeImageByUrl(player.photo_url);

      setPlayers((current) =>
        current.filter((p) => p.id !== player.id)
      );
      ok(`${player.name} deleted.`);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Failed to delete player.");
    } finally {
      setBusyId(null);
    }
  }

  if (teams.length === 0) {
    return (
      <p className="rounded-xl bg-black/20 p-6 text-center text-sm text-gray-500">
        Add a team first, then register its players here.
      </p>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {teams.map((team) => {
          const count = players.filter(
            (p) => p.team_id === team.id
          ).length;

          return (
            <button
              key={team.id}
              onClick={() => {
                setSelectedTeamId(team.id);
                setEditingId(null);
              }}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                team.id === activeTeamId
                  ? "border-emerald-400 bg-emerald-400/10 text-emerald-400"
                  : "border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {team.name}
              <span className="ml-2 text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="grid gap-3 md:grid-cols-[1.6fr_110px_auto_auto]">
          <input
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
            onKeyDown={(e) => e.key === "Enter" && addPlayer()}
            placeholder="Player name"
            className={inputClass}
          />

          <input
            value={form.number}
            onChange={(e) =>
              setForm((f) => ({ ...f, number: e.target.value }))
            }
            onKeyDown={(e) => e.key === "Enter" && addPlayer()}
            type="number"
            min={MIN_SHIRT}
            max={MAX_SHIRT}
            placeholder="#"
            className={inputClass}
          />

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm text-gray-400 hover:text-white">
            <ImagePlus size={16} />
            <span className="max-w-[110px] truncate">
              {photo ? photo.name : "Photo"}
            </span>
            <input
              key={fileKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>

          <button
            onClick={addPlayer}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Add
          </button>
        </div>

        {takenNumbers.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            Numbers in use: {[...takenNumbers].sort((a, b) => a - b).join(", ")}
          </p>
        )}

        <button
          onClick={() => setShowBulk((v) => !v)}
          className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-400"
        >
          {showBulk ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )}
          Paste a squad list
        </button>

        {showBulk && (
          <div className="mt-3 space-y-3">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              placeholder={"One player per line:\n1 Moses Okello\n7 Brian Kato\nSarah Namutebi"}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400"
            />
            <button
              onClick={addBulk}
              disabled={saving}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              Add all to{" "}
              {teams.find((t) => t.id === activeTeamId)?.name}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {roster.length === 0 && (
          <p className="rounded-xl bg-black/20 p-6 text-center text-sm text-gray-500">
            No players in this squad yet.
          </p>
        )}

        {roster.map((player) => {
          const busy = busyId === player.id;

          if (editingId === player.id) {
            return (
              <div
                key={player.id}
                className="grid gap-2 rounded-xl border border-emerald-400/30 bg-black/20 p-3 md:grid-cols-[1.4fr_90px_1fr_auto_auto]"
              >
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  className={inputClass}
                />
                <input
                  value={draft.number}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, number: e.target.value }))
                  }
                  type="number"
                  min={MIN_SHIRT}
                  max={MAX_SHIRT}
                  placeholder="#"
                  className={inputClass}
                />
                <select
                  value={draft.teamId}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, teamId: e.target.value }))
                  }
                  className={inputClass}
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => savePlayer(player)}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-black disabled:opacity-60"
                >
                  <Save size={14} />
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs"
                >
                  Cancel
                </button>
              </div>
            );
          }

          return (
            <div
              key={player.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <Avatar src={player.photo_url} name={player.name} />

              <span className="w-8 text-center text-sm font-black text-emerald-400">
                {player.number === null ? "–" : player.number}
              </span>

              <p className="min-w-0 flex-1 truncate font-semibold">
                {player.name}
              </p>

              {busy && (
                <Loader2
                  size={16}
                  className="animate-spin text-gray-400"
                />
              )}

              <label
                title={player.photo_url ? "Change photo" : "Add photo"}
                className="cursor-pointer rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white"
              >
                <ImagePlus size={15} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(e) => changePhoto(player, e)}
                  className="hidden"
                />
              </label>

              {player.photo_url && (
                <button
                  onClick={() => removePhoto(player)}
                  disabled={busy}
                  title="Remove photo"
                  className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white disabled:opacity-50"
                >
                  <X size={15} />
                </button>
              )}

              <button
                onClick={() => startEdit(player)}
                disabled={busy}
                title="Edit"
                className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white disabled:opacity-50"
              >
                <Pencil size={15} />
              </button>

              <button
                onClick={() => deletePlayer(player)}
                disabled={busy}
                title="Delete"
                className="rounded-lg border border-red-400/20 p-2 text-red-300 hover:bg-red-400/10 disabled:opacity-50"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
