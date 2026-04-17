interface Props {
  className?: string;
  textSize?: string;
}

export default function Logo({ className = "h-8", textSize = "text-base" }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 500 220"
        className="h-full w-auto"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 왼쪽 외판 (짧고 굵음) */}
        <rect x="5" y="74" width="22" height="82" rx="6" />
        {/* 왼쪽 내판 (키 큼) */}
        <rect x="34" y="20" width="30" height="180" rx="6" />

        {/*
          이탤릭 Z 바:
          - 상단 바: 이탤릭 평행사변형 (좌에서 우로 갈수록 10px 상승)
          - 대각선: 우상→좌하 (두 평행 대각선으로 두께 표현)
          - 하단 바: 상단 바와 동일 기울기의 평행사변형
        */}
        <path d="M64,30 L436,20 L436,70 L148,138 L436,130 L436,180 L64,190 L64,140 L352,72 L64,80 Z" />

        {/* 오른쪽 내판 */}
        <rect x="436" y="20" width="30" height="180" rx="6" />
        {/* 오른쪽 외판 */}
        <rect x="473" y="74" width="22" height="82" rx="6" />
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
