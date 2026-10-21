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
  folder: "players" | "teams" | "branding",
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

export const REGISTRATION_BUCKET = "registration-photos";

/** Best effort: a leftover file is harmless, so failures are ignored. */
export async function removeImageByUrl(url: string | null | undefined) {
  if (!url) return;

  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);

  if (!match) return;

  const [, bucket, path] = match;

  if (bucket !== BUCKET && bucket !== REGISTRATION_BUCKET) return;

  await supabase.storage.from(bucket).remove([decodeURIComponent(path)]);
}

/** Shrinks a phone photo to a small JPEG so uploads stay fast and under the limit. */
export async function compressImage(
  file: File,
  maxSide = 800
): Promise<File> {
  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Could not read that image. Use a JPG or PNG photo.");
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");

  if (!context) throw new Error("Could not process that image.");

  // JPEG has no transparency: put a white background behind transparent PNGs.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );

  if (!blob) throw new Error("Could not process that image.");

  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

/** Used by the public registration page. The token authorises the upload. */
export async function uploadRegistrationPhoto(
  token: string,
  file: File
): Promise<string> {
  const compressed = await compressImage(file);
  const path = `${token}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from(REGISTRATION_BUCKET)
    .upload(path, compressed, {
      cacheControl: "3600",
      upsert: false,
      contentType: "image/jpeg",
    });

  if (error) throw new Error(error.message);

  return supabase.storage
    .from(REGISTRATION_BUCKET)
    .getPublicUrl(path).data.publicUrl;
}
