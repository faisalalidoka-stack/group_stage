"use client";

import { useState } from "react";
import {
  Eraser,
  Loader2,
  Save,
  Send,
  Trash2,
  Undo2,
  Wand2,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import {
  FORMATIONS,
  DEFAULT_FORMATION,
  MAX_SUBS,
  autoFill,
  buildSlots,
  remapStarters,
  type MatchSize,
} from "@/lib/formations";
import {
  GOALKEEPER_KIT,
  kitFor,
  type LineupPlayerRow,
  type LineupRow,
} from "@/lib/lineups";
import { describeDbError, type Player, type Team } from "@/lib/squad";
import Pitch, { type PitchGhost, type PitchMarker } from "./Pitch";

type Props = {
  matchId: string;
  matchSize: MatchSize;
  team: Team;
  side: "home" | "away";
  opponentName: string;
  /** This team's squad only. */
  players: Player[];
  lineup: LineupRow | null;
  lineupPlayers: LineupPlayerRow[];
  onSaved: (lineup: LineupRow, rows: LineupPlayerRow[]) => void;
  onDeleted: (lineupId: string) => void;
};

type Notice = { type: "error" | "success"; text: string } | null;

function signature(
  formation: string,
  assignments: Record<number, string>,
  subs: string[]
) {
  const starters = Object.entries(assignments)
    .map(([slot, id]) => `${slot}:${id}`)
    .sort()
    .join(",");

  return `${formation}|${starters}|${subs.join(",")}`;
}

export default function LineupEditor({
  matchId,
  matchSize,
  team,
  side,
  opponentName,
  players,
  lineup,
  lineupPlayers,
  onSaved,
  onDeleted,
}: Props) {
  const initialFormation =
    lineup && FORMATIONS[matchSize].includes(lineup.formation)
      ? lineup.formation
      : DEFAULT_FORMATION[matchSize];

  const [formation, setFormation] = useState(initialFormation);

  const [assignments, setAssignments] = useState<Record<number, string>>(
    () => {
      const result: Record<number, string> = {};

      for (const row of lineupPlayers) {
        if (row.role === "STARTER" && row.slot !== null) {
          result[row.slot] = row.player_id;
        }
      }

      return result;
    }
  );

  const [subs, setSubs] = useState<string[]>(() =>
    lineupPlayers
      .filter((row) => row.role === "SUB")
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => row.player_id)
  );

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | "delete" | null>(
    null
  );
  const [notice, setNotice] = useState<Notice>(null);

  const fail = (text: string) => setNotice({ type: "error", text });
  const ok = (text: string) => setNotice({ type: "success", text });

  const slots = buildSlots(formation);
  const kit = kitFor(team, side);

  const roster = [...players].sort(
    (a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name)
  );
  const byId = new Map(roster.map((p) => [p.id, p]));

  const slotOf = (playerId: string) => {
    const entry = Object.entries(assignments).find(([, id]) => id === playerId);
    return entry ? Number(entry[0]) : null;
  };

  const starterCount = Object.keys(assignments).length;
  const isPublished = lineup?.status === "PUBLISHED";

  const savedSignature = lineup
    ? signature(
        lineup.formation,
        Object.fromEntries(
          lineupPlayers
            .filter((r) => r.role === "STARTER" && r.slot !== null)
            .map((r) => [r.slot as number, r.player_id])
        ),
        lineupPlayers
          .filter((r) => r.role === "SUB")
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((r) => r.player_id)
      )
    : signature(initialFormation, {}, []);

  const dirty = signature(formation, assignments, subs) !== savedSignature;

  function assignToSlot(slotIndex: number, playerId: string) {
    setAssignments((previous) => {
      const next = { ...previous };
      const occupant = next[slotIndex];
      const oldSlotEntry = Object.entries(next).find(
        ([, id]) => id === playerId
      );

      if (oldSlotEntry) {
        const oldSlot = Number(oldSlotEntry[0]);

        if (occupant) next[oldSlot] = occupant;
        else delete next[oldSlot];
      }

      next[slotIndex] = playerId;

      return next;
    });

    setSubs((previous) => previous.filter((id) => id !== playerId));
  }

  function clickSlot(slotIndex: number) {
    setNotice(null);

    if (selectedSlot === null) {
      setSelectedSlot(slotIndex);
      return;
    }

    if (selectedSlot === slotIndex) {
      setSelectedSlot(null);
      return;
    }

    // Two slots chosen in turn: swap their players.
    setAssignments((previous) => {
      const next = { ...previous };
      const a = next[selectedSlot];
      const b = next[slotIndex];

      if (b) next[selectedSlot] = b;
      else delete next[selectedSlot];

      if (a) next[slotIndex] = a;
      else delete next[slotIndex];

      return next;
    });

    setSelectedSlot(null);
  }

  function clickPlayer(player: Player) {
    setNotice(null);

    if (selectedSlot !== null) {
      assignToSlot(selectedSlot, player.id);
      setSelectedSlot(null);
      return;
    }

    const slot = slotOf(player.id);

    if (slot !== null) {
      setSelectedSlot(slot);
      return;
    }

    if (subs.includes(player.id)) {
      setSubs((previous) => previous.filter((id) => id !== player.id));
      return;
    }

    if (subs.length >= MAX_SUBS) {
      fail(`A lineup can have at most ${MAX_SUBS} substitutes.`);
      return;
    }

    setSubs((previous) => [...previous, player.id]);
  }

  function removeFromSlot() {
    if (selectedSlot === null) return;

    setAssignments((previous) => {
      const next = { ...previous };
      delete next[selectedSlot];
      return next;
    });

    setSelectedSlot(null);
  }

  function changeFormation(next: string) {
    if (next === formation) return;

    setAssignments((previous) => remapStarters(formation, next, previous));
    setFormation(next);
    setSelectedSlot(null);
    setNotice(null);
  }

  function runAutoFill() {
    setNotice(null);

    const free = roster.filter((p) => !subs.includes(p.id));

    setAssignments((previous) =>
      autoFill(
        formation,
        previous,
        free.map((p) => ({
          id: p.id,
          number: p.number,
          preferred: p.preferred_position ?? null,
        }))
      )
    );
  }

  function clearAll() {
    setAssignments({});
    setSubs([]);
    setSelectedSlot(null);
    setNotice(null);
  }

  async function save(publish: boolean) {
    setNotice(null);

    if (publish && starterCount !== matchSize) {
      return fail(
        `Publishing needs a full starting ${matchSize}. You have ${starterCount}.`
      );
    }

    setSaving(publish ? "publish" : "draft");

    const { data, error } = await supabase.rpc("save_lineup", {
      p_match_id: matchId,
      p_team_id: team.id,
      p_formation: formation,
      p_starters: slots
        .filter((slot) => assignments[slot.index])
        .map((slot) => ({
          player_id: assignments[slot.index],
          slot: slot.index,
          position: slot.role,
        })),
      p_subs: subs.map((id) => ({ player_id: id })),
      p_publish: publish,
    });

    setSaving(null);

    if (error || !data) {
      return fail(describeDbError(error, "Failed to save lineup."));
    }

    const result = data as { lineup: LineupRow; players: LineupPlayerRow[] };

    onSaved(result.lineup, result.players);
    ok(
      publish
        ? "Lineup published. It is now visible on the public page."
        : "Lineup saved as a draft (not public)."
    );
  }

  async function deleteLineup() {
    if (!lineup) return;

    if (!window.confirm(`Delete ${team.name}'s lineup for this match?`)) {
      return;
    }

    setSaving("delete");

    const { error } = await supabase
      .from("lineups")
      .delete()
      .eq("id", lineup.id);

    setSaving(null);

    if (error) return fail(describeDbError(error, "Failed to delete lineup."));

    onDeleted(lineup.id);
    clearAll();
    ok("Lineup deleted.");
  }

  const markers: PitchMarker[] = [];
  const ghosts: PitchGhost[] = [];

  for (const slot of slots) {
    const playerId = assignments[slot.index];
    const player = playerId ? byId.get(playerId) : undefined;

    if (player) {
      markers.push({
        key: `slot-${slot.index}`,
        x: slot.x,
        y: slot.y,
        name: player.name,
        number: player.number,
        kit: slot.role === "GK" ? GOALKEEPER_KIT : kit,
        selected: selectedSlot === slot.index,
        onClick: () => clickSlot(slot.index),
      });
    } else {
      ghosts.push({
        key: `slot-${slot.index}`,
        x: slot.x,
        y: slot.y,
        label: slot.role,
        selected: selectedSlot === slot.index,
        onClick: () => clickSlot(slot.index),
      });
    }
  }

  const selectedPlayer =
    selectedSlot !== null && assignments[selectedSlot]
      ? byId.get(assignments[selectedSlot])
      : undefined;

  const busy = saving !== null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          {FORMATIONS[matchSize].map((option) => (
            <button
              key={option}
              onClick={() => changeFormation(option)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                option === formation
                  ? "border-emerald-400 bg-emerald-400/10 text-emerald-400"
                  : "border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <Pitch
          markers={markers}
          ghosts={ghosts}
          label={`${team.name} lineup, ${formation}`}
        />

        <p className="mt-3 text-xs text-gray-500">
          Tap an empty spot, then a player. Tap two spots in turn to swap them.
          Tap a player in the squad with no spot selected to add or remove a
          substitute.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              isPublished
                ? "bg-emerald-400/10 text-emerald-400"
                : lineup
                  ? "bg-amber-400/10 text-amber-300"
                  : "bg-white/5 text-gray-400"
            }`}
          >
            {isPublished ? "Published" : lineup ? "Draft" : "Not saved"}
          </span>

          {dirty && (
            <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs font-bold text-sky-300">
              Unsaved changes
            </span>
          )}

          <span className="text-sm text-gray-400">
            {team.name} vs {opponentName} · {starterCount}/{matchSize} starters
            · {subs.length}/{MAX_SUBS} subs
          </span>
        </div>

        {notice && (
          <p
            className={`rounded-xl border px-4 py-3 text-sm ${
              notice.type === "error"
                ? "border-red-400/20 bg-red-400/10 text-red-300"
                : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
            }`}
          >
            {notice.text}
          </p>
        )}

        {selectedSlot !== null && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm">
            <span className="text-amber-200">
              {selectedPlayer
                ? `${selectedPlayer.name} selected. Choose a player to replace them, or another spot to swap.`
                : "Spot selected. Choose a player from the squad."}
            </span>

            {selectedPlayer && (
              <button
                onClick={removeFromSlot}
                className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5"
              >
                <X size={13} />
                Remove from spot
              </button>
            )}

            <button
              onClick={() => setSelectedSlot(null)}
              className="text-xs font-semibold text-amber-200 underline"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={runAutoFill}
            disabled={busy || roster.length === 0}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5 disabled:opacity-50"
          >
            <Wand2 size={14} />
            Auto-fill
          </button>

          <button
            onClick={clearAll}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5 disabled:opacity-50"
          >
            <Eraser size={14} />
            Clear
          </button>

          {lineup && (
            <button
              onClick={deleteLineup}
              disabled={busy}
              className="ml-auto flex items-center gap-2 rounded-lg border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-50"
            >
              {saving === "delete" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Delete lineup
            </button>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20">
          <p className="border-b border-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            {team.name} squad ({roster.length})
          </p>

          {roster.length === 0 && (
            <p className="p-4 text-sm text-gray-500">
              This team has no players yet. Add them in the Teams tab.
            </p>
          )}

          <ul className="max-h-[420px] divide-y divide-white/5 overflow-y-auto">
            {roster.map((player) => {
              const slot = slotOf(player.id);
              const subIndex = subs.indexOf(player.id);
              const slotRole =
                slot !== null ? slots.find((s) => s.index === slot)?.role : null;

              return (
                <li key={player.id}>
                  <button
                    onClick={() => clickPlayer(player)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.04]"
                  >
                    <span className="w-7 text-center text-sm font-black text-emerald-400">
                      {player.number ?? "–"}
                    </span>

                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {player.name}
                      {player.preferred_position && (
                        <span className="ml-2 text-xs font-medium text-gray-500">
                          {player.preferred_position}
                        </span>
                      )}
                    </span>

                    {slot !== null ? (
                      <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-bold text-emerald-400">
                        Starting · {slotRole}
                      </span>
                    ) : subIndex >= 0 ? (
                      <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-xs font-bold text-sky-300">
                        Sub {subIndex + 1}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">Not selected</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          {isPublished ? (
            <>
              <button
                onClick={() => save(true)}
                disabled={busy || starterCount !== matchSize}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving === "publish" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Update published lineup
              </button>

              <button
                onClick={() => save(false)}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-bold hover:bg-white/5 disabled:opacity-50"
              >
                {saving === "draft" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Undo2 size={16} />
                )}
                Unpublish
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => save(false)}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-bold hover:bg-white/5 disabled:opacity-50"
              >
                {saving === "draft" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save draft
              </button>

              <button
                onClick={() => save(true)}
                disabled={busy || starterCount !== matchSize}
                title={
                  starterCount !== matchSize
                    ? `Fill all ${matchSize} starting spots to publish`
                    : undefined
                }
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving === "publish" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Publish
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
