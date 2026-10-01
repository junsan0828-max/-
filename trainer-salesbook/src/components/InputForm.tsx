import { useState } from "react";
import {
  User, Building2, Award, Camera, MessageSquare, Heart,
  Activity, Bone, FileText, Dumbbell, Package, DollarSign,
  ShieldAlert, PhoneCall, Plus, Trash2, ChevronDown, ChevronUp
} from "lucide-react";
import type { SalesbookData, JobType, Certificate, BodyCompItem, MusculoskeletalItem, Program, PricePackage, Objection, FollowUpScenario } from "../types";
import { templates, jobTypeLabels, jobTypeColors } from "../data/templates";
import ConceptSelector from "./ConceptSelector";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

interface Props {
  onGenerate: (data: SalesbookData) => void;
}

interface SectionHeaderProps {
  icon: React.ReactNode;
  number: number;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}

function SectionHeader({ icon, number, title, isOpen, onToggle }: SectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-gray-200 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
          {number}
        </div>
        <span className="text-gray-500">{icon}</span>
        <span className="font-semibold text-gray-800">{title}</span>
      </div>
      {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>;
}

function Input({ value, onChange, placeholder, className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition ${className}`}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition resize-y"
    />
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2">
      <Plus className="w-4 h-4" /> {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="p-1 text-red-400 hover:text-red-600 transition">
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

export default function InputForm({ onGenerate }: Props) {
  const [jobType, setJobType] = useState<JobType>("pt");
  const [customJobTitle, setCustomJobTitle] = useState("");
  const [designConceptId, setDesignConceptId] = useState("powerful-red");
  const [data, setData] = useState(() => ({ ...templates.pt }));
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({ 1: true });

  function handleJobChange(jt: JobType) {
    setJobType(jt);
    const tpl = templates[jt];
    setData({
      ...tpl,
      certificates: tpl.certificates.map(c => ({ ...c, id: uid() })),
      bodyCompItems: tpl.bodyCompItems.map(b => ({ ...b, id: uid() })),
      musculoskeletalItems: tpl.musculoskeletalItems.map(m => ({ ...m, id: uid() })),
      programs: tpl.programs.map(p => ({ ...p, id: uid() })),
      pricePackages: tpl.pricePackages.map(p => ({ ...p, id: uid() })),
      objections: tpl.objections.map(o => ({ ...o, id: uid() })),
      followUpScenarios: tpl.followUpScenarios.map(f => ({ ...f, id: uid() })),
    });
  }

  function toggleSection(n: number) {
    setOpenSections(prev => ({ ...prev, [n]: !prev[n] }));
  }

  function updateCert(id: string, name: string) {
    setData(d => ({ ...d, certificates: d.certificates.map(c => c.id === id ? { ...c, name } : c) }));
  }
  function addCert() {
    setData(d => ({ ...d, certificates: [...d.certificates, { id: uid(), name: "" }] }));
  }
  function removeCert(id: string) {
    setData(d => ({ ...d, certificates: d.certificates.filter(c => c.id !== id) }));
  }

  function updateBodyComp<K extends keyof BodyCompItem>(id: string, key: K, val: BodyCompItem[K]) {
    setData(d => ({ ...d, bodyCompItems: d.bodyCompItems.map(b => b.id === id ? { ...b, [key]: val } : b) }));
  }
  function addBodyComp() {
    setData(d => ({ ...d, bodyCompItems: [...d.bodyCompItems, { id: uid(), name: "", description: "", normalRange: "", riskDescription: "" }] }));
  }
  function removeBodyComp(id: string) {
    setData(d => ({ ...d, bodyCompItems: d.bodyCompItems.filter(b => b.id !== id) }));
  }

  function updateMusculo<K extends keyof MusculoskeletalItem>(id: string, key: K, val: MusculoskeletalItem[K]) {
    setData(d => ({ ...d, musculoskeletalItems: d.musculoskeletalItems.map(m => m.id === id ? { ...m, [key]: val } : m) }));
  }
  function addMusculo() {
    setData(d => ({ ...d, musculoskeletalItems: [...d.musculoskeletalItems, { id: uid(), area: "", analysisPoint: "", painPattern: "" }] }));
  }
  function removeMusculo(id: string) {
    setData(d => ({ ...d, musculoskeletalItems: d.musculoskeletalItems.filter(m => m.id !== id) }));
  }

  function updateProgram<K extends keyof Program>(id: string, key: K, val: Program[K]) {
    setData(d => ({ ...d, programs: d.programs.map(p => p.id === id ? { ...p, [key]: val } : p) }));
  }
  function addProgram() {
    setData(d => ({ ...d, programs: [...d.programs, { id: uid(), name: "", frequency: "", duration: "", target: "", expectedResult: "" }] }));
  }
  function removeProgram(id: string) {
    setData(d => ({ ...d, programs: d.programs.filter(p => p.id !== id) }));
  }

  function updatePrice<K extends keyof PricePackage>(id: string, key: K, val: PricePackage[K]) {
    setData(d => ({ ...d, pricePackages: d.pricePackages.map(p => p.id === id ? { ...p, [key]: val } : p) }));
  }
  function addPrice() {
    setData(d => ({ ...d, pricePackages: [...d.pricePackages, { id: uid(), name: "", sessions: "", originalPrice: "", discountedPrice: "" }] }));
  }
  function removePrice(id: string) {
    setData(d => ({ ...d, pricePackages: d.pricePackages.filter(p => p.id !== id) }));
  }

  function updateObjection<K extends keyof Objection>(id: string, key: K, val: Objection[K]) {
    setData(d => ({ ...d, objections: d.objections.map(o => o.id === id ? { ...o, [key]: val } : o) }));
  }
  function addObjection() {
    setData(d => ({ ...d, objections: [...d.objections, { id: uid(), customerSays: "", responseScript: "" }] }));
  }
  function removeObjection(id: string) {
    setData(d => ({ ...d, objections: d.objections.filter(o => o.id !== id) }));
  }

  function updateFollowUp<K extends keyof FollowUpScenario>(id: string, key: K, val: FollowUpScenario[K]) {
    setData(d => ({ ...d, followUpScenarios: d.followUpScenarios.map(f => f.id === id ? { ...f, [key]: val } : f) }));
  }
  function addFollowUp() {
    setData(d => ({ ...d, followUpScenarios: [...d.followUpScenarios, { id: uid(), timing: "", message: "" }] }));
  }
  function removeFollowUp(id: string) {
    setData(d => ({ ...d, followUpScenarios: d.followUpScenarios.filter(f => f.id !== id) }));
  }

  function handleSubmit() {
    onGenerate({ ...data, jobType, customJobTitle, designConceptId });
  }

  const colors = jobTypeColors[jobType];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">트레이너 세일즈북 생성기</h1>
        <p className="text-gray-500">상담에 필요한 정보를 입력하고, 전문적인 세일즈북을 제작하세요</p>
      </div>

      {/* Job Type Selection */}
      <div className="mb-6 p-5 bg-white rounded-xl shadow-sm border border-gray-100">
        <Label>직종 선택</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
          {(Object.keys(jobTypeLabels) as JobType[]).map((jt) => (
            <button
              key={jt}
              type="button"
              onClick={() => handleJobChange(jt)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                jobType === jt
                  ? `bg-gradient-to-r ${jobTypeColors[jt].gradient} text-white shadow-md scale-[1.02]`
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {jobTypeLabels[jt]}
            </button>
          ))}
        </div>
        {jobType === "custom" && (
          <div className="mt-3">
            <Input value={customJobTitle} onChange={setCustomJobTitle} placeholder="직종명을 입력하세요" />
          </div>
        )}
      </div>

      {/* Design Concept Selection */}
      <ConceptSelector selectedId={designConceptId} onChange={setDesignConceptId} />

      {/* Section 1 */}
      <div className="mb-3">
        <SectionHeader icon={<User className="w-4 h-4" />} number={1} title="상담 시작" isOpen={!!openSections[1]} onToggle={() => toggleSection(1)} />
        {openSections[1] && (
          <div className="mt-2 p-5 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>이름</Label><Input value={data.trainerName} onChange={v => setData(d => ({ ...d, trainerName: v }))} placeholder="홍길동" /></div>
              <div><Label>소속 지점/센터명</Label><Input value={data.centerName} onChange={v => setData(d => ({ ...d, centerName: v }))} placeholder="OO피트니스 강남점" /></div>
              <div><Label>경력 (년)</Label><Input value={data.experienceYears} onChange={v => setData(d => ({ ...d, experienceYears: v }))} placeholder="5" /></div>
              <div><Label>프로필 사진 URL</Label><Input value={data.profilePhotoUrl} onChange={v => setData(d => ({ ...d, profilePhotoUrl: v }))} placeholder="https://..." /></div>
            </div>
            <div>
              <Label>자격증</Label>
              {data.certificates.map((c) => (
                <div key={c.id} className="flex items-center gap-2 mb-2">
                  <Input value={c.name} onChange={v => updateCert(c.id, v)} placeholder="자격증명" />
                  {data.certificates.length > 1 && <RemoveButton onClick={() => removeCert(c.id)} />}
                </div>
              ))}
              <AddButton onClick={addCert} label="자격증 추가" />
            </div>
            <div><Label>상담 오프닝 멘트</Label><Textarea value={data.openingMent} onChange={v => setData(d => ({ ...d, openingMent: v }))} rows={4} /></div>
            <div><Label>자기소개 & 트레이닝 철학</Label><Textarea value={data.introPhilosophy} onChange={v => setData(d => ({ ...d, introPhilosophy: v }))} rows={4} /></div>
          </div>
        )}
      </div>

      {/* Section 2 */}
      <div className="mb-3">
        <SectionHeader icon={<Activity className="w-4 h-4" />} number={2} title="체성분 해설" isOpen={!!openSections[2]} onToggle={() => toggleSection(2)} />
        {openSections[2] && (
          <div className="mt-2 p-5 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
            {data.bodyCompItems.map((item, idx) => (
              <div key={item.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">항목 {idx + 1}</span>
                  {data.bodyCompItems.length > 1 && <RemoveButton onClick={() => removeBodyComp(item.id)} />}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>항목명</Label><Input value={item.name} onChange={v => updateBodyComp(item.id, "name", v)} placeholder="체중" /></div>
                  <div><Label>정상 기준 수치</Label><Input value={item.normalRange} onChange={v => updateBodyComp(item.id, "normalRange", v)} /></div>
                </div>
                <div><Label>해설 멘트</Label><Textarea value={item.description} onChange={v => updateBodyComp(item.id, "description", v)} rows={2} /></div>
                <div><Label>위험 구간 설명</Label><Textarea value={item.riskDescription} onChange={v => updateBodyComp(item.id, "riskDescription", v)} rows={2} /></div>
              </div>
            ))}
            <AddButton onClick={addBodyComp} label="항목 추가" />
          </div>
        )}
      </div>

      {/* Section 3 */}
      <div className="mb-3">
        <SectionHeader icon={<Bone className="w-4 h-4" />} number={3} title="근골격 해설" isOpen={!!openSections[3]} onToggle={() => toggleSection(3)} />
        {openSections[3] && (
          <div className="mt-2 p-5 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
            {data.musculoskeletalItems.map((item, idx) => (
              <div key={item.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">부위 {idx + 1}</span>
                  {data.musculoskeletalItems.length > 1 && <RemoveButton onClick={() => removeMusculo(item.id)} />}
                </div>
                <div><Label>부위명</Label><Input value={item.area} onChange={v => updateMusculo(item.id, "area", v)} /></div>
                <div><Label>자세 분석 포인트</Label><Textarea value={item.analysisPoint} onChange={v => updateMusculo(item.id, "analysisPoint", v)} rows={2} /></div>
                <div><Label>통증 패턴 설명</Label><Textarea value={item.painPattern} onChange={v => updateMusculo(item.id, "painPattern", v)} rows={2} /></div>
              </div>
            ))}
            <AddButton onClick={addMusculo} label="부위 추가" />
          </div>
        )}
      </div>

      {/* Section 4 */}
      <div className="mb-3">
        <SectionHeader icon={<FileText className="w-4 h-4" />} number={4} title="종합 설명" isOpen={!!openSections[4]} onToggle={() => toggleSection(4)} />
        {openSections[4] && (
          <div className="mt-2 p-5 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div><Label>종합 소견 멘트</Label><Textarea value={data.comprehensiveMent} onChange={v => setData(d => ({ ...d, comprehensiveMent: v }))} rows={4} /></div>
            <div><Label>위험요소 연결 설명</Label><Textarea value={data.riskConnectionMent} onChange={v => setData(d => ({ ...d, riskConnectionMent: v }))} rows={3} /></div>
            <div><Label>생활습관 연관성 설명</Label><Textarea value={data.lifestyleConnectionMent} onChange={v => setData(d => ({ ...d, lifestyleConnectionMent: v }))} rows={3} /></div>
          </div>
        )}
      </div>

      {/* Section 5 */}
      <div className="mb-3">
        <SectionHeader icon={<Dumbbell className="w-4 h-4" />} number={5} title="PT 필요성" isOpen={!!openSections[5]} onToggle={() => toggleSection(5)} />
        {openSections[5] && (
          <div className="mt-2 p-5 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div><Label>운동이 필요한 이유</Label><Textarea value={data.exerciseNeedMent} onChange={v => setData(d => ({ ...d, exerciseNeedMent: v }))} rows={3} /></div>
            <div><Label>혼자 운동 vs 전문가 지도 비교</Label><Textarea value={data.soloVsProMent} onChange={v => setData(d => ({ ...d, soloVsProMent: v }))} rows={3} /></div>
            <div><Label>전문 지도의 장점</Label><Textarea value={data.proAdvantagesMent} onChange={v => setData(d => ({ ...d, proAdvantagesMent: v }))} rows={4} /></div>
          </div>
        )}
      </div>

      {/* Section 6 */}
      <div className="mb-3">
        <SectionHeader icon={<Package className="w-4 h-4" />} number={6} title="프로그램 제안" isOpen={!!openSections[6]} onToggle={() => toggleSection(6)} />
        {openSections[6] && (
          <div className="mt-2 p-5 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
            {data.programs.map((p, idx) => (
              <div key={p.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">프로그램 {idx + 1}</span>
                  {data.programs.length > 1 && <RemoveButton onClick={() => removeProgram(p.id)} />}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>프로그램명</Label><Input value={p.name} onChange={v => updateProgram(p.id, "name", v)} /></div>
                  <div><Label>주 횟수</Label><Input value={p.frequency} onChange={v => updateProgram(p.id, "frequency", v)} placeholder="주 3회" /></div>
                  <div><Label>기간</Label><Input value={p.duration} onChange={v => updateProgram(p.id, "duration", v)} placeholder="3개월 (36회)" /></div>
                  <div><Label>대상</Label><Input value={p.target} onChange={v => updateProgram(p.id, "target", v)} /></div>
                </div>
                <div><Label>기대효과</Label><Textarea value={p.expectedResult} onChange={v => updateProgram(p.id, "expectedResult", v)} rows={2} /></div>
              </div>
            ))}
            <AddButton onClick={addProgram} label="프로그램 추가" />
          </div>
        )}
      </div>

      {/* Section 7 */}
      <div className="mb-3">
        <SectionHeader icon={<DollarSign className="w-4 h-4" />} number={7} title="가격 제안" isOpen={!!openSections[7]} onToggle={() => toggleSection(7)} />
        {openSections[7] && (
          <div className="mt-2 p-5 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
            {data.pricePackages.map((p, idx) => (
              <div key={p.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">패키지 {idx + 1}</span>
                  {data.pricePackages.length > 1 && <RemoveButton onClick={() => removePrice(p.id)} />}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>패키지명</Label><Input value={p.name} onChange={v => updatePrice(p.id, "name", v)} /></div>
                  <div><Label>횟수/기간</Label><Input value={p.sessions} onChange={v => updatePrice(p.id, "sessions", v)} /></div>
                  <div><Label>정가</Label><Input value={p.originalPrice} onChange={v => updatePrice(p.id, "originalPrice", v)} /></div>
                  <div><Label>할인가</Label><Input value={p.discountedPrice} onChange={v => updatePrice(p.id, "discountedPrice", v)} /></div>
                </div>
              </div>
            ))}
            <AddButton onClick={addPrice} label="패키지 추가" />
            <div className="mt-4"><Label>가격 앵커링 전략 멘트</Label><Textarea value={data.anchoringMent} onChange={v => setData(d => ({ ...d, anchoringMent: v }))} rows={3} /></div>
            <div><Label>할인 조건 설명</Label><Textarea value={data.discountConditionMent} onChange={v => setData(d => ({ ...d, discountConditionMent: v }))} rows={2} /></div>
          </div>
        )}
      </div>

      {/* Section 8 */}
      <div className="mb-3">
        <SectionHeader icon={<ShieldAlert className="w-4 h-4" />} number={8} title="거절 대응" isOpen={!!openSections[8]} onToggle={() => toggleSection(8)} />
        {openSections[8] && (
          <div className="mt-2 p-5 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
            <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">이 섹션은 세일즈북 PDF에서 "트레이너 전용 가이드"로 분리되어 표시됩니다.</p>
            {data.objections.map((o, idx) => (
              <div key={o.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">거절 유형 {idx + 1}</span>
                  {data.objections.length > 1 && <RemoveButton onClick={() => removeObjection(o.id)} />}
                </div>
                <div><Label>고객 거절 멘트</Label><Input value={o.customerSays} onChange={v => updateObjection(o.id, "customerSays", v)} placeholder='"비싸요", "생각해볼게요" 등' /></div>
                <div><Label>대응 스크립트</Label><Textarea value={o.responseScript} onChange={v => updateObjection(o.id, "responseScript", v)} rows={3} /></div>
              </div>
            ))}
            <AddButton onClick={addObjection} label="거절 유형 추가" />
          </div>
        )}
      </div>

      {/* Section 9 */}
      <div className="mb-6">
        <SectionHeader icon={<PhoneCall className="w-4 h-4" />} number={9} title="후속관리" isOpen={!!openSections[9]} onToggle={() => toggleSection(9)} />
        {openSections[9] && (
          <div className="mt-2 p-5 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
            <p className="text-sm font-medium text-gray-700 mb-2">미등록 고객 후속 연락 시나리오</p>
            {data.followUpScenarios.map((f, idx) => (
              <div key={f.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">시나리오 {idx + 1}</span>
                  {data.followUpScenarios.length > 1 && <RemoveButton onClick={() => removeFollowUp(f.id)} />}
                </div>
                <div><Label>시점</Label><Input value={f.timing} onChange={v => updateFollowUp(f.id, "timing", v)} placeholder="상담 당일, 3일 후 등" /></div>
                <div><Label>메시지</Label><Textarea value={f.message} onChange={v => updateFollowUp(f.id, "message", v)} rows={3} /></div>
              </div>
            ))}
            <AddButton onClick={addFollowUp} label="시나리오 추가" />
            <div className="mt-4"><Label>재상담 유도 멘트</Label><Textarea value={data.reconsultMent} onChange={v => setData(d => ({ ...d, reconsultMent: v }))} rows={3} /></div>
            <div><Label>등록 고객 첫 수업 안내 멘트</Label><Textarea value={data.firstSessionGuideMent} onChange={v => setData(d => ({ ...d, firstSessionGuideMent: v }))} rows={4} /></div>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        type="button"
        onClick={handleSubmit}
        className={`w-full py-4 rounded-xl text-white font-bold text-lg bg-gradient-to-r ${colors.gradient} shadow-lg hover:shadow-xl transform hover:scale-[1.01] transition-all`}
      >
        세일즈북 제작하기
      </button>
    </div>
  );
}
