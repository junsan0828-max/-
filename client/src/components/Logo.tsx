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
        <rect x="4" y="10" width="22" height="100" rx="5" />
        {/* 왼쪽 내판 */}
        <rect x="30" y="25" width="14" height="70" rx="3" />

        {/* Z 자형 바: 상단 수평 + 대각선(우상→좌하) + 하단 수평 */}
        <path d="M44,25 L250,25 L250,45 L96,75 L250,75 L250,95 L44,95 L44,75 L199,45 L44,45 Z" />

        {/* 오른쪽 내판 */}
        <rect x="236" y="25" width="14" height="70" rx="3" />
        {/* 오른쪽 외판 */}
        <rect x="254" y="10" width="22" height="100" rx="5" />
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
