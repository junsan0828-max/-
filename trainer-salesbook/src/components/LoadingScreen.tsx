import { useState, useEffect } from "react";

const messages = [
  "세일즈북 구조를 설계하고 있습니다...",
  "체성분 해설을 정리하고 있습니다...",
  "근골격 분석 가이드를 구성하고 있습니다...",
  "프로그램 제안서를 작성하고 있습니다...",
  "가격표를 배치하고 있습니다...",
  "거절 대응 스크립트를 정리하고 있습니다...",
  "디자인을 다듬고 있습니다...",
  "거의 완성되었습니다!",
];

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 2;
      });
    }, 40);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center max-w-md px-8">
        <div className="w-16 h-16 mx-auto mb-6 relative">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
          <div
            className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"
          />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">세일즈북을 제작하고 있습니다</h2>
        <p className="text-sm text-gray-500 mb-6 h-5">{messages[msgIdx]}</p>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">{progress}%</p>
      </div>
    </div>
  );
}
