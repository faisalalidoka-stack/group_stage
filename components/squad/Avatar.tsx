type AvatarProps = {
  src: string | null;
  name: string;
  size?: number;
  square?: boolean;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function Avatar({
  src,
  name,
  size = 40,
  square = false,
}: AvatarProps) {
  const shape = square ? "rounded-xl" : "rounded-full";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={`${shape} shrink-0 object-cover`}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`${shape} flex shrink-0 items-center justify-center bg-emerald-400/10 text-xs font-bold text-emerald-400`}
    >
      {initials(name) || "?"}
    </div>
  );
}
