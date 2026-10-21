import { shortName, type Kit } from "@/lib/lineups";

export type PitchMarker = {
  key: string;
  /** 0-100 left to right. */
  x: number;
  /** 0-100 top to bottom. */
  y: number;
  name: string;
  number: number | null;
  kit: Kit;
  selected?: boolean;
  onClick?: () => void;
};

export type PitchGhost = {
  key: string;
  x: number;
  y: number;
  label: string;
  selected?: boolean;
  onClick?: () => void;
};

type PitchProps = {
  markers: PitchMarker[];
  ghosts?: PitchGhost[];
  /** Smaller players, used when both teams share the pitch. */
  compact?: boolean;
  label?: string;
};

const WIDTH = 100;
const HEIGHT = 150;

export default function Pitch({
  markers,
  ghosts = [],
  compact = false,
  label = "Football pitch",
}: PitchProps) {
  const radius = compact ? 3.9 : 5.6;
  const numberSize = compact ? 3.7 : 5.2;
  const nameSize = compact ? 2.8 : 3.6;

  // Label length follows the space to the neighbour on the same line, so
  // crowded rows (for example five across) never overlap.
  const maxCharsFor = (marker: PitchMarker) => {
    let gap = 40;

    for (const other of markers) {
      if (other !== marker && Math.abs(other.y - marker.y) < 1) {
        gap = Math.min(gap, Math.abs(other.x - marker.x));
      }
    }

    return Math.max(6, Math.min(16, Math.floor(gap / (nameSize * 0.56))));
  };

  const stripes = Array.from({ length: 10 }, (_, i) => i);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label}
      className="h-auto w-full select-none rounded-2xl"
    >
      <rect width={WIDTH} height={HEIGHT} fill="#15803d" />

      {stripes.map((i) => (
        <rect
          key={i}
          x={0}
          y={i * 15}
          width={WIDTH}
          height={15}
          fill={i % 2 === 0 ? "#16a34a" : "#15803d"}
          opacity={0.55}
        />
      ))}

      <g fill="none" stroke="#ffffff" strokeOpacity={0.75} strokeWidth={0.5}>
        <rect x={4} y={4} width={92} height={142} />
        <line x1={4} y1={75} x2={96} y2={75} />
        <circle cx={50} cy={75} r={12} />
        <rect x={24} y={4} width={52} height={22} />
        <rect x={24} y={124} width={52} height={22} />
        <rect x={38} y={4} width={24} height={8} />
        <rect x={38} y={138} width={24} height={8} />
        <rect x={44} y={1.5} width={12} height={2.5} />
        <rect x={44} y={146} width={12} height={2.5} />
        <path d="M 40 26 A 12 12 0 0 0 60 26" />
        <path d="M 40 124 A 12 12 0 0 1 60 124" />
      </g>

      <g fill="#ffffff" fillOpacity={0.8}>
        <circle cx={50} cy={75} r={0.8} />
        <circle cx={50} cy={17} r={0.7} />
        <circle cx={50} cy={133} r={0.7} />
      </g>

      {ghosts.map((ghost) => (
        <g
          key={ghost.key}
          onClick={ghost.onClick}
          style={{ cursor: ghost.onClick ? "pointer" : "default" }}
        >
          <circle
            cx={ghost.x}
            cy={ghost.y * 1.5}
            r={radius}
            fill="#000000"
            fillOpacity={0.18}
            stroke={ghost.selected ? "#fbbf24" : "#ffffff"}
            strokeOpacity={ghost.selected ? 1 : 0.7}
            strokeWidth={ghost.selected ? 1.2 : 0.7}
            strokeDasharray="1.6 1.2"
          />
          <text
            x={ghost.x}
            y={ghost.y * 1.5 + numberSize / 3}
            textAnchor="middle"
            fontSize={numberSize * 0.8}
            fontWeight={700}
            fill="#ffffff"
            fillOpacity={0.85}
          >
            {ghost.label}
          </text>
        </g>
      ))}

      {markers.map((marker) => {
        const cx = marker.x;
        const cy = marker.y * 1.5;

        return (
          <g
            key={marker.key}
            onClick={marker.onClick}
            style={{ cursor: marker.onClick ? "pointer" : "default" }}
          >
            {marker.selected && (
              <circle
                cx={cx}
                cy={cy}
                r={radius + 1.6}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={1.1}
              />
            )}

            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill={marker.kit.primary}
              stroke={marker.kit.secondary}
              strokeWidth={1.1}
            />

            <text
              x={cx}
              y={cy + numberSize / 3}
              textAnchor="middle"
              fontSize={numberSize}
              fontWeight={800}
              fill={marker.kit.text}
            >
              {marker.number ?? "–"}
            </text>

            <text
              x={cx}
              y={cy + radius + nameSize + 0.6}
              textAnchor="middle"
              fontSize={nameSize}
              fontWeight={700}
              fill="#ffffff"
              stroke="#052e16"
              strokeWidth={0.7}
              paintOrder="stroke"
            >
              {shortName(marker.name, maxCharsFor(marker))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
