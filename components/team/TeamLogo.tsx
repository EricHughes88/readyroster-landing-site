// components/team/TeamLogo.tsx
"use client";

type Props = {
  logoPath?: string | null;
  teamName?: string | null;
  size?: number;
  rounded?: boolean;
  className?: string;
};

export default function TeamLogo({
  logoPath,
  teamName,
  size = 48,
  rounded = true,
  className = "",
}: Props) {
  const borderRadius = rounded ? "9999px" : "12px";
  const displayName = teamName?.trim() || "Team";

  if (logoPath) {
    return (
      <img
        src={logoPath}
        alt={`${displayName} logo`}
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          borderRadius,
          border: "1px solid #334155",
          background: "#0f172a",
          flexShrink: 0,
        }}
        className={className}
      />
    );
  }

  return (
    <div
      title={`${displayName} logo`}
      style={{
        width: size,
        height: size,
        borderRadius,
        border: "1px solid #334155",
        background: "#0f172a",
        color: "#94a3b8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(10, Math.floor(size / 3.5)),
        fontWeight: 700,
        flexShrink: 0,
      }}
      className={className}
    >
      {displayName.slice(0, 2).toUpperCase()}
    </div>
  );
}