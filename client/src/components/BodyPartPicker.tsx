import { useState } from "react";

const BODY_PARTS = [
  "전신","상체","하체","등","어깨","가슴",
  "복부","허리","코어","고관절","대퇴 후면","대퇴 전면",
  "하퇴","발목·발","이두","삼두","유산소","기타",
];

const PRESET_PARTS = BODY_PARTS.filter(b => b !== "기타");

interface Props {
  value: string;
  onChange: (val: string) => void;
  max?: number;
}

export default function BodyPartPicker({ value, onChange, max = 3 }: Props) {
  const parts = value ? value.split(",").filter(Boolean) : [];
  const presetParts = parts.filter(p => PRESET_PARTS.includes(p));
  const customPart = parts.find(p => !BODY_PARTS.includes(p)) ?? "";
  const kitaOn = parts.includes("기타") || !!customPart;
  const [customText, setCustomText] = useState(customPart);

  const totalCount = presetParts.length + (kitaOn ? 1 : 0);

  const toggle = (bp: string) => {
    if (bp === "기타") {
      if (kitaOn) {
        onChange(presetParts.join(","));
        setCustomText("");
      } else if (totalCount < max) {
        onChange([...presetParts, "기타"].join(","));
      }
    } else {
      if (presetParts.includes(bp)) {
        const next = presetParts.filter(p => p !== bp);
        onChange([...next, ...(kitaOn ? [customText || "기타"] : [])].join(","));
      } else if (totalCount < max) {
        onChange([...presetParts, bp, ...(kitaOn ? [customText || "기타"] : [])].join(","));
      }
    }
  };

  const handleCustomChange = (text: string) => {
    setCustomText(text);
    const stored = text.trim() || "기타";
    onChange([...presetParts, stored].join(","));
  };

  const displayParts = [...presetParts, kitaOn ? (customText || "기타") : ""].filter(Boolean);

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-1.5">
        {BODY_PARTS.map((bp) => {
          const isSelected = bp === "기타" ? kitaOn : presetParts.includes(bp);
          const isDisabled = !isSelected && totalCount >= max;
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
      {kitaOn && (
        <input
          type="text"
          placeholder="운동 부위 직접 입력..."
          value={customText}
          onChange={e => handleCustomChange(e.target.value)}
          className="w-full h-8 px-2 text-xs bg-input border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
        />
      )}
      {displayParts.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          선택: {displayParts.join(" · ")} ({displayParts.length}/{max})
        </p>
      )}
    </div>
  );
}
