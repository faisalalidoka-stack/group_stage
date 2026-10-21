import { ImageResponse } from "next/og";

import {
  getLineupCardData,
  getMatchCardData,
  getTournamentCardData,
} from "@/lib/cards/data";
import { loadFonts } from "@/lib/cards/fonts";
import { LineupCard, MatchCard, TournamentCard } from "@/lib/cards/render";
import { FORMATS, parseFormat } from "@/lib/cards/types";

/**
 * GET /api/card/{tournament|match|lineup}/{slug-or-match-id}
 *   ?format=og|square|story   (default og, 1200x630)
 *   &download=1               (forces a file download)
 *
 * Reads only public data, the same as a signed-out visitor.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string; id: string }> }
) {
  const { kind, id } = await context.params;
  const url = new URL(request.url);
  const format = parseFormat(url.searchParams.get("format"));
  const download = url.searchParams.get("download") === "1";

  try {
    let element;
    let fileName: string;

    if (kind === "tournament") {
      const data = await getTournamentCardData(id);
      if (!data) return new Response("Not found", { status: 404 });
      element = <TournamentCard data={data} format={format} />;
      fileName = data.fileName;
    } else if (kind === "match") {
      const data = await getMatchCardData(id);
      if (!data) return new Response("Not found", { status: 404 });
      element = <MatchCard data={data} format={format} />;
      fileName = data.fileName;
    } else if (kind === "lineup") {
      const data = await getLineupCardData(id);
      if (!data) {
        return new Response("No published lineup for this match", {
          status: 404,
        });
      }
      element = <LineupCard data={data} format={format} />;
      fileName = data.fileName;
    } else {
      return new Response("Unknown card type", { status: 404 });
    }

    const { width, height } = FORMATS[format];

    const headers: Record<string, string> = download
      ? {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="${fileName}-${format}.png"`,
        }
      : {
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
        };

    return new ImageResponse(element, {
      width,
      height,
      fonts: await loadFonts(),
      headers,
    });
  } catch (error) {
    console.error("Card generation failed", error);

    return new Response("Could not generate the image.", { status: 500 });
  }
}
