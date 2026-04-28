import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import {
  Plus, Search, Phone, MessageSquare, CheckCircle2,
  Clock, XCircle, UserCheck, ChevronLeft, ChevronRight,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "pending",    label: "상담대기", color: "text-amber-400",  bg: "bg-amber-400/10",  icon: Clock },
  { value: "consulted",  label: "상담완료", color: "text-blue-400",   bg: "bg-blue-400/10",   icon: MessageSquare },
  { value: "registered", label: "등록완료", color: "text-emerald-400",bg: "bg-emerald-400/10",icon: CheckCircle2 },
  { value: "dropped",    label: "등록보류", color: "text-red-400",    bg: "bg-red-400/10",    icon: XCircle },
];

const CONSULT_TYPES: Record<string, string[]> = {
  "방문상담": [],
  "예약상담": ["플레이스", "전화예약"],
  "소개상담": ["지인소개", "가족소개"],
};
const MAIN_TYPES = Object.keys(CONSULT_TYPES);
const INTEREST_OPTIONS = ["PT", "헬스", "기타"];
const AGE_OPTIONS = ["10대", "20대", "30대", "40대", "50대이상"];

type LeadForm = {
  name: string; phone: string; gender: string; ageGroup: string;
  channelId?: number; assignedTrainerId?: number;
  consultationDate: string;
  consultationTypes: string[];    // 대분류 복수 선택
  consultationSubTypes: string[]; // 소분류 복수 선택
  consultationNote: string;
  interestType: string; memo: string;
};

const defaultForm: LeadForm = {
  name: "", phone: "", gender: "", ageGroup: "",
  consultationDate: new Date().toISOString().substring(0, 10),
  consultationTypes: [], consultationSubTypes: [],
  consultationNote: "", interestType: "", memo: "",
};

