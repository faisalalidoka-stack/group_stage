"use client";

import {
  Dispatch,
  SetStateAction,
  useEffect,
  useState,
} from "react";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { describeDbError, type Player, type Team } from "@/lib/squad";
import {
  VALIDITY_OPTIONS,
  linkState,
  registrationUrl,
  slotsUsed,
  type LinkState,
  type RegistrationLink,
  type Submission,
  type SubmissionStatus,
} from "@/lib/registration";
import { removeImageByUrl } from "@/lib/storage";
import Avatar from "./Avatar";

type Props = {
  tournamentId: string;
  tournamentName: string;
  teams: Team[];
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  onPendingChange?: (count: number) => void;
};

const stateStyle: Record<LinkState, string> = {
  active: "bg-emerald-400/10 text-emerald-400",
  expired: "bg-amber-400/10 text-amber-300",
  revoked: "bg-red-400/10 text-red-300",
  full: "bg-sky-400/10 text-sky-300",
};

const inputClass =
  "rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400";

export default function RegistrationManager({
  tournamentId,
  tournamentName,
  teams,
  setPlayers,
  onPendingChange,
}: Props) {
  const [links, setLinks] = useState<RegistrationLink[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [teamId, setTeamId] = useState("");
  const [hours, setHours] = useState(168);
  const [maxPlayers, setMaxPlayers] = useState("");

  const [filter, setFilter] = useState<SubmissionStatus>("PENDING");
  const [numberEdits, setNumberEdits] = useState<Record<string, string>>({});

  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const fail = (text: string) => setNotice({ type: "error", text });
  const ok = (text: string) => setNotice({ type: "success", text });

  useEffect(() => {
    let active = true;

    async function load() {
      const [linksResult, subsResult] = await Promise.all([
        supabase
          .from("team_registration_links")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("player_registration_submissions")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("submitted_at", { ascending: false }),
      ]);

      if (!active) return;

      if (linksResult.error || subsResult.error) {
        setNotice({
          type: "error",
          text:
            (linksResult.error ?? subsResult.error)?.message ??
            "Failed to load registrations. Have you run supabase/phase3.sql?",
        });
      } else {
        setLinks((linksResult.data ?? []) as RegistrationLink[]);
        setSubmissions((subsResult.data ?? []) as Submission[]);
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [tournamentId, reloadKey]);

  const pendingCount = submissions.filter(
    (s) => s.status === "PENDING"
  ).length;

  useEffect(() => {
    onPendingChange?.(pendingCount);
  }, [pendingCount, onPendingChange]);

  const activeTeamId = teams.some((t) => t.id === teamId)
    ? teamId
    : (teams[0]?.id ?? "");

  const teamName = (id: string) =>
    teams.find((t) => t.id === id)?.name ?? "Unknown team";

  async function createLink() {
    setNotice(null);

    if (!activeTeamId) return fail("Add a team first.");

    let max: number | null = null;

    if (maxPlayers.trim()) {
      max = Number(maxPlayers);

      if (!Number.isInteger(max) || max < 1 || max > 100) {
        return fail("The player limit must be a whole number from 1 to 100.");
      }
    }

    setBusyId("create");

    const { data, error } = await supabase.rpc(
      "create_registration_link",
      {
        p_tournament_id: tournamentId,
        p_team_id: activeTeamId,
        p_expires_at: new Date(
          Date.now() + hours * 3600 * 1000
        ).toISOString(),
        p_max: max,
      }
    );

    setBusyId(null);

    if (error || !data) {
      return fail(describeDbError(error, "Failed to create link."));
    }

    setLinks((current) => [data as RegistrationLink, ...current]);
    setMaxPlayers("");
    ok("Link created. Copy it or share it on WhatsApp.");
  }

  async function copyLink(link: RegistrationLink) {
    await navigator.clipboard.writeText(
      registrationUrl(link.token, window.location.origin)
    );
    ok("Registration link copied.");
  }

  function whatsappUrl(link: RegistrationLink) {
    const url = registrationUrl(link.token, window.location.origin);
    const deadline = new Date(link.expires_at).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const text = `Register the ${teamName(link.team_id)} squad for ${tournamentName}. Add your players here before ${deadline}: ${url}`;

    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  async function updateLink(
    link: RegistrationLink,
    changes: Partial<RegistrationLink>,
    message: string
  ) {
    setNotice(null);
    setBusyId(link.id);

    const { data, error } = await supabase
      .from("team_registration_links")
      .update(changes)
      .eq("id", link.id)
      .select()
      .single();

    setBusyId(null);

    if (error || !data) {
      return fail(describeDbError(error, "Failed to update link."));
    }

    setLinks((current) =>
      current.map((l) => (l.id === link.id ? (data as RegistrationLink) : l))
    );
    ok(message);
  }

  function revoke(link: RegistrationLink) {
    if (
      !window.confirm(
        "Revoke this link? Nobody will be able to use it to submit players."
      )
    ) {
      return;
    }

    void updateLink(
      link,
      { revoked_at: new Date().toISOString() },
      "Link revoked."
    );
  }

  function extend(link: RegistrationLink) {
    const base = Math.max(Date.now(), new Date(link.expires_at).getTime());

    void updateLink(
      link,
      { expires_at: new Date(base + 7 * 24 * 3600 * 1000).toISOString() },
      "Link extended by 7 days."
    );
  }

  async function deleteLink(link: RegistrationLink) {
    if (
      !window.confirm(
        "Delete this link? Submissions already received are kept."
      )
    ) {
      return;
    }

    setNotice(null);
    setBusyId(link.id);

    const { error } = await supabase
      .from("team_registration_links")
      .delete()
      .eq("id", link.id);

    setBusyId(null);

    if (error) return fail(describeDbError(error, "Failed to delete link."));

    setLinks((current) => current.filter((l) => l.id !== link.id));
    setSubmissions((current) =>
      current.map((s) =>
        s.link_id === link.id ? { ...s, link_id: null } : s
      )
    );
    ok("Link deleted.");
  }

  async function review(
    submission: Submission,
    approve: boolean
  ): Promise<boolean> {
    const edited = numberEdits[submission.id];
    const number = edited !== undefined && edited !== ""
      ? Number(edited)
      : null;

    if (
      approve &&
      number !== null &&
      (!Number.isInteger(number) || number < 0 || number > 99)
    ) {
      fail("Shirt number must be a whole number from 0 to 99.");
      return false;
    }

    setBusyId(submission.id);

    const { data, error } = await supabase.rpc("review_submission", {
      p_id: submission.id,
      p_approve: approve,
      p_number: approve ? number : null,
    });

    setBusyId(null);

    if (error) {
      fail(describeDbError(error, "Failed to review submission."));
      return false;
    }

    setSubmissions((current) =>
      current.map((s) =>
        s.id === submission.id
          ? {
              ...s,
              status: approve ? "APPROVED" : "REJECTED",
              number: approve && number !== null ? number : s.number,
              reviewed_at: new Date().toISOString(),
            }
          : s
      )
    );

    if (approve && data && (data as Player).id) {
      setPlayers((current) => [...current, data as Player]);
    }

    if (!approve) {
      await removeImageByUrl(submission.photo_url);
    }

    return true;
  }

  async function approveAll() {
    setNotice(null);

    const pending = submissions.filter((s) => s.status === "PENDING");

    if (
      pending.length === 0 ||
      !window.confirm(`Approve all ${pending.length} pending players?`)
    ) {
      return;
    }

    let approved = 0;

    for (const submission of pending) {
      const done = await review(submission, true);

      if (!done) {
        return fail(
          `Stopped after ${approved} approval(s). Fix the problem above, then continue.`
        );
      }

      approved += 1;
    }

    ok(`${approved} player(s) approved and added to their squads.`);
  }

  const visible = submissions.filter((s) => s.status === filter);

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-3 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        Loading registrations...
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-8">
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

      {/* Create link */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2">
          <Link2 size={18} className="text-emerald-400" />
          <h2 className="text-lg font-bold">Registration links</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Give a team captain a link to submit their players. Nothing becomes
          official until you approve it.
        </p>

        {teams.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Add a team first.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
            <select
              value={activeTeamId}
              onChange={(e) => setTeamId(e.target.value)}
              className={inputClass}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className={inputClass}
            >
              {VALIDITY_OPTIONS.map((option) => (
                <option key={option.hours} value={option.hours}>
                  Valid for {option.label}
                </option>
              ))}
            </select>

            <input
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              type="number"
              min={1}
              max={100}
              placeholder="Player limit (optional)"
              className={inputClass}
            />

            <button
              onClick={createLink}
              disabled={busyId === "create"}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              {busyId === "create" && (
                <Loader2 size={16} className="animate-spin" />
              )}
              Create link
            </button>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {links.length === 0 && (
            <p className="rounded-xl bg-black/20 p-5 text-center text-sm text-gray-500">
              No links yet.
            </p>
          )}

          {links.map((link) => {
            const used = slotsUsed(link, submissions);
            const state = linkState(link, used);
            const busy = busyId === link.id;

            return (
              <div
                key={link.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-bold">{teamName(link.team_id)}</p>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${stateStyle[state]}`}
                  >
                    {state}
                  </span>

                  <p className="text-xs text-gray-500">
                    {used}
                    {link.max_submissions !== null
                      ? ` / ${link.max_submissions}`
                      : ""}{" "}
                    submitted · expires{" "}
                    {new Date(link.expires_at).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>

                  {busy && (
                    <Loader2
                      size={15}
                      className="animate-spin text-gray-400"
                    />
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => copyLink(link)}
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5"
                  >
                    <Copy size={14} />
                    Copy link
                  </button>

                  <a
                    href={whatsappUrl(link)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5"
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </a>

                  <button
                    onClick={() => extend(link)}
                    disabled={busy || state === "revoked"}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5 disabled:opacity-40"
                  >
                    Extend 7 days
                  </button>

                  {link.revoked_at ? (
                    <button
                      onClick={() =>
                        updateLink(
                          link,
                          { revoked_at: null },
                          "Link reactivated."
                        )
                      }
                      disabled={busy}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5 disabled:opacity-40"
                    >
                      Reactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => revoke(link)}
                      disabled={busy}
                      className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-40"
                    >
                      Revoke
                    </button>
                  )}

                  <button
                    onClick={() => deleteLink(link)}
                    disabled={busy}
                    title="Delete link"
                    className="ml-auto rounded-lg border border-white/10 p-2 text-gray-500 hover:text-red-300 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submissions */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Submissions</h2>

          <div className="flex gap-2">
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              title="Refresh"
              className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white"
            >
              <RefreshCw size={15} />
            </button>

            {filter === "PENDING" && pendingCount > 1 && (
              <button
                onClick={approveAll}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400"
              >
                Approve all ({pendingCount})
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-1 border-b border-white/10">
          {(["PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold capitalize ${
                filter === status
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-gray-500"
              }`}
            >
              {status.toLowerCase()}
              <span className="ml-2 text-xs opacity-70">
                {submissions.filter((s) => s.status === status).length}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {visible.length === 0 && (
            <p className="rounded-xl bg-black/20 p-5 text-center text-sm text-gray-500">
              Nothing here.
            </p>
          )}

          {visible.map((submission) => {
            const busy = busyId === submission.id;

            return (
              <div
                key={submission.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <Avatar src={submission.photo_url} name={submission.name} />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{submission.name}</p>
                  <p className="text-xs text-gray-500">
                    {teamName(submission.team_id)}
                    {submission.submitted_by
                      ? ` · by ${submission.submitted_by}`
                      : ""}{" "}
                    ·{" "}
                    {new Date(submission.submitted_at).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>

                {submission.status === "PENDING" ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={numberEdits[submission.id] ?? submission.number}
                      onChange={(e) =>
                        setNumberEdits((current) => ({
                          ...current,
                          [submission.id]: e.target.value,
                        }))
                      }
                      title="Shirt number (editable before approving)"
                      className="w-20 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-center text-sm outline-none focus:border-emerald-400"
                    />

                    <button
                      onClick={() => review(submission, true)}
                      disabled={busy}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      Approve
                    </button>

                    <button
                      onClick={() => review(submission, false)}
                      disabled={busy}
                      className="flex items-center gap-1 rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-400/10 disabled:opacity-60"
                    >
                      <X size={14} />
                      Reject
                    </button>
                  </>
                ) : (
                  <span className="text-sm font-black text-emerald-400">
                    #{submission.number}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
