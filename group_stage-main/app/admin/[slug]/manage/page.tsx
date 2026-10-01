"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, ImagePlus, Loader2, Pencil, Save, Trash2, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tournament = { id: string; name: string; public_slug: string; admin_id: string };
type Team = { id: string; tournament_id: string; name: string; logo_url: string | null };
type Player = { id: string; team_id: string; name: string; number: number | null };
type GalleryImage = { id: string; tournament_id: string; image_url: string; caption: string | null; created_at: string };

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ManageTournamentPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [teamName, setTeamName] = useState("");
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [teamDraft, setTeamDraft] = useState({ name: "", logoUrl: "" });

  const [playerDraft, setPlayerDraft] = useState({ teamId: "", name: "", number: "" });
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editPlayerDraft, setEditPlayerDraft] = useState({ teamId: "", name: "", number: "" });

  const [caption, setCaption] = useState("");

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  useEffect(() => { load(); }, [slug]);

  function message(errorMessage = "", successMessage = "") {
    setError(errorMessage); setSuccess(successMessage);
  }

  async function load() {
    setLoading(true); message();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      const { data: t, error: te } = await supabase.from("tournaments")
        .select("id,name,public_slug,admin_id").eq("public_slug", slug).single();
      if (te || !t) throw new Error(te?.message || "Tournament not found.");
      if (t.admin_id !== user.id) throw new Error("You are not authorized to manage this tournament.");
      setTournament(t);

      const [tr, pr, gr] = await Promise.all([
        supabase.from("teams").select("*").eq("tournament_id", t.id).order("name"),
        supabase.from("players").select("*").order("team_id").order("number"),
        supabase.from("gallery_images").select("*").eq("tournament_id", t.id).order("created_at", { ascending: false }),
      ]);
      if (tr.error) throw new Error(tr.error.message);
      if (pr.error) throw new Error(pr.error.message);
      if (gr.error) throw new Error(gr.error.message);
      setTeams(tr.data ?? []); setPlayers(pr.data ?? []); setGallery(gr.data ?? []);
      if (!playerDraft.teamId && tr.data?.[0]) setPlayerDraft((x) => ({ ...x, teamId: tr.data[0].id }));
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load."); }
    finally { setLoading(false); }
  }

  async function addTeam() {
    if (!tournament) return; message(); const name = teamName.trim();
    if (!name) return setError("Enter a team name.");
    if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) return setError("That team already exists.");
    setSaving(true);
    try {
      const { data, error: e } = await supabase.from("teams").insert({ tournament_id: tournament.id, name }).select().single();
      if (e || !data) throw new Error(e?.message || "Failed to add team.");
      setTeams((x) => [...x, data].sort((a, b) => a.name.localeCompare(b.name))); setTeamName("");
      if (!playerDraft.teamId) setPlayerDraft((x) => ({ ...x, teamId: data.id })); message("", "Team added.");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to add team."); }
    finally { setSaving(false); }
  }

  function startTeamEdit(t: Team) { message(); setEditingTeam(t.id); setTeamDraft({ name: t.name, logoUrl: t.logo_url ?? "" }); }

  async function saveTeam(id: string) {
    const name = teamDraft.name.trim(); if (!name) return setError("Team name cannot be empty.");
    setSaving(true); message();
    try {
      const { data, error: e } = await supabase.from("teams").update({ name, logo_url: teamDraft.logoUrl.trim() || null }).eq("id", id).select().single();
      if (e || !data) throw new Error(e?.message || "Failed to update team.");
      setTeams((x) => x.map((t) => t.id === id ? data : t).sort((a, b) => a.name.localeCompare(b.name))); setEditingTeam(null); message("", "Team updated.");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to update team."); }
    finally { setSaving(false); }
  }

  async function deleteTeam(t: Team) {
    message();
    if (players.some((p) => p.team_id === t.id)) return setError("Remove the team's players before deleting it.");
    const { count, error: e } = await supabase.from("matches").select("id", { count: "exact", head: true }).or(`home_team_id.eq.${t.id},away_team_id.eq.${t.id}`);
    if (e) return setError(e.message); if ((count ?? 0) > 0) return setError("This team already has fixtures and cannot be deleted.");
    if (!window.confirm(`Delete ${t.name}?`)) return;
    setSaving(true);
    try { const { error: de } = await supabase.from("teams").delete().eq("id", t.id); if (de) throw new Error(de.message); setTeams((x) => x.filter((v) => v.id !== t.id)); message("", "Team deleted."); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to delete team."); }
    finally { setSaving(false); }
  }

  function playerPayload(d: typeof playerDraft) {
    const name = d.name.trim(); if (!d.teamId) throw new Error("Select a team."); if (!name) throw new Error("Enter the player's name.");
    const number = d.number.trim() ? Number(d.number) : null;
    if (number !== null && (!Number.isInteger(number) || number < 0 || number > 99)) throw new Error("Player number must be between 0 and 99.");
    return { team_id: d.teamId, name, number };
  }

  async function addPlayer() {
    setSaving(true); message();
    try {
      const payload = playerPayload(playerDraft);
      if (players.some((p) => p.team_id === payload.team_id && p.name.toLowerCase() === payload.name.toLowerCase())) throw new Error("That player already exists in this team.");
      const { data, error: e } = await supabase.from("players").insert(payload).select().single();
      if (e || !data) throw new Error(e?.message || "Failed to add player.");
      setPlayers((x) => [...x, data]); setPlayerDraft({ teamId: playerDraft.teamId, name: "", number: "" }); message("", "Player added.");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to add player."); }
    finally { setSaving(false); }
  }

  function startPlayerEdit(p: Player) { message(); setEditingPlayer(p.id); setEditPlayerDraft({ teamId: p.team_id, name: p.name, number: p.number === null ? "" : String(p.number) }); }

  async function savePlayer(id: string) {
    setSaving(true); message();
    try {
      const payload = playerPayload(editPlayerDraft);
      const { data, error: e } = await supabase.from("players").update(payload).eq("id", id).select().single();
      if (e || !data) throw new Error(e?.message || "Failed to update player.");
      setPlayers((x) => x.map((p) => p.id === id ? data : p)); setEditingPlayer(null); message("", "Player updated.");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to update player."); }
    finally { setSaving(false); }
  }

  async function deletePlayer(p: Player) {
    if (!window.confirm(`Delete ${p.name}?`)) return; setSaving(true); message();
    try { const { error: e } = await supabase.from("players").delete().eq("id", p.id); if (e) throw new Error(e.message); setPlayers((x) => x.filter((v) => v.id !== p.id)); message("", "Player deleted."); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to delete player."); }
    finally { setSaving(false); }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    if (!tournament) return; const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; message();
    if (!IMAGE_TYPES.includes(file.type)) return setError("Use JPG, PNG, or WebP images only.");
    if (file.size > MAX_IMAGE_SIZE) return setError("Image must be 8 MB or smaller.");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"; const path = `${tournament.id}/${crypto.randomUUID()}.${ext}`;
      const { error: ue } = await supabase.storage.from("league-gallery").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (ue) throw new Error(ue.message);
      const { data: url } = supabase.storage.from("league-gallery").getPublicUrl(path);
      const { data, error: ie } = await supabase.from("gallery_images").insert({ tournament_id: tournament.id, image_url: url.publicUrl, caption: caption.trim() || null }).select().single();
      if (ie || !data) { await supabase.storage.from("league-gallery").remove([path]); throw new Error(ie?.message || "Failed to save gallery image."); }
      setGallery((x) => [data, ...x]); setCaption(""); message("", "Photo added to the gallery.");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to upload image."); }
    finally { setUploading(false); }
  }

  async function deleteImage(image: GalleryImage) {
    if (!window.confirm("Remove this gallery photo?")) return; setSaving(true); message();
    try {
      const marker = "/storage/v1/object/public/league-gallery/"; const index = image.image_url.indexOf(marker);
      if (index >= 0) { const path = decodeURIComponent(image.image_url.slice(index + marker.length)); const { error: se } = await supabase.storage.from("league-gallery").remove([path]); if (se) throw new Error(se.message); }
      const { error: de } = await supabase.from("gallery_images").delete().eq("id", image.id); if (de) throw new Error(de.message);
      setGallery((x) => x.filter((v) => v.id !== image.id)); message("", "Gallery photo removed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to delete photo."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-white"><Loader2 className="animate-spin" /> <span className="ml-2">Loading management...</span></main>;
  if (!tournament) return <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-white"><div className="rounded-2xl bg-red-400/10 p-6">{error || "Tournament unavailable."}</div></main>;

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <header className="border-b border-white/10"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div><button onClick={() => router.push(`/admin/${slug}`)} className="mb-2 flex items-center gap-2 text-sm text-gray-500 hover:text-white"><ArrowLeft size={15}/> Back to dashboard</button><h1 className="text-2xl font-black">Manage Tournament</h1><p className="text-sm text-gray-500">{tournament.name}</p></div>
        <button onClick={() => router.push(`/t/${slug}`)} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black">View League</button>
      </div></header>

      <section className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
        {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">{success}</div>}

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2"><Users className="text-emerald-400" size={19}/><h2 className="text-xl font-bold">Teams</h2></div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="New team name" className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm"/><button onClick={addTeam} disabled={saving} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black">+ Add Team</button></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">{teams.map((t) => <div key={t.id} className="rounded-xl border border-white/10 bg-black/20 p-4">{editingTeam === t.id ? <div className="space-y-3"><input value={teamDraft.name} onChange={(e) => setTeamDraft((x) => ({...x,name:e.target.value}))} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm"/><input value={teamDraft.logoUrl} onChange={(e) => setTeamDraft((x) => ({...x,logoUrl:e.target.value}))} placeholder="Logo URL (optional)" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm"/><div className="flex gap-2"><button onClick={() => saveTeam(t.id)} disabled={saving} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black"><Save size={14}/>Save</button><button onClick={() => setEditingTeam(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Cancel</button></div></div> : <div className="flex items-center justify-between"><div><p className="font-bold">{t.name}</p><p className="text-xs text-gray-500">{players.filter((p) => p.team_id === t.id).length} players</p></div><div className="flex gap-2"><button onClick={() => startTeamEdit(t)} className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white"><Pencil size={15}/></button><button onClick={() => deleteTeam(t)} disabled={saving} className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-red-400"><Trash2 size={15}/></button></div></div>}</div>)}</div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2"><Users className="text-emerald-400" size={19}/><h2 className="text-xl font-bold">Players</h2></div>
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1.4fr_120px_auto]"><select value={playerDraft.teamId} onChange={(e) => setPlayerDraft((x) => ({...x,teamId:e.target.value}))} className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm"><option value="">Select team</option>{teams.map((t)=><option key={t.id} value={t.id}>{t.name}</option>)}</select><input value={playerDraft.name} onChange={(e)=>setPlayerDraft((x)=>({...x,name:e.target.value}))} placeholder="Player name" className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm"/><input value={playerDraft.number} onChange={(e)=>setPlayerDraft((x)=>({...x,number:e.target.value}))} type="number" min="0" max="99" placeholder="#" className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm"/><button onClick={addPlayer} disabled={saving} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black">+ Add Player</button></div>
          <div className="mt-5 space-y-2">{players.map((p)=><div key={p.id} className="rounded-xl border border-white/10 bg-black/20 p-3">{editingPlayer === p.id ? <div className="grid gap-2 md:grid-cols-[1fr_1.4fr_100px_auto_auto]"><select value={editPlayerDraft.teamId} onChange={(e)=>setEditPlayerDraft((x)=>({...x,teamId:e.target.value}))} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">{teams.map((t)=><option key={t.id} value={t.id}>{t.name}</option>)}</select><input value={editPlayerDraft.name} onChange={(e)=>setEditPlayerDraft((x)=>({...x,name:e.target.value}))} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"/><input value={editPlayerDraft.number} onChange={(e)=>setEditPlayerDraft((x)=>({...x,number:e.target.value}))} type="number" min="0" max="99" className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"/><button onClick={()=>savePlayer(p.id)} disabled={saving} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black">Save</button><button onClick={()=>setEditingPlayer(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Cancel</button></div> : <div className="flex items-center justify-between"><div><p className="font-semibold">{p.name}</p><p className="text-xs text-gray-500">{teamMap.get(p.team_id)?.name ?? "Unknown team"}{p.number !== null ? ` · #${p.number}` : ""}</p></div><div className="flex gap-2"><button onClick={()=>startPlayerEdit(p)} className="rounded-lg border border-white/10 p-2 text-gray-400"><Pencil size={15}/></button><button onClick={()=>deletePlayer(p)} disabled={saving} className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-red-400"><Trash2 size={15}/></button></div></div>}</div>)}</div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2"><Camera className="text-emerald-400" size={19}/><h2 className="text-xl font-bold">Gallery</h2></div><p className="mt-1 text-sm text-gray-500">Upload match-day photos for the public tournament page.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]"><input value={caption} onChange={(e)=>setCaption(e.target.value)} placeholder="Caption (optional)" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm"/><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black"><ImagePlus size={17}/>{uploading ? "Uploading..." : "Upload Photo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={uploading} className="hidden"/></label></div><p className="mt-2 text-xs text-gray-600">JPG, PNG or WebP · maximum 8 MB</p>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{gallery.map((image)=><div key={image.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20"><img src={image.image_url} alt={image.caption ?? "Tournament photo"} className="aspect-square w-full object-cover"/><div className="flex items-center justify-between gap-2 p-3"><p className="truncate text-xs text-gray-400">{image.caption || "Tournament photo"}</p><button onClick={()=>deleteImage(image)} disabled={saving} className="text-gray-500 hover:text-red-400"><Trash2 size={14}/></button></div></div>)}{gallery.length===0&&<p className="col-span-full rounded-xl bg-black/20 p-5 text-sm text-gray-500">No gallery photos yet.</p>}</div>
        </section>
      </section>
    </main>
  );
}
