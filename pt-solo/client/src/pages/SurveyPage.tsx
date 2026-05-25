import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { CheckCircle, ChevronRight } from "lucide-react";

interface Props { username: string; }

export default function SurveyPage({ username }: Props) {
  const { data, isLoading, error } = trpc.survey.getPublic.useQuery({ username });
  const [step, setStep] = useState<"info" | "questions" | "done">("info");
  const [info, setInfo] = useState({ name: "", phone: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const submitMutation = trpc.survey.submit.useMutation({
    onSuccess: () => setStep("done"),
  });

  const primaryColor = data?.trainer?.brandColor || "#1a00ff";

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${primaryColor} transparent transparent transparent` }} />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 p-6">
      <p className="text-gray-500 text-sm">설문을 찾을 수 없습니다.</p>
    </div>
  );

  const { trainer, questions } = data;
  const progress = step === "info" ? 0 : step === "done" ? 100 : 50;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-sm mx-auto flex items-center gap-3">
          {trainer.profileImage ? (
            <img src={trainer.profileImage} alt={trainer.trainerName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: primaryColor }}>
              {trainer.trainerName?.[0]}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-800">{trainer.trainerName} 트레이너</p>
            <p className="text-xs text-gray-400">상담 전 설문</p>
          </div>
        </div>
        {/* 진행 바 */}
        <div className="max-w-sm mx-auto mt-2 h-1 bg-gray-100 rounded-full">
          <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: primaryColor }} />
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6">
        {/* 완료 화면 */}
        {step === "done" && (
          <div className="py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: `${primaryColor}20` }}>
              <CheckCircle className="h-8 w-8" style={{ color: primaryColor }} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">설문 완료!</h2>
            <p className="text-sm text-gray-500">{info.name}님의 응답이 전달됐습니다.<br />{trainer.trainerName} 트레이너가 곧 연락드립니다.</p>
            <p className="text-xs text-gray-400 pt-4">Powered by FIT STEP</p>
          </div>
        )}

        {/* 기본 정보 입력 */}
        {step === "info" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-gray-800">안녕하세요 👋</h1>
              <p className="text-sm text-gray-500 mt-1">상담 전 간단한 정보를 입력해주세요.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500">이름 *</label>
                <input value={info.name} onChange={e => setInfo(p => ({ ...p, name: e.target.value }))}
                  placeholder="홍길동" className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 bg-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">연락처</label>
                <input value={info.phone} onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))}
                  placeholder="010-0000-0000" className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 bg-white" />
              </div>
            </div>
            <button disabled={!info.name}
              onClick={() => setStep(questions.length > 0 ? "questions" : "done")}
              className="w-full py-4 rounded-xl text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}>
              {questions.length > 0 ? "다음" : "제출하기"}
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* 설문 문항 */}
        {step === "questions" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-gray-800">설문 응답</h1>
              <p className="text-sm text-gray-500 mt-1">총 {questions.length}개 문항</p>
            </div>
            {questions.map((q: any, i: number) => (
              <div key={q.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                <p className="text-sm font-medium text-gray-800">
                  {i + 1}. {q.question}
                  {q.isRequired ? <span className="text-red-400 ml-1">*</span> : null}
                </p>
                {q.type === "text" && (
                  <textarea value={answers[q.id] ?? ""} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                    rows={3} placeholder="답변을 입력하세요..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" />
                )}
                {q.type === "choice" && (
                  <div className="space-y-2">
                    {(q.options ?? "").split(",").map((opt: string, j: number) => (
                      <button key={j} onClick={() => setAnswers(p => ({ ...p, [q.id]: opt.trim() }))}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm border transition-colors ${answers[q.id] === opt.trim() ? "border-2 font-medium text-white" : "border-gray-200 text-gray-700 bg-white"}`}
                        style={answers[q.id] === opt.trim() ? { borderColor: primaryColor, backgroundColor: primaryColor } : {}}>
                        {opt.trim()}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "scale" && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setAnswers(p => ({ ...p, [q.id]: String(n) }))}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors"
                        style={answers[q.id] === String(n) ? { backgroundColor: primaryColor, borderColor: primaryColor, color: "white" } : { borderColor: "#e5e7eb", color: "#374151" }}>
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button
              disabled={submitMutation.isPending || questions.filter((q: any) => q.isRequired).some((q: any) => !answers[q.id])}
              onClick={() => submitMutation.mutate({ username, respondentName: info.name, respondentPhone: info.phone, answers })}
              className="w-full py-4 rounded-xl text-white font-bold disabled:opacity-40"
              style={{ backgroundColor: primaryColor }}>
              {submitMutation.isPending ? "제출 중..." : "제출하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
