interface Props {
  className?: string;
  textSize?: string;
}

// /client/public/ziantgym-logo.png 파일이 있으면 이미지 사용, 없으면 SVG fallback
const LOGO_IMG = "/ziantgym-logo.png";

export default function Logo({ className = "h-8", textSize = "text-base" }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={LOGO_IMG}
        alt="ZIANTGYM"
        className="h-full w-auto"
        // 다크 배경에서 흰 배경 제거: invert(검정→흰색) + 채도/밝기 조정
        style={{ filter: "invert(1) brightness(1.1)", mixBlendMode: "screen" }}
        onError={(e) => {
          // 이미지 파일 없으면 SVG fallback으로 교체
          const parent = e.currentTarget.parentElement;
          if (!parent) return;
          e.currentTarget.style.display = "none";
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("viewBox", "0 0 500 220");
          svg.setAttribute("class", "h-full w-auto");
          svg.setAttribute("fill", "currentColor");
          svg.innerHTML = `
            <rect x="5" y="73" width="22" height="82" rx="6"/>
            <rect x="34" y="20" width="30" height="180" rx="6"/>
            <path d="M64,20 L436,14 L436,65 L157,148 L436,142 L436,193 L64,199 L64,148 L343,67 L64,71 Z"/>
            <rect x="436" y="20" width="30" height="180" rx="6"/>
            <rect x="473" y="73" width="22" height="82" rx="6"/>
          `;
          parent.insertBefore(svg, e.currentTarget);
        }}
      />
      <span
        className={`font-bold tracking-widest uppercase ${textSize}`}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: "0.15em" }}
      >
        Ziantgym
      </span>
    </div>
  );
}
