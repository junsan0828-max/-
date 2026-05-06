interface Props {
  className?: string;
  textSize?: string;
}

export default function Logo({ className = "h-8", textSize = "text-base" }: Props) {
  return (
    <div className={`flex items-center ${className}`}>
      <svg viewBox="0 0 220 90" className="h-full w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 외곽 평행사변형 */}
        <polygon points="18,4 214,4 202,86 6,86" stroke="#2222DD" strokeWidth="6" fill="none" />
        {/* 내곽 평행사변형 */}
        <polygon points="24,12 208,12 196,78 12,78" stroke="#2222DD" strokeWidth="3" fill="none" />
        {/* F */}
        <text x="28" y="66" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="52" fill="#2222DD" fontStyle="italic">F.</text>
        {/* 삼각형 (△) */}
        <polygon points="100,20 140,72 60,72" fill="#2222DD" />
        {/* E */}
        <text x="148" y="66" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="52" fill="#2222DD" fontStyle="italic">E</text>
      </svg>
    </div>
  );
}
