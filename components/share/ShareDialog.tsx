"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import ShareBar, { type ShareDownload } from "./ShareBar";

type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  previewHref: string;
  path: string;
  message: string;
  downloads?: ShareDownload[];
};

export default function ShareDialog({
  open,
  onClose,
  title,
  previewHref,
  path,
  message,
  downloads,
}: ShareDialogProps) {
  const [loadedHref, setLoadedHref] = useState("");
  const [failedHref, setFailedHref] = useState("");

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const loading = loadedHref !== previewHref && failedHref !== previewHref;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative mt-4 flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          {loading && (
            <Loader2 size={24} className="absolute animate-spin text-slate-400" />
          )}

          {failedHref === previewHref ? (
            <p className="px-6 text-center text-sm text-slate-500">
              The preview could not be generated right now.
            </p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewHref}
              alt={title}
              onLoad={() => setLoadedHref(previewHref)}
              onError={() => setFailedHref(previewHref)}
              className="h-full w-full object-contain"
            />
          )}
        </div>

        <div className="mt-4">
          <ShareBar
            path={path}
            message={message}
            downloads={downloads}
            theme="light"
          />
        </div>
      </div>
    </div>
  );
}
