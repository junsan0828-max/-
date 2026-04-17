interface Props {
  className?: string;
  textSize?: string;
}

export default function Logo({ className = "h-8", textSize = "text-base" }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 280 120"
        className="h-full w-auto"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 왼쪽 외판 */}
        <rect x="4" y="18" width="22" height="84" rx="5" />
        {/* 왼쪽 내판 */}
        <rect x="30" y="32" width="14" height="56" rx="3" />

        {/* Z 모양 바 */}
        <path d="M44,38 L116,38 L172,82 L250,82 L250,98 L172,98 L116,54 L44,54 Z" />

        {/* 오른쪽 내판 */}
        <rect x="236" y="32" width="14" height="56" rx="3" />
        {/* 오른쪽 외판 */}
        <rect x="254" y="18" width="22" height="84" rx="5" />
      </svg>
      <span
        className={`font-bold tracking-widest uppercase ${textSize}`}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: "0.15em" }}
      >
        Ziantgym
      </span>
    </div>
  );
}
