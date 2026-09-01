import {
  User, Activity, Bone, FileText, Dumbbell, Package,
  DollarSign, ShieldAlert, PhoneCall, Award, MapPin,
  Clock, CheckCircle, AlertTriangle, ArrowRight, Star
} from "lucide-react";
import type { SalesbookData } from "../types";
import { jobTypeLabels } from "../data/templates";
import { designConcepts, type DesignConcept } from "../data/designConcepts";

interface Props {
  data: SalesbookData;
}

export default function SalesbookPreview({ data }: Props) {
  const concept = designConcepts.find(c => c.id === data.designConceptId) || designConcepts[0];
  const c = concept.colors;
  const jobLabel = data.jobType === "custom" ? (data.customJobTitle || "전문 트레이너") : jobTypeLabels[data.jobType];

  return (
    <div className="salesbook-preview max-w-4xl mx-auto">
      {/* Cover Page */}
      <div className="salesbook-page text-white rounded-2xl p-8 sm:p-12 mb-8 shadow-2xl relative overflow-hidden" style={{ background: concept.coverGradient }}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <div className="text-sm font-medium opacity-80 mb-4 tracking-widest uppercase">{jobLabel}</div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 leading-tight">
            {data.trainerName ? `${data.trainerName} 트레이너의` : "나만의"}<br />
            세일즈 가이드북
          </h1>
          <div className="flex flex-wrap gap-4 text-sm opacity-90 mb-8">
            {data.centerName && (
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{data.centerName}</span>
            )}
            {data.experienceYears && (
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />경력 {data.experienceYears}년</span>
            )}
          </div>
          {data.certificates.filter(c => c.name).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.certificates.filter(c => c.name).map(c => (
                <span key={c.id} className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
                  <Award className="w-3 h-3" />{c.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 1: Opening */}
      <SectionCard icon={<User className="w-5 h-5" />} number={1} title="상담을 시작하며" accentColor={c.primary}>
        {data.profilePhotoUrl && (
          <div className="mb-4 flex justify-center">
            <img src={data.profilePhotoUrl} alt="프로필" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
          </div>
        )}
        {data.openingMent && (
          <div className="bg-gray-50 rounded-xl p-5 mb-4 border-l-4 border-blue-400">
            <p className="text-sm text-gray-600 font-medium mb-1">오프닝 멘트</p>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{data.openingMent}</p>
          </div>
        )}
        {data.introPhilosophy && (
          <div className="bg-gray-50 rounded-xl p-5">
            <p className="text-sm text-gray-600 font-medium mb-1">트레이닝 철학</p>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{data.introPhilosophy}</p>
          </div>
        )}
      </SectionCard>

      {/* Section 2: Body Composition */}
      <SectionCard icon={<Activity className="w-5 h-5" />} number={2} title="체성분 분석 해설" accentColor={c.primary}>
        <div className="grid gap-4">
          {data.bodyCompItems.filter(b => b.name).map(item => (
            <div key={item.id} className="bg-gray-50 rounded-xl p-5">
              <h4 className="font-bold text-lg mb-2" style={{ color: c.primary }}>{item.name}</h4>
              {item.description && <p className="text-gray-700 text-sm leading-relaxed mb-3">{item.description}</p>}
              <div className="flex flex-wrap gap-3">
                {item.normalRange && (
                  <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full">
                    <CheckCircle className="w-3.5 h-3.5" />정상: {item.normalRange}
                  </span>
                )}
                {item.riskDescription && (
                  <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-medium px-3 py-1.5 rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5" />주의: {item.riskDescription}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Section 3: Musculoskeletal */}
      <SectionCard icon={<Bone className="w-5 h-5" />} number={3} title="근골격 분석 해설" accentColor={c.primary}>
        <div className="grid gap-4">
          {data.musculoskeletalItems.filter(m => m.area).map(item => (
            <div key={item.id} className="bg-gray-50 rounded-xl p-5">
              <h4 className="font-bold text-lg mb-2" style={{ color: c.primary }}>{item.area}</h4>
              {item.analysisPoint && (
                <div className="mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">분석 포인트</span>
                  <p className="text-gray-700 text-sm leading-relaxed mt-1">{item.analysisPoint}</p>
                </div>
              )}
              {item.painPattern && (
                <div className="bg-amber-50 rounded-lg p-3 mt-2">
                  <span className="text-xs font-semibold text-amber-600">통증 패턴</span>
                  <p className="text-amber-800 text-sm mt-1">{item.painPattern}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Section 4: Comprehensive */}
      <SectionCard icon={<FileText className="w-5 h-5" />} number={4} title="종합 소견" accentColor={c.primary}>
        {data.comprehensiveMent && (
          <div className="rounded-xl p-5 mb-4 border-l-4" style={{ borderColor: c.primary, backgroundColor: c.bgLight }}>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{data.comprehensiveMent}</p>
          </div>
        )}
        {data.riskConnectionMent && (
          <div className="bg-red-50 rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-red-700 text-sm">위험요소 연결</span>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{data.riskConnectionMent}</p>
          </div>
        )}
        {data.lifestyleConnectionMent && (
          <div className="bg-gray-50 rounded-xl p-5">
            <span className="font-semibold text-gray-600 text-sm">생활습관 연관성</span>
            <p className="text-gray-700 text-sm leading-relaxed mt-2 whitespace-pre-wrap">{data.lifestyleConnectionMent}</p>
          </div>
        )}
      </SectionCard>

      {/* Section 5: Necessity */}
      <SectionCard icon={<Dumbbell className="w-5 h-5" />} number={5} title="전문 지도의 필요성" accentColor={c.primary}>
        {data.exerciseNeedMent && (
          <div className="bg-gray-50 rounded-xl p-5 mb-4">
            <p className="font-semibold text-gray-700 text-sm mb-2">왜 운동이 필요한가?</p>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{data.exerciseNeedMent}</p>
          </div>
        )}
        {data.soloVsProMent && (
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-100 rounded-xl p-5">
              <p className="font-semibold text-gray-500 text-sm mb-2">혼자 운동하면...</p>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{data.soloVsProMent}</p>
            </div>
            <div className="rounded-xl p-5 border-2" style={{ borderColor: c.primary, backgroundColor: c.bgLight }}>
              <p className="font-semibold text-sm mb-2" style={{ color: c.primary }}>전문가와 함께하면!</p>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{data.proAdvantagesMent}</p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Section 6: Programs */}
      <SectionCard icon={<Package className="w-5 h-5" />} number={6} title="맞춤 프로그램 제안" accentColor={c.primary}>
        <div className="grid gap-4">
          {data.programs.filter(p => p.name).map((prog, idx) => (
            <div key={prog.id} className={`rounded-xl p-5 border-2 ${idx === 0 ? "border-2 shadow-md" : "border-gray-100"}`} style={idx === 0 ? { borderColor: c.primary } : {}}>
              {idx === 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-white px-2 py-0.5 rounded-full mb-3" style={{ backgroundColor: c.primary }}>
                  <Star className="w-3 h-3" /> 추천
                </span>
              )}
              <h4 className="font-bold text-lg text-gray-900 mb-3">{prog.name}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <span className="text-gray-500 text-xs">횟수</span>
                  <p className="font-semibold text-gray-800">{prog.frequency}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <span className="text-gray-500 text-xs">기간</span>
                  <p className="font-semibold text-gray-800">{prog.duration}</p>
                </div>
              </div>
              {prog.target && <p className="text-sm text-gray-600 mb-1"><span className="font-medium">대상:</span> {prog.target}</p>}
              {prog.expectedResult && (
                <div className="flex items-start gap-2 mt-2">
                  <ArrowRight className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-green-700 font-medium">{prog.expectedResult}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Section 7: Pricing */}
      <SectionCard icon={<DollarSign className="w-5 h-5" />} number={7} title="가격 안내" accentColor={c.primary}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-2 font-semibold text-gray-600">패키지</th>
                <th className="text-left py-3 px-2 font-semibold text-gray-600">횟수/기간</th>
                <th className="text-right py-3 px-2 font-semibold text-gray-600">정가</th>
                <th className="text-right py-3 px-2 font-semibold text-gray-600">할인가</th>
              </tr>
            </thead>
            <tbody>
              {data.pricePackages.filter(p => p.name).map((pkg, idx) => (
                <tr key={pkg.id} className={`border-b border-gray-100 ${idx === data.pricePackages.length - 1 ? "" : ""}`}>
                  <td className="py-3 px-2 font-medium text-gray-800">{pkg.name}</td>
                  <td className="py-3 px-2 text-gray-600">{pkg.sessions}</td>
                  <td className="py-3 px-2 text-right text-gray-400 line-through">{pkg.originalPrice}</td>
                  <td className="py-3 px-2 text-right font-bold" style={{ color: c.primary }}>{pkg.discountedPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.anchoringMent && (
          <div className="rounded-xl p-5 mt-4" style={{ backgroundColor: c.bgLight }}>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{data.anchoringMent}</p>
          </div>
        )}
        {data.discountConditionMent && (
          <div className="bg-amber-50 rounded-xl p-4 mt-3 flex items-start gap-2">
            <Star className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-amber-800 text-sm whitespace-pre-wrap">{data.discountConditionMent}</p>
          </div>
        )}
      </SectionCard>

      {/* Section 8: Objection Handling (Trainer Guide) */}
      <div className="trainer-guide-section">
        <SectionCard icon={<ShieldAlert className="w-5 h-5" />} number={8} title="거절 대응 가이드" accentColor={c.primary} trainerOnly>
          <div className="grid gap-4">
            {data.objections.filter(o => o.customerSays).map((obj, idx) => (
              <div key={obj.id} className="bg-gray-50 rounded-xl p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <span className="text-red-500 text-sm font-bold">{idx + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">고객 거절</p>
                    <p className="font-semibold text-gray-800 mt-0.5">"{obj.customerSays}"</p>
                  </div>
                </div>
                <div className="ml-11 bg-white rounded-lg p-4 border border-gray-100">
                  <p className="text-sm text-gray-500 font-medium mb-1">대응 스크립트</p>
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{obj.responseScript}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Section 9: Follow-up */}
      <SectionCard icon={<PhoneCall className="w-5 h-5" />} number={9} title="후속 관리" accentColor={c.primary}>
        <p className="text-sm font-semibold text-gray-700 mb-3">미등록 고객 후속 연락 시나리오</p>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {data.followUpScenarios.filter(f => f.timing).map((f, idx) => (
              <div key={f.id} className="relative pl-10">
                <div className="absolute left-2 w-5 h-5 rounded-full bg-white border-2 flex items-center justify-center text-[10px] font-bold" style={{ borderColor: c.primary, color: c.primary }}>
                  {idx + 1}
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: c.primary }}>{f.timing}</p>
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{f.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {data.reconsultMent && (
          <div className="bg-blue-50 rounded-xl p-5 mt-4">
            <p className="text-sm font-semibold text-blue-700 mb-1">재상담 유도</p>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{data.reconsultMent}</p>
          </div>
        )}
        {data.firstSessionGuideMent && (
          <div className="bg-green-50 rounded-xl p-5 mt-4">
            <p className="text-sm font-semibold text-green-700 mb-1">등록 고객 첫 수업 안내</p>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{data.firstSessionGuideMent}</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function SectionCard({ icon, number, title, accentColor, trainerOnly, children }: {
  icon: React.ReactNode;
  number: number;
  title: string;
  accentColor: string;
  trainerOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="section-card bg-white rounded-2xl shadow-md p-6 sm:p-8 mb-6 border border-gray-100">
      {trainerOnly && (
        <div className="bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full inline-block mb-4">
          트레이너 전용 가이드
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center" style={{ color: accentColor }}>
          {icon}
        </div>
        <div>
          <span className="text-xs text-gray-400 font-medium">SECTION {number}</span>
          <h3 className="font-bold text-xl text-gray-900">{title}</h3>
        </div>
      </div>
      {children}
    </div>
  );
}
