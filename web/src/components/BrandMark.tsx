type Props = { compact?: boolean; inverted?: boolean; large?: boolean };

export function BrandMark({ compact = false, large = false }: Props) {
  const size = compact
    ? "h-12 w-auto max-w-[12rem] object-contain object-left"
    : large
      ? "h-auto w-56 max-w-full object-contain object-left"
      : "h-auto w-48 max-w-full object-contain object-left";
  return (
    // Served from /public; skip next/image so the PNG is not rewritten by the optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/new-madwits-logo.png" alt="MadWits" className={size} />
  );
}
