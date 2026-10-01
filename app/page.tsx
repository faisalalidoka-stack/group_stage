"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Shield,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { generateRoundRobinSchedule } from "@/lib/algorithms";

const MIN_TEAMS = 3;
const MAX_TEAMS = 16;

export default function HomePage() {
  const router = useRouter();

  const [leagueName, setLeagueName] = useState("");
  const [venue, setVenue] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");

  const [teams, setTeams] = useState<string[]>([
    "",
    "",
    "",
    "",
  ]);

  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user?.email) {
        setAdminEmail(user.email);
      }

      setLoadingAuth(false);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user?.email) {
        setAdminEmail(session.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateTeam = (index: number, value: string) => {
    setTeams((current) =>
      current.map((team, i) => (i === index ? value : team))
    );
  };

  const addTeam = () => {
    if (teams.length >= MAX_TEAMS) return;

    setTeams((current) => [...current, ""]);
  };

  const removeTeam = (index: number) => {
    if (teams.length <= MIN_TEAMS) return;

    setTeams((current) =>
      current.filter((_, i) => i !== index)
    );
  };

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleSignUp = async () => {
    clearMessages();

    if (!adminEmail.trim()) {
      setError("Enter your admin email.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setAuthLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: adminEmail.trim(),
      password,
    });

    setAuthLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (!data.session) {
      setSuccess(
        "Account created. Check your email to confirm your account, then sign in."
      );
      return;
    }

    setUser(data.user);
    setSuccess("Account created successfully.");
  };

  const handleSignIn = async () => {
    clearMessages();

    if (!adminEmail.trim()) {
      setError("Enter your admin email.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    setAuthLoading(true);

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: adminEmail.trim(),
        password,
      });

    setAuthLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setUser(data.user);
    setSuccess("Signed in successfully.");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();

    setUser(null);
    setSuccess("Signed out.");
  };

  const generateSlug = (name: string) => {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const suffix = crypto.randomUUID().slice(0, 4);

    return `${base || "league"}-${suffix}`;
  };

  const handleCreateTournament = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    clearMessages();

    if (!user) {
      setError("Sign in or create an admin account first.");
      return;
    }

    const cleanLeagueName = leagueName.trim();

    if (!cleanLeagueName) {
      setError("Enter a league name.");
      return;
    }

    const cleanTeams = teams
      .map((team) => team.trim())
      .filter(Boolean);

    if (cleanTeams.length < MIN_TEAMS) {
      setError(`You need at least ${MIN_TEAMS} teams.`);
      return;
    }

    if (cleanTeams.length > MAX_TEAMS) {
      setError(`You can have at most ${MAX_TEAMS} teams.`);
      return;
    }

    const normalizedNames = cleanTeams.map((team) =>
      team.toLowerCase()
    );

    if (
      new Set(normalizedNames).size !==
      normalizedNames.length
    ) {
      setError("Team names must be unique.");
      return;
    }

    setCreating(true);

    try {
      const slug = generateSlug(cleanLeagueName);

      // 1. Create tournament
      const { data: tournament, error: tournamentError } =
        await supabase
          .from("tournaments")
          .insert({
            admin_id: user.id,
            name: cleanLeagueName,
            format: "ROUND_ROBIN",
            public_slug: slug,
          })
          .select()
          .single();

      if (tournamentError || !tournament) {
        throw new Error(
          tournamentError?.message ||
            "Failed to create tournament."
        );
      }

      // 2. Create teams
      const teamPayload = cleanTeams.map((name) => ({
        tournament_id: tournament.id,
        name,
      }));

      const { data: createdTeams, error: teamsError } =
        await supabase
          .from("teams")
          .insert(teamPayload)
          .select();

      if (teamsError || !createdTeams) {
        await supabase
          .from("tournaments")
          .delete()
          .eq("id", tournament.id);

        throw new Error(
          teamsError?.message || "Failed to create teams."
        );
      }

      // 3. Generate round-robin fixtures
      const teamIds = createdTeams.map(
        (team) => team.id
      );

      const generatedFixtures =
        generateRoundRobinSchedule(teamIds);

      // 4. Create matches
      const matchPayload = generatedFixtures.map(
        (fixture) => ({
          tournament_id: tournament.id,
          home_team_id: fixture.homeTeamId,
          away_team_id: fixture.awayTeamId,
          home_score: 0,
          away_score: 0,
          status: "SCHEDULED",
          stage: "GROUP",
          round_number: fixture.round,
          location: venue.trim() || null,
        })
      );

      if (matchPayload.length > 0) {
        const { error: matchesError } =
          await supabase
            .from("matches")
            .insert(matchPayload);

        if (matchesError) {
          await supabase
            .from("tournaments")
            .delete()
            .eq("id", tournament.id);

          throw new Error(
            matchesError.message ||
              "Failed to create fixtures."
          );
        }
      }

      setSuccess("Tournament created successfully.");

      router.push(`/admin/${slug}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-black">
              <Trophy size={20} />
            </div>

            <span className="text-lg font-bold">
              BlitzBracket
            </span>
          </div>

          {user && (
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-300">
            <Shield size={15} />
            Built for campus & community football
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            Instant Football Leagues
            <span className="block text-emerald-400">
              for Campus & Community
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-400 sm:text-lg">
            Create your tournament, generate fixtures,
            manage live scores and share the public league
            page with everyone.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              "Zero Login for Players",
              "Pitchside Live Scores",
              "1-Tap WhatsApp Share",
            ].map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-300"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Creator */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Form */}
          <form
            onSubmit={handleCreateTournament}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
          >
            <div className="mb-7">
              <h2 className="text-2xl font-bold">
                Create your league
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Set up your teams and fixtures in under a
                minute.
              </p>
            </div>

            <div className="space-y-6">
              {/* League name */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  League name
                </label>

                <input
                  value={leagueName}
                  onChange={(e) =>
                    setLeagueName(e.target.value)
                  }
                  placeholder="e.g. Block C Campus Cup"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-gray-600 focus:border-emerald-400"
                />
              </div>

              {/* Format */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Format
                </label>

                <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Check
                        size={18}
                        className="text-emerald-400"
                      />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        Single Round Robin
                      </p>

                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        Every team plays every other team
                        once.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Teams */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">
                    Teams
                  </label>

                  <span className="text-xs text-gray-500">
                    {teams.length}/{MAX_TEAMS}
                  </span>
                </div>

                <div className="space-y-3">
                  {teams.map((team, index) => (
                    <div
                      key={index}
                      className="flex gap-2"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-sm font-bold text-gray-500">
                        {index + 1}
                      </div>

                      <input
                        value={team}
                        onChange={(e) =>
                          updateTeam(
                            index,
                            e.target.value
                          )
                        }
                        placeholder={`Team ${index + 1}`}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-gray-600 focus:border-emerald-400"
                      />

                      {teams.length > MIN_TEAMS && (
                        <button
                          type="button"
                          onClick={() =>
                            removeTeam(index)
                          }
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-gray-500 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-400"
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {teams.length < MAX_TEAMS && (
                  <button
                    type="button"
                    onClick={addTeam}
                    className="mt-3 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-400/10"
                  >
                    <Plus size={17} />
                    Add team
                  </button>
                )}
              </div>

              {/* Venue */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Default venue{" "}
                  <span className="text-gray-600">
                    (optional)
                  </span>
                </label>

                <input
                  value={venue}
                  onChange={(e) =>
                    setVenue(e.target.value)
                  }
                  placeholder="e.g. Makerere Main Grounds"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-gray-600 focus:border-emerald-400"
                />
              </div>

              {/* Admin access */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Users
                    size={18}
                    className="text-emerald-400"
                  />

                  <div>
                    <p className="text-sm font-semibold">
                      Admin access
                    </p>

                    <p className="text-xs text-gray-500">
                      Required to manage your league.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) =>
                      setAdminEmail(e.target.value)
                    }
                    placeholder="Admin email"
                    disabled={!!user}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-gray-600 focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  />

                  {!user && (
                    <>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) =>
                          setPassword(e.target.value)
                        }
                        placeholder="Password"
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-gray-600 focus:border-emerald-400"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleSignIn}
                          disabled={
                            authLoading ||
                            loadingAuth
                          }
                          className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/5 disabled:opacity-50"
                        >
                          {authLoading ? (
                            <Loader2
                              size={17}
                              className="mx-auto animate-spin"
                            />
                          ) : (
                            "Sign in"
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleSignUp}
                          disabled={
                            authLoading ||
                            loadingAuth
                          }
                          className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
                        >
                          Create account
                        </button>
                      </div>
                    </>
                  )}

                  {user && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
                      <Check size={15} />
                      Admin account connected
                    </div>
                  )}
                </div>
              </div>

              {/* Messages */}
              {error && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                  {success}
                </div>
              )}

              {/* Create */}
              <button
                type="submit"
                disabled={creating || !user}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creating ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                    Creating league...
                  </>
                ) : (
                  <>
                    Create Tournament
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Side information */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                <Trophy size={22} />
              </div>

              <h3 className="text-lg font-bold">
                Everything starts here
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Your tournament automatically gets its
                fixtures and a public page that players
                and spectators can access without logging
                in.
              </p>

              <div className="mt-6 space-y-4">
                {[
                  "Automatic round-robin fixtures",
                  "Live score management",
                  "League standings",
                  "Goal scorer leaderboards",
                  "MVP tracking",
                  "Public spectator page",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-sm text-gray-300"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400">
                      <Check size={13} />
                    </div>

                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-400/10 to-transparent p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Fixture engine
              </p>

              <p className="mt-2 text-2xl font-black">
                No manual scheduling
              </p>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Add the teams and BlitzBracket generates
                the round-robin match schedule automatically.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}