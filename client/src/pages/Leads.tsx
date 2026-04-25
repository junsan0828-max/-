import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import {
  Plus, Search, Phone, MessageSquare, CheckCircle2,
  Clock, XCircle, UserCheck, Filter, ChevronDown,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "pending", label: "상담대기", color: "text-amber-400", bg: "bg-amber-400/10", icon: Clock },
  { value: "consulted", label: "상담완료", color: "text-blue-400", bg: "bg-blue-400/10", icon: MessageSquare },
  { value: "registered", label: "등록완료", color: "text-emerald-400", bg: "bg-emerald-400/10", icon: CheckCircle2 },
  { value: "dropped", label: "미등록", color: "text-red-400", bg: "bg-red-400/10", icon: XCircle },
];

const INTEREST_OPTIONS = ["PT", "헬스", "기타"];
const AGE_OPTIONS = ["10대", "20대", "30대", "40대", "50대이상"];

type LeadForm = {
  name: string; phone: string; email: string; gender: string; ageGroup: string;
  channelId?: number; status: string; assignedTrainerId?: number;
  consultationDate: string; consultationNote: string; interestType: string; memo: string;
};

const defaultForm: LeadForm = {
  name: "", phone: "", email: "", gender: "", ageGroup: "",
  status: "pending", consultationDate: "", consultationNote: "", interestType: "", memo: "",
};

export default function LeadsPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<LeadForm>(defaultForm);
  const [showFilter, setShowFilter] = useState(false);

  const { data: leadsData, isLoading } = trpc.gym.leads.list.useQuery({});
  const { data: channels } = trpc.gym.channels.list.useQuery();
  const { data: trainers } = trpc.trainers.list.useQuery();
  const { data: stats } = trpc.gym.leads.stats.useQuery();

  const createMutation = trpc.gym.leads.create.useMutation({
    onSuccess: () => { toast.success("리드가 등록되었습니다"); utils.gym.leads.invalidate(); utils.gym.leads.stats.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.gym.leads.update.useMutation({
    onSuccess: () => { toast.success("수정되었습니다"); utils.gym.leads.invalidate(); utils.gym.leads.stats.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.gym.leads.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다"); utils.gym.leads.invalidate(); utils.gym.leads.stats.invalidate(); },
  });

  function resetForm() { setShowForm(false); setEditId(null); setForm(defaultForm); }

  function openEdit(lead: any) {
    setEditId(lead.lead.id);
    setForm({
      name: lead.lead.name,
      phone: lead.lead.phone ?? "",
      email: lead.lead.email ?? "",
      gender: lead.lead.gender ?? "",
      ageGroup: lead.lead.ageGroup ?? "",
      channelId: lead.lead.channelId ?? undefined,
      status: lead.lead.status,
      assignedTrainerId: lead.lead.assignedTrainerId ?? undefined,
      consultationDate: lead.lead.consultationDate ?? "",
      consultationNote: lead.lead.consultationNote ?? "",
      interestType: lead.lead.interestType ?? "",
      memo: lead.lead.memo ?? "",
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("이름을 입력해주세요");
    const payload = {
      ...form,
      channelId: form.channelId ? Number(form.channelId) : undefined,
      assignedTrainerId: form.assignedTrainerId ? Number(form.assignedTrainerId) : undefined,
    };
    if (editId) updateMutation.mutate({ id: editId, ...payload });
    else createMutation.mutate(payload);
  }

  const filtered = (leadsData ?? []).filter(row => {
    const q = search.toLowerCase();
    const matchSearch = !q || row.lead.name.toLowerCase().includes(q) || (row.lead.phone ?? "").includes(q);
    const matchStatus = !filterStatus || row.lead.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">리드 CRM</h1>
          <p className="text-xs text-muted-foreground">상담 문의 및 전환 관리</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(defaultForm); }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          리드 추가
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-2">
        {STATUS_OPTIONS.map(s => {
          const count = s.value === "pending" ? stats?.pending
            : s.value === "consulted" ? stats?.consulted
            : s.value === "registered" ? stats?.registered
            : stats?.dropped;
          return (
            <button
              key={s.value}
              onClick={() => setFilterStatus(filterStatus === s.value ? "" : s.value)}
              className={`rounded-xl p-3 border transition-all text-center ${filterStatus === s.value ? `${s.bg} border-current ${s.color}` : "bg-card border-border"}`}
            >
              <div className={`text-lg font-bold ${s.color}`}>{count ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* 전환율 표시 */}
      {stats && stats.total > 0 && (
        <div className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">전체 전환율</span>
          <div className="flex items-center gap-3">
            <div className="w-32 bg-muted rounded-full h-2">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${stats.conversionRate}%` }} />
            </div>
            <span className="text-sm font-bold text-emerald-400">{stats.conversionRate}%</span>
          </div>
        </div>
      )}

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름, 전화번호 검색..."
          className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* 리드 목록 */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">리드가 없습니다</p>
          <p className="text-xs mt-1">상담 문의를 추가해보세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(row => {
            const s = STATUS_OPTIONS.find(s => s.value === row.lead.status);
            return (
              <div
                key={row.lead.id}
                className="bg-card border border-border rounded-xl p-4 space-y-2 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => openEdit(row)}
              >
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
                <div className="flex flex-wrap gap-2 text-xs">
                  {row.channelName && (
                    <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{row.channelName}</span>
                  )}
                  {row.lead.interestType && (
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{row.lead.interestType}</span>
                  )}
                  {row.trainerName && (
                    <span className="bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full">{row.trainerName}</span>
                  )}
                  {row.lead.consultationDate && (
                    <span className="text-muted-foreground">상담일: {row.lead.consultationDate}</span>
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

      {/* 리드 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">{editId ? "리드 수정" : "리드 추가"}</h2>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">이름 *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">전화번호</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">성별</label>
                  <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    <option>남</option><option>여</option>
                  </select>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">유입 채널</label>
                  <select value={form.channelId ?? ""} onChange={e => setForm(f => ({ ...f, channelId: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">채널 선택</option>
                    {(channels ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">관심 프로그램</label>
                  <select value={form.interestType} onChange={e => setForm(f => ({ ...f, interestType: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {INTEREST_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">상태</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">담당 트레이너</label>
                  <select value={form.assignedTrainerId ?? ""} onChange={e => setForm(f => ({ ...f, assignedTrainerId: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {(trainers ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.trainerName}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">상담 예약일</label>
                <input type="date" value={form.consultationDate} onChange={e => setForm(f => ({ ...f, consultationDate: e.target.value }))}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">상담 내용</label>
                <textarea value={form.consultationNote} onChange={e => setForm(f => ({ ...f, consultationNote: e.target.value }))} rows={3}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">메모</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={2}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              <div className="flex gap-2 pt-2">
                {editId && (
                  <button type="button" onClick={() => { if (confirm("삭제하시겠습니까?")) { deleteMutation.mutate({ id: editId }); resetForm(); } }}
                    className="flex-1 border border-red-500/30 text-red-400 rounded-lg py-2.5 text-sm font-medium hover:bg-red-500/10">
                    삭제
                  </button>
                )}
                <button type="submit" className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90">
                  {editId ? "수정" : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
