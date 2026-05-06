interface Props {
  className?: string;
  textSize?: string;
}

export default function Logo({ className = "h-8", textSize = "text-base" }: Props) {
  return (
    <div className={`flex items-center ${className}`}>
      <span
        className={`font-black tracking-widest uppercase ${textSize}`}
        style={{ fontFamily: "'Arial Black', Arial, sans-serif", letterSpacing: "0.15em" }}
      >
        FITNESSTEP
      </span>
    </div>
  );
}
