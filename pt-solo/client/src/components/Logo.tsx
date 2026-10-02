interface Props {
  className?: string;
  textSize?: string;
}

export default function Logo({ className = "h-8", textSize = "text-base" }: Props) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span
        className={`tracking-wider uppercase ${textSize}`}
        style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif", letterSpacing: "0.12em" }}
      >
        FIT
      </span>
      <span
        className={`tracking-wider uppercase ${textSize} text-primary`}
        style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif", letterSpacing: "0.12em" }}
      >
        STEP
      </span>
    </div>
  );
}
