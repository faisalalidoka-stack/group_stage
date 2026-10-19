"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { uploadRegistrationPhoto, validateImage } from "@/lib/storage";

type LinkInfo = {
  valid: boolean;
  reason: "not_found" | "revoked" | "expired" | "full" | null;
  tournament_name?: string;
  team_name?: string;
  expires_at?: string;
  remaining?: number | null;
  taken_numbers?: number[];
};

type Row = {
  key: string;
  name: string;
  number: string;
  photo: File | null;
};

const MAX_ROWS = 30;

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400";

const reasonText: Record<string, string> = {
  not_found: "This registration link is not valid. Check that you copied the whole link.",
  revoked: "This registration link has been closed by the organiser.",
  expired: "This registration link has expired. Ask the organiser for a new one.",
  full: "This link has reached its player limit. Ask the organiser if you need more spots.",
};

function newRow(): Row {
  return { key: crypto.randomUUID(), name: "", number: "", photo: null };
}

export default function RegisterPage() {
  const { token } = useParams<{ token: string }>();

  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [submittedBy, setSubmittedBy] = useState("");
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentCount, setSentCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error: rpcError } = await supabase.rpc(
        "get_registration_link",
        { p_token: token }
      );

      if (!active) return;

      setInfo(
        rpcError || !data
          ? { valid: false, reason: "not_found" }
          : (data as LinkInfo)
      );
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [token, sentCount]);

  function updateRow(key: string, changes: Partial<Row>) {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, ...changes } : row
      )
    );
  }

  async function handleSubmit() {
    setError("");

    const taken = new Set(info?.taken_numbers ?? []);
    const seenNumbers = new Set<number>();
    const seenNames = new Set<string>();

    const prepared: { row: Row; name: string; number: number }[] = [];

    for (const [index, row] of rows.entries()) {
      const label = `Player ${index + 1}`;
      const name = row.name.trim();

      if (!name) return setError(`${label}: enter a name.`);
      if (name.length > 80) return setError(`${label}: name is too long.`);

      if (!row.number.trim()) {
        return setError(`${label}: enter a shirt number.`);
      }

      const number = Number(row.number);

      if (!Number.isInteger(number) || number < 0 || number > 99) {
        return setError(`${label}: shirt number must be from 0 to 99.`);
      }

      if (taken.has(number)) {
        return setError(`${label}: shirt number ${number} is already taken.`);
      }

      if (seenNumbers.has(number)) {
        return setError(`Shirt number ${number} is used twice.`);
      }

      if (seenNames.has(name.toLowerCase())) {
        return setError(`${name} is listed twice.`);
      }

      if (row.photo) {
        const problem = validateImage(row.photo);
        if (problem) return setError(`${label}: ${problem}`);
      }

      seenNumbers.add(number);
      seenNames.add(name.toLowerCase());
      prepared.push({ row, name, number });
    }

    if (
      typeof info?.remaining === "number" &&
      prepared.length > info.remaining
    ) {
      return setError(
        `This link only has ${info.remaining} spot(s) left. Remove ${
          prepared.length - info.remaining
        } player(s).`
      );
    }

    setSending(true);

    try {
      const players = [];

      for (const item of prepared) {
        const photoUrl = item.row.photo
          ? await uploadRegistrationPhoto(token, item.row.photo)
          : null;

        players.push({
          name: item.name,
          number: item.number,
          photo_url: photoUrl,
        });
      }

      const { data, error: rpcError } = await supabase.rpc(
        "submit_registration",
        {
          p_token: token,
          p_submitted_by: submittedBy.trim() || null,
          p_players: players,
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      setRows([newRow()]);
      setSentCount(typeof data === "number" ? data : prepared.length);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Submission failed. Try again."
      );
    } finally {
      setSending(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-[#07090d] px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-black">
            <Trophy size={19} />
          </div>
          <span className="font-bold">Group Stage</span>
        </div>
        {children}
      </div>
    </main>
  );

  if (loading) {
    return shell(
      <div className="flex items-center gap-3 text-gray-400">
        <Loader2 size={20} className="animate-spin" />
        Checking link...
      </div>
    );
  }

  if (!info?.valid) {
    return shell(
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h1 className="text-xl font-bold">Registration unavailable</h1>
        <p className="mt-2 text-sm text-gray-400">
          {reasonText[info?.reason ?? "not_found"]}
        </p>
      </div>
    );
  }

  if (sentCount !== null) {
    return shell(
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-6 text-center">
        <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
        <h1 className="mt-4 text-xl font-bold">
          {sentCount} player{sentCount === 1 ? "" : "s"} submitted
        </h1>
        <p className="mt-2 text-sm text-gray-300">
          The organiser will review them. They appear on the squad once
          approved.
        </p>

        {info.remaining !== 0 && (
          <button
            onClick={() => setSentCount(null)}
            className="mt-6 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:bg-emerald-400"
          >
            Add more players
          </button>
        )}
      </div>
    );
  }

  const deadline = info.expires_at
    ? new Date(info.expires_at).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  return shell(
    <>
      <p className="text-sm text-gray-500">{info.tournament_name}</p>
      <h1 className="text-3xl font-black">{info.team_name}</h1>
      <p className="mt-1 text-sm text-gray-400">
        Register your players. Open until {deadline}
        {typeof info.remaining === "number"
          ? ` · ${info.remaining} spot${info.remaining === 1 ? "" : "s"} left`
          : ""}
        .
      </p>

      {(info.taken_numbers?.length ?? 0) > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          Numbers already taken:{" "}
          {(info.taken_numbers ?? []).join(", ")}
        </p>
      )}

      <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        {error && (
          <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <label className="block">
          <span className="text-xs text-gray-500">
            Your name (optional)
          </span>
          <input
            value={submittedBy}
            onChange={(e) => setSubmittedBy(e.target.value)}
            maxLength={80}
            className={`${inputClass} mt-1`}
          />
        </label>

        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_80px] gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_80px_auto_auto]"
            >
              <input
                value={row.name}
                onChange={(e) =>
                  updateRow(row.key, { name: e.target.value })
                }
                maxLength={80}
                placeholder={`Player ${index + 1} name`}
                className={inputClass}
              />

              <input
                value={row.number}
                onChange={(e) =>
                  updateRow(row.key, { number: e.target.value })
                }
                type="number"
                min={0}
                max={99}
                placeholder="#"
                className={inputClass}
              />

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm text-gray-400 hover:text-white">
                <ImagePlus size={16} />
                <span className="max-w-[90px] truncate">
                  {row.photo ? row.photo.name : "Photo"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    updateRow(row.key, {
                      photo: e.target.files?.[0] ?? null,
                    })
                  }
                  className="hidden"
                />
              </label>

              <button
                onClick={() =>
                  setRows((current) =>
                    current.length > 1
                      ? current.filter((r) => r.key !== row.key)
                      : current
                  )
                }
                disabled={rows.length === 1}
                title="Remove"
                className="flex items-center justify-center rounded-xl border border-white/10 px-3 text-gray-500 hover:text-red-300 disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setRows((current) => [...current, newRow()])}
          disabled={rows.length >= MAX_ROWS}
          className="flex items-center gap-2 text-sm font-semibold text-emerald-400 disabled:opacity-40"
        >
          <Plus size={16} />
          Add another player
        </button>

        <button
          onClick={handleSubmit}
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
        >
          {sending && <Loader2 size={16} className="animate-spin" />}
          Submit {rows.length} player{rows.length === 1 ? "" : "s"} for approval
        </button>
      </div>
    </>
  );
}
