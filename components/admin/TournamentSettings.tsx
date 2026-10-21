"use client";

import { ChangeEvent, useState } from "react";
import { ImagePlus, Loader2, Save, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { describeDbError } from "@/lib/squad";
import {
  compressImage,
  removeImageByUrl,
  uploadImage,
  validateImage,
} from "@/lib/storage";

export type BrandingFields = {
  name: string;
  venue?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
};

type Props = {
  tournamentId: string;
  tournament: BrandingFields;
  onChange: (patch: BrandingFields) => void;
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400";

export default function TournamentSettings({
  tournamentId,
  tournament,
  onChange,
}: Props) {
  const [name, setName] = useState(tournament.name);
  const [venue, setVenue] = useState(tournament.venue ?? "");
  const [startsOn, setStartsOn] = useState(tournament.starts_on ?? "");
  const [endsOn, setEndsOn] = useState(tournament.ends_on ?? "");

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"logo" | "cover" | null>(null);
  const [notice, setNotice] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const fail = (text: string) => setNotice({ type: "error", text });
  const ok = (text: string) => setNotice({ type: "success", text });

  async function saveDetails() {
    setNotice(null);

    const cleanName = name.trim();

    if (!cleanName) return fail("The tournament needs a name.");
    if (venue.length > 120) return fail("The venue is too long (120 characters at most).");
    if (startsOn && endsOn && endsOn < startsOn) {
      return fail("The end date cannot be before the start date.");
    }

    setSaving(true);

    const { error } = await supabase
      .from("tournaments")
      .update({
        name: cleanName,
        venue: venue.trim() || null,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
      })
      .eq("id", tournamentId);

    setSaving(false);

    if (error) return fail(describeDbError(error, "Failed to save."));

    onChange({
      name: cleanName,
      venue: venue.trim() || null,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
    });
    ok("Saved. The public link stays the same.");
  }

  async function changeImage(
    kind: "logo" | "cover",
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setNotice(null);

    const problem = validateImage(file);

    if (problem) return fail(problem);

    setBusy(kind);

    const column = kind === "logo" ? "logo_url" : "cover_url";
    const previous = tournament[column] ?? null;

    try {
      // Stored as a JPEG so share cards can always embed it.
      const prepared = await compressImage(file, kind === "logo" ? 600 : 1600);
      const url = await uploadImage(tournamentId, "branding", prepared);

      const { error } = await supabase
        .from("tournaments")
        .update({ [column]: url })
        .eq("id", tournamentId);

      if (error) {
        await removeImageByUrl(url);
        throw new Error(describeDbError(error, "Failed to save the image."));
      }

      await removeImageByUrl(previous);
      onChange({ name: tournament.name, [column]: url });
      ok(kind === "logo" ? "Logo updated." : "Cover updated.");
    } catch (err) {
      fail(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  async function removeImage(kind: "logo" | "cover") {
    setNotice(null);
    setBusy(kind);

    const column = kind === "logo" ? "logo_url" : "cover_url";
    const previous = tournament[column] ?? null;

    const { error } = await supabase
      .from("tournaments")
      .update({ [column]: null })
      .eq("id", tournamentId);

    setBusy(null);

    if (error) return fail(describeDbError(error, "Failed to remove the image."));

    await removeImageByUrl(previous);
    onChange({ name: tournament.name, [column]: null });
    ok("Removed.");
  }

  const imageRow = (
    kind: "logo" | "cover",
    label: string,
    hint: string,
    url: string | null | undefined
  ) => (
    <div className="flex flex-wrap items-center gap-4 rounded-xl bg-black/20 p-4">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className={`rounded-xl object-cover ${
            kind === "logo" ? "h-16 w-16" : "h-16 w-32"
          }`}
        />
      ) : (
        <div
          className={`flex items-center justify-center rounded-xl bg-white/5 text-xs text-gray-600 ${
            kind === "logo" ? "h-16 w-16" : "h-16 w-32"
          }`}
        >
          None
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>

      {busy === kind && (
        <Loader2 size={16} className="animate-spin text-gray-400" />
      )}

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white">
        <ImagePlus size={14} />
        {url ? "Change" : "Upload"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy !== null}
          onChange={(e) => changeImage(kind, e)}
          className="hidden"
        />
      </label>

      {url && (
        <button
          onClick={() => removeImage(kind)}
          disabled={busy !== null}
          title="Remove"
          className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white disabled:opacity-50"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );

  return (
    <section className="mt-6 space-y-6">
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

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-bold">Tournament details</h2>
        <p className="mt-1 text-sm text-gray-500">
          Shown on the public page and on share cards.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-xs text-gray-500">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs text-gray-500">Venue (optional)</span>
            <input
              value={venue}
              maxLength={120}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. Main Pitch, Makerere"
              className={`${inputClass} mt-1`}
            />
          </label>

          <label className="block">
            <span className="text-xs text-gray-500">Starts (optional)</span>
            <input
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>

          <label className="block">
            <span className="text-xs text-gray-500">Ends (optional)</span>
            <input
              type="date"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>

        <button
          onClick={saveDetails}
          disabled={saving}
          className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Save details
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-bold">Branding</h2>
        <div className="mt-4 space-y-3">
          {imageRow(
            "logo",
            "Logo",
            "Square works best. Shown on the public page and cards.",
            tournament.logo_url
          )}
          {imageRow(
            "cover",
            "Cover image",
            "Wide photo behind the public page header.",
            tournament.cover_url
          )}
        </div>
      </div>
    </section>
  );
}
