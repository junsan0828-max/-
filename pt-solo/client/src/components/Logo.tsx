interface Props {
  className?: string;
  textSize?: string;
}

export default function Logo({ className = "h-8", textSize = "text-base" }: Props) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span
        className={`font-black tracking-widest uppercase ${textSize}`}
        style={{ fontFamily: "'Arial Black', Arial, sans-serif", letterSpacing: "0.1em" }}
      >
        FIT
      </span>
      <span
        className={`font-black tracking-widest uppercase ${textSize} text-primary`}
        style={{ fontFamily: "'Arial Black', Arial, sans-serif", letterSpacing: "0.1em" }}
      >
        STEP
      </span>
    </div>
  );
}
