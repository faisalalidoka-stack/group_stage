"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type GalleryImage = {
  id: string;
  tournament_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
};

type GalleryManagerProps = {
  tournamentId: string;
};

export default function GalleryManager({
  tournamentId,
}: GalleryManagerProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadImages() {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
        setImages([]);
      } else {
        setImages(data ?? []);
      }

      setLoading(false);
    }

    void loadImages();

    return () => {
      active = false;
    };
  }, [tournamentId]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setSuccess("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Only JPG, PNG, and WebP images are allowed."
      );
      event.target.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setError("Image must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearSelectedFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    setSelectedFile(null);
    setCaption("");

    const input = document.getElementById(
      "gallery-upload"
    ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError("Select an image first.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const extension =
        selectedFile.name.split(".").pop()?.toLowerCase() ||
        "jpg";

      const safeName = selectedFile.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .slice(0, 60);

      const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const filePath = `${tournamentId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("league-gallery")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedFile.type,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("league-gallery")
        .getPublicUrl(filePath);

      const { data: galleryImage, error: insertError } =
        await supabase
          .from("gallery_images")
          .insert({
            tournament_id: tournamentId,
            image_url: publicUrl,
            caption: caption.trim() || null,
          })
          .select()
          .single();

      if (insertError) {
        await supabase.storage
          .from("league-gallery")
          .remove([filePath]);

        throw new Error(insertError.message);
      }

      setImages((current) => [
        galleryImage,
        ...current,
      ]);

      clearSelectedFile();

      setSuccess("Image uploaded successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload image."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(image: GalleryImage) {
    const confirmed = window.confirm(
      "Delete this gallery image?"
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(image.id);
    setError("");
    setSuccess("");

    try {
      const marker = "/league-gallery/";

      const markerIndex = image.image_url.indexOf(marker);

      if (markerIndex === -1) {
        throw new Error(
          "Could not determine the stored image path."
        );
      }

      const filePath = image.image_url.slice(
        markerIndex + marker.length
      );

      const { error: storageError } =
        await supabase.storage
          .from("league-gallery")
          .remove([filePath]);

      if (storageError) {
        throw new Error(storageError.message);
      }

      const { error: deleteError } = await supabase
        .from("gallery_images")
        .delete()
        .eq("id", image.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setImages((current) =>
        current.filter(
          (item) => item.id !== image.id
        )
      );

      setSuccess("Image deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete image."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-6">
      {/* Upload */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
            <ImageIcon size={21} />
          </div>

          <div>
            <h2 className="font-bold">
              Tournament Gallery
            </h2>

            <p className="text-xs text-gray-500">
              Upload photos from your tournament.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* File picker */}
          <div>
            <label
              htmlFor="gallery-upload"
              className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 px-6 py-8 text-center transition hover:border-emerald-400/40 hover:bg-white/[0.03]"
            >
              <Upload
                size={28}
                className="text-emerald-400"
              />

              <p className="mt-3 font-semibold">
                Choose a photo
              </p>

              <p className="mt-1 text-xs text-gray-500">
                JPG, PNG or WebP · Maximum 5 MB
              </p>

              <input
                id="gallery-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {selectedFile && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {selectedFile.name}
                  </p>

                  <p className="text-xs text-gray-500">
                    {(
                      selectedFile.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearSelectedFile}
                  className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white"
                >
                  <X size={17} />
                </button>
              </div>
            )}
          </div>

          {/* Preview + caption */}
          <div>
            {previewUrl ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <img
                  src={previewUrl}
                  alt="Selected gallery preview"
                  className="h-48 w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-gray-600">
                <ImageIcon size={36} />
              </div>
            )}

            <textarea
              value={caption}
              onChange={(event) =>
                setCaption(event.target.value)
              }
              placeholder="Caption (optional)"
              rows={3}
              className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-gray-600 focus:border-emerald-400"
            />

            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading ? (
                <>
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={17} />
                  Upload Photo
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              Uploaded Photos
            </h2>

            <p className="text-xs text-gray-500">
              {images.length} photo
              {images.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-gray-500">
            <Loader2
              size={22}
              className="mr-3 animate-spin"
            />
            Loading gallery...
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <ImageIcon
              size={36}
              className="mx-auto text-gray-700"
            />

            <p className="mt-4 font-semibold text-gray-400">
              No photos yet
            </p>

            <p className="mt-1 text-sm text-gray-600">
              Upload your first tournament photo above.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <div
                key={image.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <div className="relative aspect-[4/3] bg-black/30">
                  <img
                    src={image.image_url}
                    alt={
                      image.caption ||
                      "Tournament gallery image"
                    }
                    className="h-full w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(image)
                    }
                    disabled={
                      deletingId === image.id
                    }
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition hover:bg-red-500 disabled:opacity-50"
                    title="Delete image"
                  >
                    {deletingId === image.id ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>

                {image.caption && (
                  <div className="px-4 py-3">
                    <p className="text-sm text-gray-300">
                      {image.caption}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}