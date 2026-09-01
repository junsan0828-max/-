import { Check } from "lucide-react";
import { designConcepts } from "../data/designConcepts";

interface Props {
  selectedId: string;
  onChange: (id: string) => void;
}

export default function ConceptSelector({ selectedId, onChange }: Props) {
  return (
    <div className="mb-6 p-5 bg-white rounded-xl shadow-sm border border-gray-100">
      <label className="block text-sm font-medium text-gray-700 mb-1">디자인 컨셉 선택</label>
      <p className="text-xs text-gray-400 mb-3">세일즈북의 전체 색상과 분위기를 결정합니다</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {designConcepts.map((concept) => {
          const isSelected = selectedId === concept.id;
          return (
            <button
              key={concept.id}
              type="button"
              onClick={() => onChange(concept.id)}
              className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                isSelected
                  ? "border-gray-900 shadow-lg scale-[1.03]"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-md"
              }`}
            >
              <div
                className="w-full aspect-[3/2]"
                dangerouslySetInnerHTML={{ __html: concept.thumbnailSvg }}
              />
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-gray-900" />
                </div>
              )}
              <div className="px-2 py-1.5 bg-white">
                <p className="text-xs font-semibold text-gray-800 truncate">{concept.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{concept.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
