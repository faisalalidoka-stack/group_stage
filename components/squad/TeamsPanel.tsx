"use client";

import {
  ChangeEvent,
  Dispatch,
  SetStateAction,
  useState,
} from "react";
import {
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
  describeDbError,
  sortTeams,
  type Notice,
  type Player,
  type Team,
} from "@/lib/squad";
import {
  removeImageByUrl,
  uploadImage,
  validateImage,
} from "@/lib/storage";
import Avatar from "./Avatar";

type TeamsPanelProps = {
  tournamentId: string;
  teams: Team[];
  players: Player[];
  setTeams: Dispatch<SetStateAction<Team[]>>;
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  notify: (notice: Notice) => void;
};

export default function TeamsPanel({
  tournamentId,
  teams,
  players,
  setTeams,
  setPlayers,
  notify,
}: TeamsPanelProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [kits, setKits] = useState<
    Record<string, { p: string; s: string }>
  >({});

  const fail = (text: string) => notify({ type: "error", text });
  const ok = (text: string) => notify({ type: "success", text });

  const kitValue = (team: Team) =>
    kits[team.id] ?? {
      p: team.primary_color ?? "#ffffff",
      s: team.secondary_color ?? "#0f172a",
    };

  async function saveKit(team: Team, clear = false) {
    notify(null);
    setBusyId(team.id);

    const kit = kitValue(team);

    const { data, error } = await supabase
      .from("teams")
      .update({
        primary_color: clear ? null : kit.p,
        secondary_color: clear ? null : kit.s,
      })
      .eq("id", team.id)
      .select()
      .single();

    setBusyId(null);

    if (error || !data) {
      return fail(describeDbError(error, "Failed to save kit colours."));
    }

    setTeams((current) =>
      current.map((t) => (t.id === team.id ? data : t))
    );
    setKits((current) => {
      const next = { ...current };
      delete next[team.id];
      return next;
    });
    ok(clear ? "Kit colours cleared." : "Kit colours saved.");
  }

  function nameTaken(name: string, ignoreId?: string) {
    return teams.some(
      (team) =>
        team.id !== ignoreId &&
        team.name.toLowerCase() === name.toLowerCase()
    );
  }

  async function addTeam() {
    notify(null);

    const name = newName.trim();

    if (!name) return fail("Enter a team name.");
    if (nameTaken(name)) return fail("That team already exists.");

    setBusyId("new");

    const { data, error } = await supabase
      .from("teams")
      .insert({ tournament_id: tournamentId, name })
      .select()
      .single();

    setBusyId(null);

    if (error || !data) {
      return fail(describeDbError(error, "Failed to add team."));
    }

    setTeams((current) => sortTeams([...current, data]));
    setNewName("");
    ok(
      `${name} added. Teams added after the tournament was created do not get fixtures automatically.`
    );
  }

  function startEdit(team: Team) {
    notify(null);
    setEditingId(team.id);
    setDraftName(team.name);
  }

  async function saveTeam(team: Team) {
    notify(null);

    const name = draftName.trim();

    if (!name) return fail("Team name cannot be empty.");
    if (nameTaken(name, team.id)) {
      return fail("Another team already uses that name.");
    }

    setBusyId(team.id);

    const { data, error } = await supabase
      .from("teams")
      .update({ name })
      .eq("id", team.id)
      .select()
      .single();

    setBusyId(null);

    if (error || !data) {
      return fail(describeDbError(error, "Failed to update team."));
    }

    setTeams((current) =>
      sortTeams(current.map((t) => (t.id === team.id ? data : t)))
    );
    setEditingId(null);
    ok("Team updated.");
  }

  async function changeLogo(
    team: Team,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    notify(null);

    const problem = validateImage(file);

    if (problem) return fail(problem);

    setBusyId(team.id);

    try {
      const url = await uploadImage(tournamentId, "teams", file);

      const { data, error } = await supabase
        .from("teams")
        .update({ logo_url: url })
        .eq("id", team.id)
        .select()
        .single();

      if (error || !data) {
        await removeImageByUrl(url);
        throw new Error(describeDbError(error, "Failed to save logo."));
      }

      await removeImageByUrl(team.logo_url);

      setTeams((current) =>
        current.map((t) => (t.id === team.id ? data : t))
      );
      ok("Crest updated.");
    } catch (err) {
      fail(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeLogo(team: Team) {
    notify(null);
    setBusyId(team.id);

    const { data, error } = await supabase
      .from("teams")
      .update({ logo_url: null })
      .eq("id", team.id)
      .select()
      .single();

    setBusyId(null);

    if (error || !data) {
      return fail(describeDbError(error, "Failed to remove crest."));
    }

    await removeImageByUrl(team.logo_url);

    setTeams((current) =>
      current.map((t) => (t.id === team.id ? data : t))
    );
    ok("Crest removed.");
  }

  async function deleteTeam(team: Team) {
    notify(null);
    setBusyId(team.id);

    // Never delete a team that fixtures or results depend on.
    const { count, error: countError } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`);

    if (countError) {
      setBusyId(null);
      return fail(countError.message);
    }

    if ((count ?? 0) > 0) {
      setBusyId(null);
      return fail(
        `${team.name} has ${count} fixture(s) on record, so it cannot be deleted.`
      );
    }

    const roster = players.filter((p) => p.team_id === team.id);

    const confirmed = window.confirm(
      roster.length > 0
        ? `Delete ${team.name} and its ${roster.length} player(s)? This cannot be undone.`
        : `Delete ${team.name}?`
    );

    if (!confirmed) {
      setBusyId(null);
      return;
    }

    if (roster.length > 0) {
      const { error: playersError } = await supabase
        .from("players")
        .delete()
        .eq("team_id", team.id);

      if (playersError) {
        setBusyId(null);
        return fail(
          describeDbError(playersError, "Failed to remove players.")
        );
      }
    }

    const { error: teamError } = await supabase
      .from("teams")
      .delete()
      .eq("id", team.id);

    setBusyId(null);

    if (teamError) {
      return fail(describeDbError(teamError, "Failed to delete team."));
    }

    await Promise.all([
      removeImageByUrl(team.logo_url),
      ...roster.map((p) => removeImageByUrl(p.photo_url)),
    ]);

    setPlayers((current) =>
      current.filter((p) => p.team_id !== team.id)
    );
    setTeams((current) => current.filter((t) => t.id !== team.id));
    ok(`${team.name} deleted.`);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTeam()}
          placeholder="New team name"
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-400"
        />
        <button
          onClick={addTeam}
          disabled={busyId === "new"}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
        >
          {busyId === "new" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          Add team
        </button>
      </div>

      {teams.length === 0 && (
        <p className="rounded-xl bg-black/20 p-6 text-center text-sm text-gray-500">
          No teams yet.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => {
          const count = players.filter(
            (p) => p.team_id === team.id
          ).length;
          const busy = busyId === team.id;

          return (
            <div
              key={team.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={team.logo_url}
                  name={team.name}
                  size={52}
                  square
                />

                <div className="min-w-0 flex-1">
                  {editingId === team.id ? (
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && saveTeam(team)
                      }
                      autoFocus
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    />
                  ) : (
                    <>
                      <p className="truncate font-bold">{team.name}</p>
                      <p className="text-xs text-gray-500">
                        {count} player{count === 1 ? "" : "s"}
                      </p>
                    </>
                  )}
                </div>

                {busy && (
                  <Loader2
                    size={16}
                    className="animate-spin text-gray-400"
                  />
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5">
                <span
                  className="h-7 w-7 shrink-0 rounded-full"
                  style={{
                    background: kitValue(team).p,
                    border: `3px solid ${kitValue(team).s}`,
                  }}
                />

                <label className="flex items-center gap-2 text-xs text-gray-400">
                  Shirt
                  <input
                    type="color"
                    value={kitValue(team).p}
                    disabled={busy}
                    onChange={(e) =>
                      setKits((current) => ({
                        ...current,
                        [team.id]: { ...kitValue(team), p: e.target.value },
                      }))
                    }
                    className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent"
                  />
                </label>

                <label className="flex items-center gap-2 text-xs text-gray-400">
                  Trim
                  <input
                    type="color"
                    value={kitValue(team).s}
                    disabled={busy}
                    onChange={(e) =>
                      setKits((current) => ({
                        ...current,
                        [team.id]: { ...kitValue(team), s: e.target.value },
                      }))
                    }
                    className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent"
                  />
                </label>

                {kits[team.id] && (
                  <button
                    onClick={() => saveKit(team)}
                    disabled={busy}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black disabled:opacity-60"
                  >
                    Save colours
                  </button>
                )}

                {!kits[team.id] && team.primary_color && (
                  <button
                    onClick={() => saveKit(team, true)}
                    disabled={busy}
                    className="text-xs text-gray-500 underline hover:text-white disabled:opacity-60"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {editingId === team.id ? (
                  <>
                    <button
                      onClick={() => saveTeam(team)}
                      disabled={busy}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black disabled:opacity-60"
                    >
                      <Save size={14} />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(team)}
                      disabled={busy}
                      title="Rename"
                      className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white disabled:opacity-50"
                    >
                      <Pencil size={15} />
                    </button>

                    <label
                      title="Upload crest"
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white"
                    >
                      <ImagePlus size={14} />
                      {team.logo_url ? "Change crest" : "Add crest"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy}
                        onChange={(e) => changeLogo(team, e)}
                        className="hidden"
                      />
                    </label>

                    {team.logo_url && (
                      <button
                        onClick={() => removeLogo(team)}
                        disabled={busy}
                        title="Remove crest"
                        className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white disabled:opacity-50"
                      >
                        <X size={15} />
                      </button>
                    )}

                    <button
                      onClick={() => deleteTeam(team)}
                      disabled={busy}
                      title="Delete team"
                      className="ml-auto rounded-lg border border-red-400/20 p-2 text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
