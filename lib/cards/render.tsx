/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";

import {
  buildSlots,
  placeSlot,
  type PlaceMode,
} from "@/lib/formations";
import {
  GOALKEEPER_KIT,
  separateKits,
  shortName,
  type Kit,
  type LineupSide,
} from "@/lib/lineups";
import type {
  CardFormat,
  CardTeam,
  LineupCardData,
  MatchCardData,
  TournamentCardData,
} from "@/lib/cards/types";

// Everything here must stay within what the image renderer (Satori) supports:
// flexbox only, every container with several children is display:flex.

const BG = "#07090d";
const ACCENT = "#10b981";
const MUTED = "#94a3b8";
const FONT = "Inter";

type Variant = "wide" | "square" | "tall";

const variantOf = (format: CardFormat): Variant =>
  format === "og" ? "wide" : format === "story" ? "tall" : "square";

const AWAY_GK: Kit = {
  primary: "#06b6d4",
  secondary: "#164e63",
  text: "#083344",
};

function rgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return `rgba(${r},${g},${b},${alpha})`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Picks a font size so long names still fit. */
function fitSize(text: string, sizes: [number, number][], fallback: number) {
  for (const [maxLength, size] of sizes) {
    if (text.length <= maxLength) return size;
  }

  return fallback;
}

/**
 * Largest title size that fits: one line if it can stay reasonably big,
 * otherwise two lines at a smaller size.
 */
function fitTitle(text: string, width: number, maxSize: number) {
  const perChar = 0.6;
  const oneLine = width / (Math.max(text.length, 1) * perChar);

  if (oneLine >= maxSize * 0.62) return Math.floor(Math.min(oneLine, maxSize));

  const twoLines = (width * 1.8) / (text.length * perChar);

  return Math.floor(Math.min(Math.max(twoLines, 42), maxSize * 0.9));
}

function Frame({
  width,
  height,
  padding,
  accent,
  host,
  children,
}: {
  width: number;
  height: number;
  padding: number;
  accent: string;
  host: string;
  children: ReactNode;
}) {
  const small = height < 700;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        padding,
        backgroundColor: BG,
        backgroundImage: `radial-gradient(circle at 12% 0%, ${rgba(accent, 0.28)}, rgba(7,9,13,0) 62%)`,
        color: "#ffffff",
        fontFamily: FONT,
      }}
    >
      {children}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "auto",
          paddingTop: small ? 10 : 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: small ? 34 : 44,
              height: small ? 34 : 44,
              borderRadius: 12,
              backgroundColor: ACCENT,
              color: "#04120c",
              fontSize: small ? 20 : 26,
              fontWeight: 800,
            }}
          >
            G
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: 12,
              fontSize: small ? 24 : 30,
              fontWeight: 800,
            }}
          >
            Group Stage
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: small ? 20 : 26,
            color: MUTED,
            fontWeight: 700,
          }}
        >
          {host}
        </div>
      </div>
    </div>
  );
}

