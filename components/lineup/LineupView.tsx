import { buildSlots, placeSlot, type PlaceMode } from "@/lib/formations";
import {
  GOALKEEPER_KIT,
  separateKits,
  type Kit,
  type LineupSide,
} from "@/lib/lineups";
import Pitch, { type PitchMarker } from "./Pitch";

type LineupViewProps = {
  homeName: string;
  awayName: string;
  home: LineupSide | null;
  away: LineupSide | null;
  theme?: "light" | "dark";
  /** Shown over the header, e.g. "Draft" for unpublished previews. */
  note?: string;
};

const AWAY_GOALKEEPER_KIT: Kit = {
  primary: "#06b6d4",
  secondary: "#164e63",
  text: "#083344",
};

function markersFor(side: LineupSide, kit: Kit, mode: PlaceMode): PitchMarker[] {
  const slots = new Map(buildSlots(side.formation).map((s) => [s.index, s]));

  return side.starters.flatMap((starter) => {
    const slot = slots.get(starter.slot);

    if (!slot) return [];

    const { x, y } = placeSlot(slot, mode);
    const isKeeper = starter.role === "GK";

    return [
      {
        key: `${side.teamId}-${starter.playerId}`,
        x,
        y,
        name: starter.name,
        number: starter.number,
        kit: isKeeper
          ? mode === "away"
            ? AWAY_GOALKEEPER_KIT
            : GOALKEEPER_KIT
          : kit,
      },
    ];
  });
}

export default function LineupView({
  homeName,
  awayName,
  home,
  away,
  theme = "light",
  note,
}: LineupViewProps) {
  const dark = theme === "dark";

  const muted = dark ? "text-gray-400" : "text-slate-500";
  const strong = dark ? "text-white" : "text-slate-900";
  const panel = dark
    ? "border-white/10 bg-white/[0.03]"
    : "border-slate-200 bg-white";

  const both = home && away;

  const awayKit =
    home && away ? separateKits(home.kit, away.kit) : (away?.kit as Kit);

  const markers: PitchMarker[] = both
    ? [
        ...markersFor(home, home.kit, "home"),
        ...markersFor(away, awayKit, "away"),
      ]
    : home
      ? markersFor(home, home.kit, "full")
      : away
        ? markersFor(away, away.kit, "full")
        : [];

  const sides: { name: string; side: LineupSide | null }[] = [
    { name: homeName, side: home },
    { name: awayName, side: away },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={`text-sm font-bold ${strong}`}>
          {homeName}
          {home && (
            <span className={`ml-2 font-medium ${muted}`}>
              {home.formation}
            </span>
          )}
          <span className={`mx-2 ${muted}`}>vs</span>
          {awayName}
          {away && (
            <span className={`ml-2 font-medium ${muted}`}>
              {away.formation}
            </span>
          )}
        </div>

        {note && (
          <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-500">
            {note}
          </span>
        )}
      </div>

      {markers.length === 0 ? (
        <p className={`rounded-xl border p-6 text-center text-sm ${panel} ${muted}`}>
          Lineups for this match have not been published yet.
        </p>
      ) : (
        <div className="mx-auto w-full max-w-md">
          <Pitch markers={markers} compact={Boolean(both)} />
        </div>
      )}

      {!both && markers.length > 0 && (
        <p className={`text-center text-xs ${muted}`}>
          Only {home ? homeName : awayName}&apos;s lineup is available so far.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {sides.map(({ name, side }) => (
          <div key={name} className={`rounded-xl border p-4 ${panel}`}>
            <p className={`text-xs font-bold uppercase tracking-wide ${muted}`}>
              {name} substitutes
            </p>

            {!side || side.subs.length === 0 ? (
              <p className={`mt-2 text-sm ${muted}`}>None listed.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {side.subs.map((sub) => (
                  <li
                    key={sub.playerId}
                    className={`flex items-center gap-3 text-sm ${strong}`}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
                      style={{
                        background: side.kit.primary,
                        color: side.kit.text,
                        border: `1.5px solid ${side.kit.secondary}`,
                      }}
                    >
                      {sub.number ?? "–"}
                    </span>
                    {sub.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
