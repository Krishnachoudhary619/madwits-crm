type Props = { compact?: boolean; inverted?: boolean };

export function BrandMark({ compact = false, inverted = false }: Props) {
  const text = inverted ? "text-white" : "text-charcoal";
  const muted = inverted ? "text-white/60" : "text-muted";
  return (
    <div className="flex items-center gap-3">
      <svg
        width={compact ? 36 : 44}
        height={compact ? 36 : 44}
        viewBox="0 0 44 44"
        aria-hidden="true"
      >
        <rect width="44" height="44" rx="8" fill="#F5C542" />
        <text
          x="22"
          y="29"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="18"
          fontWeight="700"
          fill="#191919"
        >
          MW
        </text>
      </svg>
      {!compact ? (
        <div className="leading-tight">
          <div className={`font-semibold tracking-wide ${text}`}>MadWits</div>
          <div className={`text-xs ${muted}`}>Print shop CRM</div>
        </div>
      ) : null}
    </div>
  );
}