function Chip({
  children,
  color = ACCENT,
  size = 24,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: `${Math.round(size * 0.3)}px ${Math.round(size * 0.7)}px`,
        borderRadius: 999,
        backgroundColor: rgba(color, 0.16),
        border: `2px solid ${rgba(color, 0.45)}`,
        color,
        fontSize: size,
        fontWeight: 800,
        letterSpacing: 1.5,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function TeamDisc({ team, size }: { team: CardTeam; size: number }) {
  const border = Math.max(3, Math.round(size * 0.05));

  if (team.logo) {
    return (
      <img
        src={team.logo}
        width={size}
        height={size}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          objectFit: "cover",
          backgroundColor: "#ffffff",
          border: `${border}px solid ${team.kit.secondary}`,
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: team.kit.primary,
        border: `${border}px solid ${team.kit.secondary}`,
        color: team.kit.text,
        fontSize: Math.round(size * 0.38),
        fontWeight: 800,
      }}
    >
      {initials(team.name)}
    </div>
  );
}

/* --------------------------- Tournament card --------------------------- */

export function TournamentCard({
  data,
  format,
}: {
  data: TournamentCardData;
  format: CardFormat;
}) {
  const variant = variantOf(format);
  const pad = variant === "wide" ? 48 : 64;
  const w = variant === "wide" ? 1200 : 1080;
  const h = variant === "wide" ? 630 : variant === "square" ? 1080 : 1920;

  const accent = data.teams[0]?.kit.primary ?? ACCENT;

  const titleWidth =
    variant === "wide" ? 1200 - pad * 2 - 4 * 122 - 36 : w - pad * 2;
  const nameSize = fitTitle(
    data.name,
    titleWidth,
    variant === "wide" ? 88 : variant === "square" ? 112 : 128
  );

  const meta = [
    data.venue,
    data.dates,
    variant === "wide" ? `${data.teamCount} teams` : null,
  ].filter(Boolean) as string[];

  const maxTeams = variant === "wide" ? 8 : variant === "square" ? 10 : 12;
  const shown = data.teams.slice(0, maxTeams);
  const extra = data.teamCount - shown.length;

  const logoSize = variant === "wide" ? 96 : variant === "square" ? 120 : 150;

  const header = (
    <div style={{ display: "flex", alignItems: "center" }}>
      {data.logo ? (
        <img
          src={data.logo}
          width={logoSize}
          height={logoSize}
          alt=""
          style={{
            width: logoSize,
            height: logoSize,
            borderRadius: 24,
            objectFit: "cover",
            backgroundColor: "#ffffff",
            marginRight: 24,
          }}
        />
      ) : null}
      <Chip size={variant === "wide" ? 22 : 26}>Tournament</Chip>
    </div>
  );

  const title = (
    <div
      style={{
        display: "flex",
        width: titleWidth,
        flexShrink: 0,
        marginTop: variant === "wide" ? 20 : 32,
        fontSize: nameSize,
        fontWeight: 800,
        lineHeight: 1.04,
        letterSpacing: -2,
      }}
    >
      {data.name}
    </div>
  );

  const metaRow = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        marginTop: variant === "wide" ? 18 : 28,
        fontSize: variant === "wide" ? 26 : 32,
        color: MUTED,
        fontWeight: 700,
      }}
    >
      {meta.map((item, index) => (
        <div key={item} style={{ display: "flex", marginRight: 22 }}>
          {index > 0 ? (
            <div style={{ display: "flex", marginRight: 22, color: ACCENT }}>
              •
            </div>
          ) : null}
          {item}
        </div>
      ))}
    </div>
  );

  if (variant === "wide") {
    return (
      <Frame width={w} height={h} padding={pad} accent={accent} host={data.host}>
        <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              paddingRight: 36,
            }}
          >
            {header}
            {title}
            {metaRow}

            <div
              style={{
                display: "flex",
                marginTop: 26,
                fontSize: 24,
                color: "#cbd5e1",
                fontWeight: 700,
              }}
            >
              {`${data.finishedCount}/${data.matchCount} matches played`}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              width: 4 * 122,
              justifyContent: "flex-end",
            }}
          >
            {shown.map((team) => (
              <div key={team.id} style={{ display: "flex", margin: 6 }}>
                <TeamDisc team={team} size={110} />
              </div>
            ))}
            {extra > 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 110,
                  height: 110,
                  margin: 6,
                  borderRadius: 55,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  fontSize: 32,
                  fontWeight: 800,
                  color: MUTED,
                }}
              >
                {`+${extra}`}
              </div>
            ) : null}
          </div>
        </div>
      </Frame>
    );
  }

  const rowDisc = variant === "tall" ? 92 : 68;
  const rowFont = variant === "tall" ? 44 : 32;
  const columns = variant === "tall" ? 1 : 2;

  return (
    <Frame width={w} height={h} padding={pad} accent={accent} host={data.host}>
      {header}
      {title}
      {metaRow}

      <div
        style={{
          display: "flex",
          marginTop: variant === "tall" ? 40 : 28,
          fontSize: variant === "tall" ? 30 : 26,
          color: "#cbd5e1",
          fontWeight: 700,
        }}
      >
        {`${data.finishedCount}/${data.matchCount} matches played`}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          marginTop: variant === "tall" ? 48 : 36,
        }}
      >
        {shown.map((team) => (
          <div
            key={team.id}
            style={{
              display: "flex",
              alignItems: "center",
              width: `${100 / columns}%`,
              marginBottom: variant === "tall" ? 26 : 18,
            }}
          >
            <TeamDisc team={team} size={rowDisc} />
            <div
              style={{
                display: "flex",
                marginLeft: 20,
                fontSize: rowFont,
                fontWeight: 700,
                maxWidth: variant === "tall" ? 800 : 380,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {team.name}
            </div>
          </div>
        ))}

        {extra > 0 ? (
          <div
            style={{
              display: "flex",
              width: "100%",
              fontSize: rowFont - 6,
              color: MUTED,
              fontWeight: 700,
            }}
          >
            {`+ ${extra} more teams`}
          </div>
        ) : null}
      </div>
    </Frame>
  );
}

