const BODY_PARTS = [
  "전신","상체","하체","등","어깨","가슴",
  "복부","허리","코어","고관절","대퇴 후면","대퇴 전면",
  "하퇴","발목·발","이두","삼두","유산소","기타",
];

interface Props {
  value: string;
  onChange: (val: string) => void;
  max?: number;
}

export default function BodyPartPicker({ value, onChange, max = 3 }: Props) {
  const selected = value ? value.split(",").filter(Boolean) : [];

  const toggle = (bp: string) => {
    if (selected.includes(bp)) {
      onChange(selected.filter(s => s !== bp).join(","));
    } else if (selected.length < max) {
      onChange([...selected, bp].join(","));
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-1.5">
        {BODY_PARTS.map((bp) => {
          const isSelected = selected.includes(bp);
          const isDisabled = !isSelected && selected.length >= max;
          return (
            <button
              key={bp}
              type="button"
              onClick={() => toggle(bp)}
              disabled={isDisabled}
              className={`py-1.5 text-xs rounded-lg border transition-colors text-center ${
                isSelected
                  ? "bg-primary/20 border-primary/50 text-primary font-medium"
                  : isDisabled
                  ? "border-border text-muted-foreground/40 cursor-not-allowed"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {bp}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          선택: {selected.join(" · ")} ({selected.length}/{max})
        </p>
      )}
    </div>
  );
}
