import type { Metadata } from "next";

import { getTournamentSummary } from "@/lib/cards/data";
import TournamentClient from "./TournamentClient";

type Props = { params: Promise<{ slug: string }> };

// Link previews (WhatsApp, Facebook, X, Telegram...) read these tags from the
// server-rendered HTML, which is why this page is a server component that
// hands the live, interactive view to the client component.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const summary = await getTournamentSummary(slug).catch(() => null);

  if (!summary) {
    return { title: "Tournament · Group Stage" };
  }

  const title = `${summary.name} · Group Stage`;
  const description = `${summary.teamCount} teams · ${summary.finishedCount}/${summary.matchCount} matches played${
    summary.venue ? ` · ${summary.venue}` : ""
  }. Follow fixtures, results, lineups and standings.`;

  const image = `/api/card/tournament/${slug}?format=og`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `/t/${slug}`,
      siteName: "Group Stage",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicTournamentPage({ params }: Props) {
  const { slug } = await params;

  return <TournamentClient slug={slug} />;
}