/* ----------------------------- Match card ------------------------------ */

function TeamBlock({
  team,
  disc,
  nameSize,
  width,
}: {
  team: CardTeam;
  disc: number;
  nameSize: number;
  width: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width,
      }}
    >
      <TeamDisc team={team} size={disc} />
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          textAlign: "center",
          marginTop: 22,
          fontSize: fitSize(team.name, [[10, nameSize], [16, nameSize * 0.82]], nameSize * 0.66),
          fontWeight: 800,
          lineHeight: 1.1,
        }}
      >
        {team.name}
      </div>
    </div>
  );
}

export function MatchCard({
  data,
  format,
}: {
  data: MatchCardData;
  format: CardFormat;
}) {
  const variant = variantOf(format);
  const w = variant === "wide" ? 1200 : 1080;
  const h = variant === "wide" ? 630 : variant === "square" ? 1080 : 1920;
  const pad = variant === "wide" ? 48 : 64;

  const played = data.status !== "SCHEDULED";

  const statusLabel =
    data.status === "LIVE"
      ? "Live"
      : data.status === "FINISHED"
        ? "Full time"
        : "Upcoming";

  const statusColor =
    data.status === "LIVE" ? "#ef4444" : data.status === "FINISHED" ? ACCENT : "#38bdf8";

  const disc = variant === "wide" ? 170 : variant === "square" ? 210 : 330;
  const blockWidth = variant === "wide" ? 380 : variant === "square" ? 300 : 700;
  const nameSize = variant === "wide" ? 40 : variant === "square" ? 42 : 68;
  const scoreSize = variant === "wide" ? 110 : variant === "square" ? 120 : 170;

  const center = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {played ? (
        <div
          style={{
            display: "flex",
            fontSize: scoreSize,
            fontWeight: 800,
            letterSpacing: -3,
          }}
        >
          {`${data.homeScore} - ${data.awayScore}`}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            fontSize: scoreSize * 0.55,
            fontWeight: 800,
            color: MUTED,
          }}
        >
          VS
        </div>
      )}
    </div>
  );

  const details = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontSize: variant === "wide" ? 26 : variant === "square" ? 32 : 38,
        fontWeight: 700,
        color: "#cbd5e1",
      }}
    >
      {data.kickoff ? <div style={{ display: "flex" }}>{data.kickoff}</div> : null}
      {data.location ? (
        <div style={{ display: "flex", marginTop: 8, color: MUTED }}>
          {data.location}
        </div>
      ) : null}
    </div>
  );

  const top = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Chip size={variant === "wide" ? 22 : 26}>{data.stageLabel}</Chip>
        <div
          style={{
            display: "flex",
            marginLeft: 18,
            fontSize: variant === "wide" ? 24 : 30,
            fontWeight: 700,
            color: MUTED,
          }}
        >
          {shortName(data.tournamentName, variant === "wide" ? 34 : 30)}
        </div>
      </div>
      <Chip color={statusColor} size={variant === "wide" ? 22 : 26}>
        {statusLabel}
      </Chip>
    </div>
  );

  const accent = data.home.kit.primary;

  if (variant === "tall") {
    return (
      <Frame width={w} height={h} padding={pad} accent={accent} host={data.host}>
        {top}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <TeamBlock team={data.home} disc={disc} nameSize={nameSize} width={blockWidth} />
          <div style={{ display: "flex", margin: "36px 0" }}>{center}</div>
          <TeamBlock team={data.away} disc={disc} nameSize={nameSize} width={blockWidth} />
          <div style={{ display: "flex", marginTop: 56 }}>{details}</div>
        </div>
      </Frame>
    );
  }

  return (
    <Frame width={w} height={h} padding={pad} accent={accent} host={data.host}>
      {top}
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TeamBlock team={data.home} disc={disc} nameSize={nameSize} width={blockWidth} />
        {center}
        <TeamBlock team={data.away} disc={disc} nameSize={nameSize} width={blockWidth} />
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>{details}</div>
    </Frame>
  );
}

/* ----------------------------- Lineup card ----------------------------- */

type PitchMark = {
  key: string;
  x: number;
  y: number;
  name: string;
  number: number | null;
  kit: Kit;
};

