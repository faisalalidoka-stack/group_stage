import { supabase } from "@/lib/supabase";

// Reuses the existing public bucket. Storage policies require the first
// path segment to be the tournament id, so every file lives under
// <tournamentId>/<folder>/<uuid>.<ext>
export const BUCKET = "league-gallery";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return "Use a JPG, PNG or WebP image.";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be 5 MB or smaller.";
  }

  return null;
}

export async function uploadImage(
  tournamentId: string,
  folder: "players" | "teams",
  file: File
): Promise<string> {
  const problem = validateImage(file);

  if (problem) throw new Error(problem);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${tournamentId}/${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) throw new Error(error.message);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Best effort: a leftover file is harmless, so failures are ignored. */
export async function removeImageByUrl(url: string | null | undefined) {
  if (!url) return;

  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);

  if (index < 0) return;

  const path = decodeURIComponent(url.slice(index + marker.length));

  await supabase.storage.from(BUCKET).remove([path]);
}