export default function LeadsPage() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<LeadForm>(defaultForm);

  const { data: leadsData, isLoading } = trpc.gym.leads.list.useQuery({ year, month });
  const { data: channels } = trpc.gym.channels.list.useQuery();
  const { data: trainers } = trpc.trainers.list.useQuery();

  const createMutation = trpc.gym.leads.create.useMutation({
    onSuccess: () => { toast.success("상담이 등록되었습니다"); utils.gym.leads.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.gym.leads.update.useMutation({
    onSuccess: () => { toast.success("수정되었습니다"); utils.gym.leads.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.gym.leads.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다"); utils.gym.leads.invalidate(); },
  });

  function resetForm() { setShowForm(false); setEditId(null); setForm(defaultForm); }

  function openEdit(row: any) {
    setEditId(row.lead.id);
    setForm({
      name: row.lead.name,
      phone: row.lead.phone ?? "",
      gender: row.lead.gender ?? "",
      ageGroup: row.lead.ageGroup ?? "",
      channelId: row.lead.channelId ?? undefined,
      assignedTrainerId: row.lead.assignedTrainerId ?? undefined,
      consultationDate: row.lead.consultationDate ?? new Date().toISOString().substring(0, 10),
      consultationTypes: row.lead.consultationType ? row.lead.consultationType.split(",").filter(Boolean) : [],
      consultationSubTypes: row.lead.consultationSubTypes ? row.lead.consultationSubTypes.split(",").filter(Boolean) : [],
      consultationNote: row.lead.consultationNote ?? "",
      interestType: row.lead.interestType ?? "",
      memo: row.lead.memo ?? "",
    });
    setShowForm(true);
  }

  function toggleMainType(type: string) {
    setForm(f => {
      const exists = f.consultationTypes.includes(type);
      const newTypes = exists ? f.consultationTypes.filter(t => t !== type) : [...f.consultationTypes, type];
      // 선택 해제된 대분류의 소분류는 제거
      const validSubs = newTypes.flatMap(t => CONSULT_TYPES[t] ?? []);
      return { ...f, consultationTypes: newTypes, consultationSubTypes: f.consultationSubTypes.filter(s => validSubs.includes(s)) };
    });
  }

  function toggleSubType(sub: string) {
    setForm(f => {
      const exists = f.consultationSubTypes.includes(sub);
      return { ...f, consultationSubTypes: exists ? f.consultationSubTypes.filter(s => s !== sub) : [...f.consultationSubTypes, sub] };
    });
  }

  function handleSave(status: string) {
    if (!form.name.trim()) return toast.error("이름을 입력해주세요");
    const payload = {
      name: form.name,
      phone: form.phone || undefined,
      gender: form.gender || undefined,
      ageGroup: form.ageGroup || undefined,
      channelId: form.channelId,
      assignedTrainerId: form.assignedTrainerId,
      consultationDate: form.consultationDate || undefined,
      consultationType: form.consultationTypes.length > 0 ? form.consultationTypes.join(",") : undefined,
      consultationSubTypes: form.consultationSubTypes.length > 0 ? form.consultationSubTypes.join(",") : undefined,
      consultationNote: form.consultationNote || undefined,
      interestType: form.interestType || undefined,
      memo: form.memo || undefined,
      status,
    };
    if (editId) updateMutation.mutate({ id: editId, ...payload });
    else createMutation.mutate(payload);
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const filtered = (leadsData ?? []).filter(row => {
    const q = search.toLowerCase();
    const matchSearch = !q || row.lead.name.toLowerCase().includes(q) || (row.lead.phone ?? "").includes(q);
    const matchStatus = !filterStatus || row.lead.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // 월별 통계
  const statCounts = STATUS_OPTIONS.map(s => ({
    ...s,
    count: (leadsData ?? []).filter(r => r.lead.status === s.value).length,
  }));
  const total = (leadsData ?? []).length;
  const registered = (leadsData ?? []).filter(r => r.lead.status === "registered").length;
  const conversionRate = total > 0 ? Math.round((registered / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">상담 CRM</h1>
          <p className="text-xs text-muted-foreground">월별 상담 및 전환 관리</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ ...defaultForm, consultationDate: new Date().toISOString().substring(0, 10) }); }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          상담 추가
        </button>
      </div>

      {/* 월 선택 */}
      <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold text-foreground min-w-[100px] text-center">{year}년 {month}월</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-2">
        {statCounts.map(s => (
          <button key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? "" : s.value)}
            className={`rounded-xl p-3 border transition-all text-center ${filterStatus === s.value ? `${s.bg} border-current ${s.color}` : "bg-card border-border"}`}>
            <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* 전환율 */}
      {total > 0 && (
        <div className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">이번달 전환율</span>
          <div className="flex items-center gap-3">
            <div className="w-32 bg-muted rounded-full h-2">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${conversionRate}%` }} />
            </div>
            <span className="text-sm font-bold text-emerald-400">{conversionRate}%</span>
          </div>
        </div>
      )}

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 전화번호 검색..."
          className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">이 달 상담 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(row => {
            const s = STATUS_OPTIONS.find(s => s.value === row.lead.status);
            const mainTypes = row.lead.consultationType ? row.lead.consultationType.split(",").filter(Boolean) : [];
            const subTypes = row.lead.consultationSubTypes ? row.lead.consultationSubTypes.split(",").filter(Boolean) : [];
            return (
              <div key={row.lead.id} onClick={() => openEdit(row)}
                className="bg-card border border-border rounded-xl p-4 space-y-2 cursor-pointer hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{row.lead.name}</span>
                      {row.lead.gender && <span className="text-xs text-muted-foreground">{row.lead.gender}</span>}
                      {row.lead.ageGroup && <span className="text-xs text-muted-foreground">{row.lead.ageGroup}</span>}
                    </div>
                    {row.lead.phone && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{row.lead.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s?.bg} ${s?.color}`}>
                    {s && <s.icon className="h-3 w-3" />}
                    {s?.label}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {mainTypes.map(mt => (
                    <span key={mt} className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{mt}</span>
                  ))}
                  {subTypes.map(st => (
                    <span key={st} className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{st}</span>
                  ))}
                  {row.lead.interestType && (
                    <span className="bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full">{row.lead.interestType}</span>
                  )}
                  {row.channelName && (
                    <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{row.channelName}</span>
                  )}
                  {row.trainerName && (
                    <span className="bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full">{row.trainerName}</span>
                  )}
                </div>
                {row.lead.consultationNote && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{row.lead.consultationNote}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 상담 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end md:items-center justify-center p-4 pb-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-foreground">{editId ? "상담 수정" : "상담 일지"}</h2>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">

              {/* 이름 / 연락처 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">이름 *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">연락처</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              {/* 성별 / 연령대 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">성별</label>
                  <div className="flex gap-2 mt-1">
                    {["남", "여"].map(g => (
                      <button key={g} type="button" onClick={() => setForm(f => ({ ...f, gender: f.gender === g ? "" : g }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.gender === g ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">연령대</label>
                  <select value={form.ageGroup} onChange={e => setForm(f => ({ ...f, ageGroup: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {AGE_OPTIONS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {/* 상담 유형 대분류 — 복수 선택 */}
              <div>
                <label className="text-xs text-muted-foreground">상담 유형 (복수 선택 가능)</label>
                <div className="flex gap-2 mt-1">
                  {MAIN_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => toggleMainType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.consultationTypes.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 소분류 — 선택된 대분류의 소분류 전부 표시 */}
              {form.consultationTypes.some(t => CONSULT_TYPES[t]?.length > 0) && (
                <div>
                  <label className="text-xs text-muted-foreground">소분류 (복수 선택 가능)</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {form.consultationTypes.flatMap(t => CONSULT_TYPES[t] ?? []).map(sub => (
                      <button key={sub} type="button" onClick={() => toggleSubType(sub)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.consultationSubTypes.includes(sub) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 관심 프로그램 */}
              <div>
                <label className="text-xs text-muted-foreground">관심 프로그램</label>
                <div className="flex gap-2 mt-1">
                  {INTEREST_OPTIONS.map(o => (
                    <button key={o} type="button" onClick={() => setForm(f => ({ ...f, interestType: f.interestType === o ? "" : o }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.interestType === o ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              {/* 상담일 / 유입 채널 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">상담일</label>
                  <input type="date" value={form.consultationDate} onChange={e => setForm(f => ({ ...f, consultationDate: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">유입 채널</label>
                  <select value={form.channelId ?? ""} onChange={e => setForm(f => ({ ...f, channelId: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {(channels ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* 담당 트레이너 */}
              <div>
                <label className="text-xs text-muted-foreground">담당 트레이너</label>
                <select value={form.assignedTrainerId ?? ""} onChange={e => setForm(f => ({ ...f, assignedTrainerId: e.target.value ? Number(e.target.value) : undefined }))}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                  <option value="">선택</option>
                  {(trainers ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.trainerName}</option>)}
                </select>
              </div>

              {/* 상담 내용 */}
              <div>
                <label className="text-xs text-muted-foreground">상담 내용</label>
                <textarea value={form.consultationNote} onChange={e => setForm(f => ({ ...f, consultationNote: e.target.value }))} rows={3}
                  placeholder="상담 내용을 입력하세요..."
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              {/* 메모 */}
              <div>
                <label className="text-xs text-muted-foreground">메모</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={2}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

            </div>

            {/* 하단 상태 저장 버튼 */}
            <div className="p-4 border-t border-border shrink-0 space-y-2">
              <p className="text-xs text-muted-foreground text-center">아래 버튼을 누르면 상담 일지가 저장됩니다</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleSave("consulted")}
                  className="flex-1 bg-blue-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors">
                  상담완료
                </button>
                <button type="button" onClick={() => handleSave("registered")}
                  className="flex-1 bg-emerald-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-600 transition-colors">
                  등록완료
                </button>
                <button type="button" onClick={() => handleSave("dropped")}
                  className="flex-1 bg-red-500/80 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-red-600 transition-colors">
                  등록보류
                </button>
              </div>
              {editId && (
                <button type="button" onClick={() => { if (confirm("삭제하시겠습니까?")) { deleteMutation.mutate({ id: editId }); resetForm(); } }}
                  className="w-full border border-red-500/30 text-red-400 rounded-lg py-2 text-sm font-medium hover:bg-red-500/10">
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