function marksFor(
  side: LineupSide,
  kit: Kit,
  mode: PlaceMode,
  keeper: Kit
): PitchMark[] {
  const slots = new Map(buildSlots(side.formation).map((s) => [s.index, s]));

  return side.starters.flatMap((starter) => {
    const slot = slots.get(starter.slot);

    if (!slot) return [];

    const { x, y } = placeSlot(slot, mode);

    return [
      {
        key: `${side.teamId}-${starter.playerId}`,
        x,
        y,
        name: starter.name,
        number: starter.number,
        kit: starter.role === "GK" ? keeper : kit,
      },
    ];
  });
}

function PitchGraphic({
  width,
  height,
  horizontal,
  marks,
  compact,
}: {
  width: number;
  height: number;
  horizontal: boolean;
  marks: PitchMark[];
  compact: boolean;
}) {
  const unit = (horizontal ? height : width) / 100;
  const r = (compact ? 3.9 : 5.6) * unit;
  const fontSize = (compact ? 2.9 : 3.6) * unit;
  const labelHeight = fontSize * 1.4;

  const screen = marks.map((mark) => ({
    mark,
    cx: horizontal ? ((100 - mark.y) / 100) * width : (mark.x / 100) * width,
    cy: horizontal ? (mark.x / 100) * height : (mark.y / 100) * height,
  }));

  const maxChars = (index: number) => {
    const me = screen[index];
    let available = 40 * unit;

    screen.forEach((other, i) => {
      if (i === index) return;
      if (Math.abs(other.cy - me.cy) < r * 2 + labelHeight) {
        available = Math.min(available, Math.abs(other.cx - me.cx));
      }
    });

    return Math.max(
      6,
      Math.min(16, Math.floor((available - 4) / (fontSize * 0.58)))
    );
  };

  const stripes = Array.from({ length: 10 }, (_, i) => i);

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        borderRadius: 22,
        overflow: "hidden",
        backgroundColor: "#15803d",
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={horizontal ? "0 0 150 100" : "0 0 100 150"}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <g transform={horizontal ? "matrix(0 1 -1 0 150 0)" : undefined}>
          <rect width="100" height="150" fill="#15803d" />
          {stripes.map((i) => (
            <rect
              key={i}
              x="0"
              y={i * 15}
              width="100"
              height="15"
              fill={i % 2 === 0 ? "#16a34a" : "#15803d"}
              opacity="0.55"
            />
          ))}
          <g fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="0.5">
            <rect x="4" y="4" width="92" height="142" />
            <line x1="4" y1="75" x2="96" y2="75" />
            <circle cx="50" cy="75" r="12" />
            <rect x="24" y="4" width="52" height="22" />
            <rect x="24" y="124" width="52" height="22" />
            <rect x="38" y="4" width="24" height="8" />
            <rect x="38" y="138" width="24" height="8" />
          </g>
        </g>
      </svg>

      {screen.map(({ mark, cx, cy }, index) => (
        <div key={mark.key} style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "absolute",
              left: cx - r,
              top: cy - r,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              backgroundColor: mark.kit.primary,
              border: `${Math.max(2, r * 0.2)}px solid ${mark.kit.secondary}`,
              color: mark.kit.text,
              fontSize: r * 1.05,
              fontWeight: 800,
            }}
          >
            {mark.number ?? "–"}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              position: "absolute",
              left: cx - 20 * unit,
              top: cy + r + 2,
              width: 40 * unit,
              fontSize,
              fontWeight: 700,
              color: "#ffffff",
              textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)",
            }}
          >
            {shortName(mark.name, maxChars(index))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SubsPanel({
  name,
  side,
  size,
}: {
  name: string;
  side: LineupSide | null;
  size: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: size * 0.5,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.06)",
        border: "2px solid rgba(255,255,255,0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: size * 0.8,
          fontWeight: 800,
          color: MUTED,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {`${shortName(name, 18)} subs`}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", marginTop: 8 }}>
        {side && side.subs.length > 0 ? (
          side.subs.map((sub) => (
            <div
              key={sub.playerId}
              style={{
                display: "flex",
                alignItems: "center",
                marginRight: 14,
                marginTop: 6,
                fontSize: size,
                fontWeight: 700,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: size * 1.5,
                  height: size * 1.5,
                  borderRadius: size,
                  marginRight: 8,
                  backgroundColor: side.kit.primary,
                  border: `2px solid ${side.kit.secondary}`,
                  color: side.kit.text,
                  fontSize: size * 0.8,
                  fontWeight: 800,
                }}
              >
                {sub.number ?? "–"}
              </div>
              {shortName(sub.name, 12)}
            </div>
          ))
        ) : (
          <div style={{ display: "flex", fontSize: size, color: MUTED }}>None listed</div>
        )}
      </div>
    </div>
  );
}

