import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Inter (SIL Open Font License), see assets/fonts/LICENSE-Inter-OFL.txt.
const FILES = [
  { weight: 400, file: "inter-latin-400-normal.woff" },
  { weight: 700, file: "inter-latin-700-normal.woff" },
  { weight: 800, file: "inter-latin-800-normal.woff" },
] as const;

type Font = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 800;
  style: "normal";
};

let cache: Promise<Font[]> | null = null;

export function loadFonts(): Promise<Font[]> {
  if (!cache) {
    cache = Promise.all(
      FILES.map(async ({ weight, file }) => {
        const buffer = await readFile(join(process.cwd(), "assets/fonts", file));

        return {
          name: "Inter",
          data: buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
          ) as ArrayBuffer,
          weight,
          style: "normal" as const,
        };
      })
    );
  }

  return cache;
}
