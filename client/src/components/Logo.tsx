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
        {/* 왼쪽 외판 */}
        <rect x="5" y="73" width="22" height="82" rx="6" />
        {/* 왼쪽 내판 */}
        <rect x="34" y="20" width="30" height="180" rx="6" />

        {/*
          Z 자형 중앙 바 (이미지 정밀 추적)
          상단 바: y=20~71 (51px), 우측으로 6px 상승 (이탤릭)
          대각선: 우상→좌하, 상단 바 우하단에서 하단 바 좌상단으로
          하단 바: y=148~199 (51px), 동일 기울기
        */}
        <path d="M64,20 L436,14 L436,65 L157,148 L436,142 L436,193 L64,199 L64,148 L343,67 L64,71 Z" />

        {/* 오른쪽 내판 */}
        <rect x="436" y="20" width="30" height="180" rx="6" />
        {/* 오른쪽 외판 */}
        <rect x="473" y="73" width="22" height="82" rx="6" />
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