export function LineupCard({
  data,
  format,
}: {
  data: LineupCardData;
  format: CardFormat;
}) {
  const variant = variantOf(format);
  const w = variant === "wide" ? 1200 : 1080;
  const h = variant === "wide" ? 630 : variant === "square" ? 1080 : 1920;
  const pad = variant === "wide" ? 40 : 56;

  const { home, away } = data;
  const both = Boolean(home && away);

  const awayKit = home && away ? separateKits(home.kit, away.kit) : away?.kit;

  const marks: PitchMark[] = both
    ? [
        ...marksFor(home as LineupSide, (home as LineupSide).kit, "home", GOALKEEPER_KIT),
        ...marksFor(away as LineupSide, awayKit as Kit, "away", AWAY_GK),
      ]
    : home
      ? marksFor(home, home.kit, "full", GOALKEEPER_KIT)
      : away
        ? marksFor(away, away.kit, "full", GOALKEEPER_KIT)
        : [];

  const formations = [home, away]
    .filter((s): s is LineupSide => Boolean(s))
    .map((s) => `${shortName(s.teamName, 14)} ${s.formation}`)
    .join("  ·  ");

  const title = `${data.homeName} vs ${data.awayName}`;
  const titleWidth = variant === "wide" ? 350 : w - pad * 2;
  const titleSize = fitTitle(
    title,
    titleWidth,
    variant === "wide" ? 56 : 60
  );

  const accent = home?.kit.primary ?? away?.kit.primary ?? ACCENT;

  const heading = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Chip size={variant === "wide" ? 20 : 24}>
          {variant === "wide" ? "Lineups" : "Starting lineups"}
        </Chip>
        {variant === "wide" ? null : (
          <div
            style={{
              display: "flex",
              marginLeft: 16,
              fontSize: 28,
              fontWeight: 700,
              color: MUTED,
            }}
          >
            {`${data.stageLabel} · ${shortName(data.tournamentName, 26)}`}
          </div>
        )}
      </div>

      {variant === "wide" ? (
        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: 22,
            fontWeight: 700,
            color: MUTED,
          }}
        >
          {`${data.stageLabel} · ${shortName(data.tournamentName, 24)}`}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          width: titleWidth,
          flexShrink: 0,
          marginTop: variant === "wide" ? 14 : 20,
          fontSize: titleSize,
          fontWeight: 800,
          letterSpacing: -1.5,
          lineHeight: 1.05,
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "flex",
          width: titleWidth,
          marginTop: 10,
          fontSize: variant === "wide" ? 22 : 26,
          fontWeight: 700,
          color: "#cbd5e1",
        }}
      >
        {formations}
      </div>
    </div>
  );

  if (variant === "wide") {
    const pitchH = 470;
    const pitchW = Math.round(pitchH * 1.5);

    return (
      <Frame width={w} height={h} padding={pad} accent={accent} host={data.host}>
        <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              width: w - pad * 2 - pitchW - 30,
              paddingRight: 24,
            }}
          >
            {heading}
          </div>
          <PitchGraphic
            width={pitchW}
            height={pitchH}
            horizontal
            marks={marks}
            compact={both}
          />
        </div>
      </Frame>
    );
  }

  const subsSize = variant === "tall" ? 24 : 20;
  const subsHeight = variant === "tall" ? 250 : 175;
  const headerHeight = variant === "tall" ? 190 : 150;
  const footerHeight = 70;

  const availableH = h - pad * 2 - headerHeight - subsHeight - footerHeight - 24;
  const availableW = w - pad * 2;

  let pitchW: number;
  let pitchH: number;
  const horizontal = variant === "square";

  if (horizontal) {
    pitchH = Math.min(availableH, Math.round(availableW / 1.5));
    pitchW = Math.round(pitchH * 1.5);
  } else {
    pitchH = availableH;
    pitchW = Math.min(availableW, Math.round(pitchH / 1.5));
    pitchH = Math.round(pitchW * 1.5);
  }

  return (
    <Frame width={w} height={h} padding={pad} accent={accent} host={data.host}>
      {heading}

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 22,
        }}
      >
        <PitchGraphic
          width={pitchW}
          height={pitchH}
          horizontal={horizontal}
          marks={marks}
          compact={both}
        />
      </div>

      <div style={{ display: "flex", marginTop: 20 }}>
        <SubsPanel name={data.homeName} side={home} size={subsSize} />
        <div style={{ display: "flex", width: 16 }} />
        <SubsPanel name={data.awayName} side={away} size={subsSize} />
      </div>
    </Frame>
  );
}
