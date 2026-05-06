interface Props {
  className?: string;
  textSize?: string;
}

export default function Logo({ className = "h-8", textSize = "text-base" }: Props) {
  return (
    <div className={`flex items-center ${className}`}>
      <span
        className={`font-bold tracking-widest uppercase ${textSize}`}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: "0.2em" }}
      >
        ZIANTGYM
      </span>
    </div>
  );
}
