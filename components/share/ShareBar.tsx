"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Download, MessageCircle, Share2 } from "lucide-react";

import { getSiteUrl } from "@/lib/site";

export type ShareDownload = { label: string; href: string };

type ShareBarProps = {
  /** Site-relative path of the page being shared, e.g. /t/my-cup/m/123 */
  path: string;
  /** Text sent with the link, e.g. "Lions vs Tigers at 4:30 PM". */
  message: string;
  downloads?: ShareDownload[];
  theme?: "light" | "dark";
};

export default function ShareBar({
  path,
  message,
  downloads = [],
  theme = "light",
}: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  // False on the server, true in browsers that have the native share sheet.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => "share" in navigator,
    () => false
  );

  const fullUrl = () => `${getSiteUrl()}${path}`;

  const button =
    theme === "dark"
      ? "border-white/10 text-white hover:bg-white/5"
      : "border-slate-200 text-slate-800 hover:bg-slate-50";

  const base =
    "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", fullUrl());
    }
  }

  function whatsapp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${message} ${fullUrl()}`)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: message, text: message, url: fullUrl() });
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={whatsapp}
        className={`${base} border-emerald-500/40 bg-emerald-500 text-white hover:bg-emerald-600`}
      >
        <MessageCircle size={16} />
        WhatsApp
      </button>

      <button onClick={copyLink} className={`${base} ${button}`}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Copied" : "Copy link"}
      </button>

      {canShare && (
        <button onClick={nativeShare} className={`${base} ${button}`}>
          <Share2 size={16} />
          Share
        </button>
      )}

      {downloads.map((item) => (
        <a
          key={item.href}
          href={item.href}
          download
          className={`${base} ${button}`}
        >
          <Download size={16} />
          {item.label}
        </a>
      ))}
    </div>
  );
}
