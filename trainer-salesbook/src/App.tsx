import { useState, useCallback } from "react";
import { Download, Edit3, ArrowUp } from "lucide-react";
import InputForm from "./components/InputForm";
import SalesbookPreview from "./components/SalesbookPreview";
import LoadingScreen from "./components/LoadingScreen";
import type { SalesbookData } from "./types";

export default function App() {
  const [state, setState] = useState<"input" | "loading" | "preview">("input");
  const [salesbookData, setSalesbookData] = useState<SalesbookData | null>(null);

  const handleGenerate = useCallback((data: SalesbookData) => {
    setSalesbookData(data);
    setState("loading");
    setTimeout(() => {
      setState("preview");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 2200);
  }, []);

  const handleEdit = useCallback(() => {
    setState("input");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (state === "loading") {
    return <LoadingScreen />;
  }

  if (state === "preview" && salesbookData) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Top Bar */}
        <div className="no-print sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">세일즈북 미리보기</h1>
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
              >
                <Edit3 className="w-4 h-4" />
                수정하기
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition"
              >
                <Download className="w-4 h-4" />
                PDF 다운로드
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="py-8 px-4">
          <SalesbookPreview data={salesbookData} />
        </div>

        {/* Scroll to top */}
        <button
          onClick={scrollToTop}
          className="no-print fixed bottom-6 right-6 w-12 h-12 bg-white shadow-lg rounded-full flex items-center justify-center border border-gray-200 hover:shadow-xl transition"
        >
          <ArrowUp className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <InputForm onGenerate={handleGenerate} />
    </div>
  );
}
