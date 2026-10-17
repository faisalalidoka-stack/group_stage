"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  Plus,
  Settings,
  Trash2,
  Trophy,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/lib/useRequireUser";

type TournamentRow = {
  id: string;
  name: string;
  public_slug: string;
  created_at: string;
  archived_at: string | null;
};

type Stats = {
  teams: number;
  matches: number;
  finished: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireUser();

  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const [pendingDelete, setPendingDelete] =
    useState<TournamentRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const adminId = user?.id;

  useEffect(() => {
    if (!adminId) return;

    async function load() {
      const { data, error: loadError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("admin_id", adminId)
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as TournamentRow[];
      setTournaments(rows);

      if (rows.length > 0) {
        const ids = rows.map((row) => row.id);

        const [teamsResult, matchesResult] = await Promise.all([
          supabase
            .from("teams")
            .select("tournament_id")
            .in("tournament_id", ids),
          supabase
            .from("matches")
            .select("tournament_id, status")
            .in("tournament_id", ids),
        ]);

        const next: Record<string, Stats> = {};

        for (const id of ids) {
          next[id] = { teams: 0, matches: 0, finished: 0 };
        }

        for (const team of teamsResult.data ?? []) {
          next[team.tournament_id].teams += 1;
        }

        for (const match of matchesResult.data ?? []) {
          next[match.tournament_id].matches += 1;
          if (match.status === "FINISHED") {
            next[match.tournament_id].finished += 1;
          }
        }

        setStats(next);
      }

      setLoading(false);
    }

    void load();
  }, [adminId]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  async function copyLink(row: TournamentRow) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/t/${row.public_slug}`
    );
    setSuccess(`Link for "${row.name}" copied.`);
    setError("");
  }

  async function setArchived(row: TournamentRow, archived: boolean) {
    setBusyId(row.id);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("tournaments")
      .update({
        archived_at: archived ? new Date().toISOString() : null,
      })
      .eq("id", row.id);

    setBusyId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setTournaments((current) =>
      current.map((item) =>
        item.id === row.id
          ? {
              ...item,
              archived_at: archived ? new Date().toISOString() : null,
            }
          : item
      )
    );

    setSuccess(
      archived
        ? `"${row.name}" archived.`
        : `"${row.name}" restored.`
    );
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    const row = pendingDelete;

    setBusyId(row.id);
    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase.rpc(
      "delete_tournament",
      { p_id: row.id }
    );

    setBusyId(null);
    setPendingDelete(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setTournaments((current) =>
      current.filter((item) => item.id !== row.id)
    );

    setSuccess(`"${row.name}" deleted.`);
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-white">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin" />
          Loading your tournaments...
        </div>
      </main>
    );
  }

  const visible = tournaments.filter((row) =>
    showArchived ? row.archived_at : !row.archived_at
  );

  const archivedCount = tournaments.filter(
    (row) => row.archived_at
  ).length;

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-black">
              <Trophy size={19} />
            </div>
            <span className="font-bold">Group Stage</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:block">
              {user?.email}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/5"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black">My Tournaments</h1>
            <p className="mt-1 text-sm text-gray-500">
              One account, every competition.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard/new")}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:bg-emerald-400"
          >
            <Plus size={17} />
            New tournament
          </button>
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
            {success}
          </p>
        )}

        <div className="mt-6 flex gap-1 border-b border-white/10">
          <button
            onClick={() => setShowArchived(false)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${
              !showArchived
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-gray-500"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${
              showArchived
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-gray-500"
            }`}
          >
            Archived{archivedCount > 0 ? ` (${archivedCount})` : ""}
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-gray-500">
            {showArchived
              ? "No archived tournaments."
              : "You have no tournaments yet. Create your first one."}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {visible.map((row) => {
              const s = stats[row.id] ?? {
                teams: 0,
                matches: 0,
                finished: 0,
              };
              const busy = busyId === row.id;

              return (
                <div
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <h2 className="text-lg font-bold">{row.name}</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Created{" "}
                    {new Date(row.created_at).toLocaleDateString([], {
                      dateStyle: "medium",
                    })}
                  </p>

                  <div className="mt-4 flex gap-6 text-sm">
                    <div>
                      <p className="text-gray-500">Teams</p>
                      <p className="font-bold">{s.teams}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Played</p>
                      <p className="font-bold">
                        {s.finished}/{s.matches}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        router.push(`/admin/${row.public_slug}`)
                      }
                      className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400"
                    >
                      <Settings size={15} />
                      Manage
                    </button>

                    <button
                      onClick={() =>
                        router.push(`/t/${row.public_slug}`)
                      }
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/5"
                    >
                      <ExternalLink size={15} />
                      Public page
                    </button>

                    <button
                      onClick={() => copyLink(row)}
                      title="Copy public link"
                      className="rounded-xl border border-white/10 p-2 hover:bg-white/5"
                    >
                      <Copy size={16} />
                    </button>

                    <button
                      onClick={() =>
                        setArchived(row, !row.archived_at)
                      }
                      disabled={busy}
                      title={row.archived_at ? "Restore" : "Archive"}
                      className="rounded-xl border border-white/10 p-2 hover:bg-white/5 disabled:opacity-50"
                    >
                      {row.archived_at ? (
                        <ArchiveRestore size={16} />
                      ) : (
                        <Archive size={16} />
                      )}
                    </button>

                    <button
                      onClick={() => setPendingDelete(row)}
                      disabled={busy}
                      title="Delete"
                      className="rounded-xl border border-red-400/20 p-2 text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1117] p-6">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold">Delete tournament?</h2>
              <button
                onClick={() => setPendingDelete(null)}
                className="text-gray-500 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-400">
              <span className="font-semibold text-white">
                {pendingDelete.name}
              </span>{" "}
              and all of its teams, players, fixtures, goals and gallery
              records will be permanently deleted. The public link will
              stop working. Consider archiving instead.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white hover:bg-red-400"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
