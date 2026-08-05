import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Dumbbell, TrendingUp, Calendar,
  AlertTriangle, ChevronRight, RefreshCw, Clock, BookOpen, ShieldCheck,
  Zap, FileText, CalendarCheck, BarChart3, Globe, UtensilsCrossed, ScanLine, UserPlus,
  Lock, Cpu, ArrowRight, Search, Pencil,
  ClipboardList, MessageCircle, FileSignature, ReceiptText, ArrowLeftRight,
  Wrench, PlaySquare, Target, Utensils, Activity, BookMarked, Video,
  Brain, Database, ArrowUpRight, PieChart, Share2, Sparkles, Wallet, Trash2, SquarePen, Plus, Check, X,
  Send,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import TabBanner from "@/components/TabBanner";
import ReportBrandingEditor from "@/components/editors/ReportBrandingEditor";
import ContractTermsEditor from "@/components/editors/ContractTermsEditor";
import WorkoutTemplateEditor from "@/components/editors/WorkoutTemplateEditor";
import SurveyBuilder from "@/components/editors/SurveyBuilder";
import EContractManager from "@/components/editors/EContractManager";
import RefundContractManager from "@/components/editors/RefundContractManager";
import TransferContractManager from "@/components/editors/TransferContractManager";
import { WorkoutLogSection, TrainerDietManager, VideoSection, WS_CATALOG } from "@/pages/Workshop";

// 작업실을 거치지 않고 대시보드 모달로 바로 여는 기능 — 하나씩 여기 추가하며 이전 중
const MODAL_FEATURE_IDS = new Set(["report_branding", "contract_terms", "templates", "survey", "e_contract", "refund_contract", "transfer_contract", "contract_kakao", "fitstep_personal", "fitstep_diet", "fitstep_videos"]);
const MODAL_FEATURE_META: Record<string, { title: string; Component: React.ComponentType }> = {
  report_branding: { title: "보고서 브랜딩", Component: ReportBrandingEditor },
  contract_terms: { title: "약관 브랜딩", Component: ContractTermsEditor },
  templates: { title: "운동 프로그램 템플릿", Component: WorkoutTemplateEditor },
  survey: { title: "맞춤 상담 설문 빌더", Component: SurveyBuilder },
  e_contract: { title: "비대면 전자계약", Component: EContractManager },
  refund_contract: { title: "환불 계약서", Component: RefundContractManager },
  transfer_contract: { title: "양도양수 계약서", Component: TransferContractManager },
  contract_kakao: { title: "계약서 카카오톡 공유", Component: EContractManager },
  fitstep_personal: { title: "개인 운동 기록 관리", Component: WorkoutLogSection },
  fitstep_diet: { title: "맞춤 식단 관리", Component: TrainerDietManager },
  fitstep_videos: { title: "운동 영상 관리", Component: VideoSection },
};

// ─── 아바타 색상 ──────────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-blue-400 to-indigo-500",
  "from-pink-400 to-rose-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-blue-500",
];

// ─── 작업실 기능 카탈로그 ──────────────────────────────────────────────────────
// PRO 전용: FIT STEP+(회원 전용 앱)와 그 부가기능(FIT STEP+ 안에서만 동작), 수업 예약뿐.
// 나머지는 전부 FREE에서도 이용 가능.
const FREE_IDS = new Set([
  "brand_page", "contract_kakao", "survey", "templates", "refund_contract", "transfer_contract",
  "report_branding", "contract_terms", "training_video", "e_contract",
  "member_overview", "activity_stats", "data_migration", "kpi_report", "consult_conversion",
  "monthly_pnl", "sales_analysis", "channel_analysis", "marketing_analysis",
  "renewal_analysis", "ai_insights",
]);
const PRO_IDS = new Set(["fitstep_plus", "fitstep_videos", "fitstep_rec", "fitstep_diet", "fitstep_personal", "booking"]);
const ELITE_IDS = new Set<string>([]);
// contract_kakao는 이미 편집 모달(EContractManager 재사용)로 연결돼 있어 "준비 중"이 아님
const COMING_SOON_IDS = new Set(["training_video", "member_overview", "activity_stats", "data_migration", "kpi_report", "consult_conversion", "channel_analysis", "marketing_analysis", "renewal_analysis", "ai_insights"]);

type WsDashItem = { id: string; icon: React.ElementType; name: string; };
type WsDashCat = {
  key: string; label: string; icon: React.ElementType;
  iconCls: string; bgCls: string; borderCls: string; itemColorCls: string;
  items: WsDashItem[];
};

type WsNavFn = (featureId?: string) => void;

const WS_DASH: WsDashCat[] = [
  {
    key: "branding", label: "브랜딩 · 예약",
    icon: Globe, iconCls: "text-blue-500", bgCls: "bg-blue-500/10", borderCls: "border-blue-500/20", itemColorCls: "text-blue-500",
    items: [
      { id: "brand_page",       icon: Globe,        name: "브랜드 페이지" },
      { id: "fitstep_plus",     icon: Wrench,       name: "FIT STEP+" },
      { id: "report_branding",  icon: BookMarked,   name: "보고서 브랜딩" },
      { id: "contract_terms",   icon: FileText,     name: "약관 브랜딩" },
      { id: "booking",          icon: Calendar,     name: "수업 예약" },
    ],
  },
  {
    key: "contract", label: "계약 · 상담",
    icon: FileSignature, iconCls: "text-cyan-500", bgCls: "bg-cyan-500/10", borderCls: "border-cyan-500/20", itemColorCls: "text-cyan-500",
    items: [
      { id: "survey",           icon: ClipboardList,  name: "상담 설문" },
      { id: "refund_contract",  icon: ReceiptText,    name: "환불 계약서" },
      { id: "transfer_contract",icon: ArrowLeftRight, name: "양도 계약서" },
      { id: "e_contract",       icon: FileSignature,  name: "비대면 계약" },
      { id: "contract_kakao",   icon: MessageCircle,  name: "카카오 공유" },
    ],
  },
];

type FeatureLock = "available" | "pro" | "soon" | "core";

function getFeatureLock(
  id: string,
  plan: string,
  featureConfigs?: Record<string, string>,
  addonUnlocks?: string[],
): FeatureLock {
  const cfg = featureConfigs?.[id];
  // 핵심(유료) 기능: 관리자가 지정, 개별 구매(1만원) 전까지 잠금 — 플랜 무관
  if (cfg === "addon_premium") {
    return addonUnlocks?.includes(id) ? "available" : "core";
  }
  // 출시 예정/숨김은 관리자 설정을 우선 반영 (설정이 없으면 카탈로그 기본값 사용)
  if (cfg === "coming_soon" || cfg === "hidden" || (!cfg && COMING_SOON_IDS.has(id))) return "soon";
  if (FREE_IDS.has(id)) return "available";
  // Elite 티어는 Pro로 흡수 — 엘리트 기능도 Pro 가입 시 개방
  // (관리자가 '활성'으로 지정했더라도 준비상태와 플랜 게이트는 별개이므로 잠금 유지)
  if (PRO_IDS.has(id) || ELITE_IDS.has(id)) return plan === "free" ? "pro" : "available";
  return "available";
}

// ─── 툴 그리드 (운영용) ───────────────────────────────────────────────────────
type ToolItem = {
  label: string;
  icon: React.ElementType;
  colorCls: string;
  bgCls: string;
  borderCls: string;
  onClick: () => void;
  badge?: number | null;
  locked?: boolean;
  comingSoon?: boolean;
};

function ToolGrid({ items }: { items: ToolItem[] }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item) => {
        const faded = item.locked || item.comingSoon;
        return (
          <button key={item.label} onClick={item.locked ? undefined : item.onClick} className="flex flex-col items-center gap-1.5 group">
            <div className={`relative w-14 h-14 rounded-[18px] ${item.bgCls} border ${item.borderCls} flex items-center justify-center transition-all active:scale-90 ${faded ? "opacity-40" : ""}`}>
              <item.icon className={`h-5 w-5 ${item.colorCls}`} />
              {item.badge != null && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center px-1 border-2 border-background">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
              {item.locked && (
                <div className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-background border border-border rounded-[5px] flex items-center justify-center">
                  <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                </div>
              )}
              {item.comingSoon && !item.locked && (
                <div className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-background border border-border rounded-[5px] flex items-center justify-center">
                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                </div>
              )}
            </div>
            <span className={`text-[10.5px] font-semibold text-center leading-tight ${faded ? "text-muted-foreground/40" : "text-foreground/65 group-hover:text-foreground"} transition-colors`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── 작업실 기능 아이템 ────────────────────────────────────────────────────────
function WsToolItem({ item, cat, lock, onClick }: { item: WsDashItem; cat: WsDashCat; lock: FeatureLock; onClick: (id: string) => void; }) {
  const unavailable = lock !== "available";
  return (
    <button onClick={() => onClick(item.id)} className="flex flex-col items-center gap-1.5 group">
      <div className={`relative w-14 h-14 rounded-[18px] ${cat.bgCls} border ${cat.borderCls} flex items-center justify-center transition-all active:scale-90 ${unavailable ? "opacity-40" : ""}`}>
        <item.icon className={`h-5 w-5 ${cat.itemColorCls}`} />
        {lock === "pro" && (
          <div className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-background border border-border rounded-[5px] flex items-center justify-center">
            <Lock className="h-2.5 w-2.5 text-muted-foreground" />
          </div>
        )}
        {lock === "core" && (
          <div className="absolute -top-1 -right-1 h-[18px] px-1 bg-violet-500 rounded-[5px] flex items-center justify-center">
            <Lock className="h-2.5 w-2.5 text-white" />
          </div>
        )}
        {lock === "soon" && (
          <div className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-background border border-border rounded-[5px] flex items-center justify-center">
            <Clock className="h-2.5 w-2.5 text-muted-foreground" />
          </div>
        )}
      </div>
      <span className={`text-[10.5px] font-semibold text-center leading-tight ${unavailable ? "text-muted-foreground/40" : "text-foreground/65 group-hover:text-foreground"} transition-colors`}>
        {item.name}
      </span>
    </button>
  );
}

// ─── 작업실 카테고리 그룹 ─────────────────────────────────────────────────────
const INLINE_LIMIT = 8; // 2행

function WsCatGroup({ cat, plan, onNavigate, featureConfigs, addonUnlocks }: { cat: WsDashCat; plan: string; onNavigate: WsNavFn; featureConfigs?: Record<string, string>; addonUnlocks?: string[]; }) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? cat.items : cat.items.slice(0, INLINE_LIMIT);
  const hiddenCount = cat.items.length - INLINE_LIMIT;

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-6 h-6 rounded-lg ${cat.bgCls} flex items-center justify-center`}>
          <cat.icon className={`h-3.5 w-3.5 ${cat.iconCls}`} />
        </div>
        <span className="text-sm font-semibold">{cat.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {visibleItems.map(item => (
          <WsToolItem
            key={item.id}
            item={item}
            cat={cat}
            lock={getFeatureLock(item.id, plan, featureConfigs, addonUnlocks)}
            onClick={(id) => onNavigate(id)}
          />
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 w-full text-center text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {expanded ? "접기 ↑" : `더보기 +${hiddenCount}개 ↓`}
        </button>
      )}
    </div>
  );
}

// ─── 회원 선택 공통 모달 ──────────────────────────────────────────────────────
function MemberPickModal({
  open, onClose, title, subtitle, icon: Icon, iconCls, allMembers, onPick,
}: {
  open: boolean; onClose: () => void; title: string; subtitle: string;
  icon: React.ElementType; iconCls: string;
  allMembers: { id: number; name: string; phone?: string | null }[] | undefined;
  onPick: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = (allMembers ?? []).filter(m =>
    !q.trim() || m.name.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <Dialog open={open} onOpenChange={(o) => { onClose(); if (!o) setQ(""); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${iconCls}`} />
            {title}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="회원 이름 검색..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-accent/30 focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto -mx-1 px-1">
          {!allMembers ? (
            <p className="text-sm text-muted-foreground text-center py-6">로딩 중...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">회원을 찾을 수 없습니다.</p>
          ) : filtered.map(m => (
            <button key={m.id} onClick={() => { onClose(); onPick(m.id); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/40 transition-colors text-left">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[m.id % AVATAR_GRADIENTS.length]} flex items-center justify-center shrink-0`}>
                <span className="text-sm font-semibold text-white">{m.name.charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm font-semibold">{m.name}</p>
                {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 빠른 질문 (내부 데이터 기반 규칙형 질의응답 — 외부 전송 없음) ─────────────
type QaMsg = { role: "user" | "bot"; text: string };

const QUICK_ASK_CHIPS = ["이번달 매출", "미수금", "만료임박", "6회이하 세션", "PAR-Q 미기록", "오늘 수업"];

function QuickAskCard({ trainerName }: { trainerName: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<QaMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const utils = trpc.useUtils();
  const todayStr = new Date().toISOString().split("T")[0];
  const yearMonth = todayStr.slice(0, 7);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setMessages(m => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const answer = await resolveAnswer(q);
      setMessages(m => [...m, { role: "bot", text: answer }]);
    } catch {
      setMessages(m => [...m, { role: "bot", text: "데이터를 불러오는 중 문제가 발생했어요. 잠시 후 다시 시도해주세요." }]);
    } finally {
      setBusy(false);
    }
  }

  // 서버에 저장된 데이터만 조회 — 외부로 전송되는 데이터 없음. 정해진 질문 패턴만 인식.
  async function resolveAnswer(q: string): Promise<string> {
    const has = (...kws: string[]) => kws.some(k => q.includes(k));

    if (has("매출")) {
      const monthly = has("오늘", "일일") ? null : await utils.trainers.getMonthlySettlement.fetch({ yearMonth });
      if (has("오늘", "일일")) {
        const daily = await utils.trainers.getMonthlySettlement.fetch({ yearMonth, dateFilter: todayStr });
        return `오늘 매출은 ${daily.revenue.toLocaleString()}원이에요 (수업 ${daily.sessionCount}회, 세후 정산액 ${daily.afterTax.toLocaleString()}원).`;
      }
      return `이번달(${yearMonth.replace("-", "년 ")}월) 총 매출은 ${monthly!.revenue.toLocaleString()}원, 세후 정산액은 ${monthly!.afterTax.toLocaleString()}원이에요. (수업 ${monthly!.sessionCount}회)`;
    }

    if (has("지출")) {
      const exp = await utils.expenses.list.fetch({ yearMonth });
      if (exp.count === 0) return "이번달 등록된 지출 내역이 없어요.";
      return `이번달 총 지출은 ${exp.total.toLocaleString()}원이에요 (${exp.count}건).`;
    }

    if (has("순수익", "정산")) {
      const [monthly, exp] = await Promise.all([
        utils.trainers.getMonthlySettlement.fetch({ yearMonth }),
        utils.expenses.list.fetch({ yearMonth }),
      ]);
      const net = monthly.afterTax - exp.total;
      return `이번달 순수익은 ${net.toLocaleString()}원이에요. (세후 정산액 ${monthly.afterTax.toLocaleString()}원 − 지출 ${exp.total.toLocaleString()}원)`;
    }

    if (has("미수금", "미납")) {
      const unpaid = await utils.members.getWithUnpaid.fetch();
      if (unpaid.length === 0) return "미수금이 있는 회원이 없어요. 깔끔합니다 👍";
      const total = unpaid.reduce((s, m) => s + (m.unpaidAmount ?? 0), 0);
      const names = unpaid.slice(0, 3).map(m => m.name).join(", ");
      return `미수금 회원은 ${unpaid.length}명, 총 ${total.toLocaleString()}원이에요. (${names}${unpaid.length > 3 ? ` 외 ${unpaid.length - 3}명` : ""})`;
    }

    if (has("만료", "만료임박")) {
      const expiring = await utils.members.getExpiring.fetch({ days: 7 });
      if (expiring.length === 0) return "7일 이내 만료 예정인 회원이 없어요.";
      const names = expiring.slice(0, 3).map(m => m.name).join(", ");
      return `7일 이내 만료 예정 회원은 ${expiring.length}명이에요. (${names}${expiring.length > 3 ? ` 외 ${expiring.length - 3}명` : ""})`;
    }

    if (has("6회", "재등록", "세션")) {
      const low = await utils.members.getLowSessions.fetch({ threshold: 6 });
      if (low.length === 0) return "잔여 세션이 적은(6회 이하) 회원이 없어요.";
      const names = low.slice(0, 3).map(m => m.name).join(", ");
      return `잔여 세션 6회 이하 회원은 ${low.length}명이에요. (${names}${low.length > 3 ? ` 외 ${low.length - 3}명` : ""}) 재등록 안내가 필요해 보여요.`;
    }

    if (has("PAR-Q", "PARQ", "파크", "건강검사")) {
      const missing = await utils.parQ.listMissing.fetch();
      if (missing.length === 0) return "모든 활성 회원이 PAR-Q를 작성했어요.";
      const names = missing.slice(0, 3).map(m => m.name).join(", ");
      return `PAR-Q 미기록 회원은 ${missing.length}명이에요. (${names}${missing.length > 3 ? ` 외 ${missing.length - 3}명` : ""})`;
    }

    if (has("오늘 수업", "오늘 출석", "오늘")) {
      const list = await utils.attendanceChecks.listByDate.fetch({ date: todayStr });
      const done = list.filter(m => m.check?.status === "attended").length;
      const total = list.filter(m => m.check).length;
      if (total === 0) return "오늘 기록된 수업이 아직 없어요.";
      return `오늘은 ${total}건 중 ${done}건 출석 처리됐어요.`;
    }

    if (has("이번달 수업", "이번 달 수업")) {
      const stats = await utils.pt.memberSessionStatsMonthly.fetch({ yearMonth });
      const total = stats.reduce((s, m) => s + Number(m.totalSessions), 0);
      return `이번달 총 수업 수는 ${total}회예요.`;
    }

    return "아직 이해하지 못한 질문이에요. 이렇게 물어봐 주세요 → " + QUICK_ASK_CHIPS.map(c => `"${c}"`).join(", ");
  }

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 p-4">
        <div className="w-6 h-6 rounded-lg bg-teal-500/10 flex items-center justify-center">
          <MessageCircle className="h-3.5 w-3.5 text-teal-500" />
        </div>
        <span className="text-sm font-semibold">빠른 질문</span>
        <span className="text-[10px] text-muted-foreground">내 데이터로 바로 확인</span>
        <ChevronRight className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ASK_CHIPS.map(c => (
              <button key={c} onClick={() => ask(c)} disabled={busy}
                className="text-[12px] font-semibold px-2.5 py-1.5 rounded-full bg-teal-500/8 text-teal-600 hover:bg-teal-500/15 transition-colors disabled:opacity-50">
                {c}
              </button>
            ))}
          </div>
          {messages.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto py-1">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                    m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-accent/50 text-foreground rounded-bl-sm"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="bg-accent/50 rounded-2xl rounded-bl-sm px-3.5 py-2 text-xs text-muted-foreground">확인 중...</div>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") ask(input); }}
              placeholder={`${trainerName}님, 궁금한 걸 물어보세요`}
              className="flex-1 min-w-0 px-3 py-2.5 text-sm rounded-xl border border-border bg-accent/30 focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
            />
            <button onClick={() => ask(input)} disabled={busy || !input.trim()}
              className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-teal-600 transition-colors">
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">정해진 질문 패턴에만 답해요. 회원 정보는 이 기기와 서버 사이에서만 계산돼요.</p>
        </div>
      )}
    </div>
  );
}

// ─── 운영자(Admin) SaaS 대시보드 ──────────────────────────────────────────────
function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: stats } = trpc.admin.getSaasStats.useQuery();
  const { data: trainerList } = trpc.admin.listTrainers.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">FIT STEP 운영 현황</h1>
        <p className="text-sm text-muted-foreground mt-0.5">서비스 전체 통계</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "가입 STEPER", value: `${stats?.totalTrainers ?? 0}명`, icon: ShieldCheck, color: "text-blue-400" },
          { label: "누적 회원", value: `${stats?.totalMembers ?? 0}명`, icon: Users, color: "text-green-400" },
          { label: "누적 수업", value: `${stats?.totalSessions ?? 0}회`, icon: Dumbbell, color: "text-purple-400" },
        ].map((card) => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <p className="text-xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />가입 STEPER
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!trainerList || trainerList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">가입된 STEPER가 없습니다.</p>
          ) : (
            trainerList.map((t) => (
              <button key={t.id} onClick={() => setLocation(`/admin/trainers/${t.id}`)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent/20 border border-border hover:border-primary/30 hover:bg-accent/40 transition-colors text-left">
                <div>
                  <p className="text-sm font-medium">{t.trainerName}</p>
                  <p className="text-xs text-muted-foreground">
                    @{t.username} · 가입 {t.createdAt?.slice(0, 10) ?? "-"}
                    {t.phone && <span className="ml-1">· {t.phone}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-blue-400">{t.memberCount}명</p>
                    <p className="text-xs text-muted-foreground">{t.sessionCount}세션</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 배너 & 공지 ──────────────────────────────────────────────────────────────
function BannerAndNotices() {
  const { data: notices } = trpc.notices.list.useQuery();
  const [selectedNotice, setSelectedNotice] = useState<{ id: number; title: string; content: string; createdAt: string } | null>(null);

  const hasContent = notices && notices.length > 0;
  if (!hasContent) return null;

  if (selectedNotice) {
    return (
      <div className="space-y-3">
        <button onClick={() => setSelectedNotice(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← 이벤트 목록
        </button>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <span className="inline-block text-[10px] font-semibold bg-primary/20 text-primary px-2 py-0.5 rounded-full">공지</span>
          <h2 className="text-base font-bold leading-snug">{selectedNotice.title}</h2>
          <p className="text-xs text-muted-foreground">{selectedNotice.createdAt.slice(0, 10)}</p>
          <div className="rounded-xl bg-accent/20 border border-border px-4 py-3">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedNotice.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notices && notices.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">이벤트 &amp; 공지</p>
            {notices.length > 3 && <button className="text-xs text-primary">전체보기 →</button>}
          </div>
          <div className="space-y-2">
            {notices.slice(0, 3).map(n => (
              <button key={n.id} onClick={() => setSelectedNotice(n)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-accent/20 border border-border hover:bg-accent/40 transition-colors text-left">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-lg">📢</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.isPinned && <span className="text-primary mr-1">[필독]</span>}{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.createdAt.slice(0, 10)}</p>
                </div>
                <span className="text-muted-foreground text-xs shrink-0">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── 트레이너 대시보드 ────────────────────────────────────────────────────────
function TrainerDashboard() {
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: stats, isLoading } = trpc.dashboard.getStats.useQuery();
  const { data: allMembers } = trpc.members.list.useQuery();
  const { data: wsStatus } = trpc.workshop.getStatus.useQuery();
  const { data: expiring } = trpc.members.getExpiring.useQuery({ days: 7 });
  const { data: unpaid } = trpc.members.getWithUnpaid.useQuery();
  const { data: lowSessions } = trpc.members.getLowSessions.useQuery({ threshold: 5 });
  const { data: lowSessions6 } = trpc.members.getLowSessions.useQuery({ threshold: 6 });

  const [todayModalOpen, setTodayModalOpen] = useState(false);
  const [ptStatsModalOpen, setPtStatsModalOpen] = useState(false);
  const [editorModalId, setEditorModalId] = useState<string | null>(null);
  const [infoFeatureId, setInfoFeatureId] = useState<string | null>(null);
  const [expiringModalOpen, setExpiringModalOpen] = useState(false);
  const [unpaidModalOpen, setUnpaidModalOpen] = useState(false);
  const [lowSessionsModalOpen, setLowSessionsModalOpen] = useState(false);
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [renewalSelected, setRenewalSelected] = useState<Set<number>>(new Set());
  const sendRenewalPushMutation = trpc.fitStepPlus.trainer_sendRenewalPush.useMutation({
    onSuccess: (res) => {
      if (res.sent === 0) toast.error("발송된 알림이 없어요. 회원이 FIT STEP+ 앱에서 알림을 켜야 받을 수 있어요.");
      else toast.success(`${res.total}명 중 ${res.sent}명에게 재등록 안내를 보냈어요.`);
      setRenewalModalOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const [registerTypeOpen, setRegisterTypeOpen] = useState(false);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);

  // 회원 선택 모달에서 상세 페이지로 이동했다가 뒤로가기로 돌아오면
  // 원래 열려있던 선택 모달을 다시 열어준다.
  useEffect(() => {
    const reopen = sessionStorage.getItem("dash_reopen_modal");
    if (!reopen) return;
    sessionStorage.removeItem("dash_reopen_modal");
    if (reopen === "journal") setJournalOpen(true);
    else if (reopen === "info_edit") setMemberSearchOpen(true);
  }, []);
  const [parqModalOpen, setParqModalOpen] = useState(false);
  const { data: parqMissing } = trpc.parQ.listMissing.useQuery();
  const todayStr = new Date().toISOString().split("T")[0];
  const currentYearMonth = todayStr.slice(0, 7);
  const { data: todayAttendanceList } = trpc.attendanceChecks.listByDate.useQuery(
    { date: todayStr }, { enabled: todayModalOpen }
  );
  const { data: memberSessionStats } = trpc.pt.memberSessionStatsMonthly.useQuery(
    { yearMonth: currentYearMonth }, { enabled: ptStatsModalOpen }
  );

  if (isLoading) return <LoadingSkeleton />;

  const userPlan = (user as any)?.plan ?? "free";
  // 작업실(/workshop)을 거치지 않고 대시보드에서 바로 여는 기능 — 모달/전용페이지/정보 안내로 분기
  const PAGE_FEATURE_ROUTES: Record<string, string> = {
    brand_page: "/brand-page",
    booking: "/booking",
    fitstep_plus: "/fitstep-plus-manage",
    monthly_pnl: "/settlement?tab=analysis",
    sales_analysis: "/settlement?tab=analysis",
  };
  const isProPlan = userPlan === "pro" || userPlan === "elite";
  const openFeature: WsNavFn = (featureId?: string) => {
    if (!featureId) return;
    // PRO 전용 기능은 모달/전용페이지를 열기 전에 먼저 플랜을 확인 — 잠금 배지만 보이고
    // 실제로는 열려버리는 일이 없도록 여기서 막는다 (전용페이지는 자체적으로도 한 번 더 확인함)
    if (PRO_IDS.has(featureId) && !isProPlan) {
      toast.error("PRO 플랜에서 이용할 수 있는 기능입니다.");
      setLocation("/profile");
      return;
    }
    if (MODAL_FEATURE_IDS.has(featureId)) { setEditorModalId(featureId); return; }
    if (PAGE_FEATURE_ROUTES[featureId]) { setLocation(PAGE_FEATURE_ROUTES[featureId]); return; }
    setInfoFeatureId(featureId);
  };
  const trainerName = (user as any)?.trainerName ?? (user as any)?.username ?? "스테퍼";
  const recentMembers = allMembers?.slice(0, 5) ?? [];

  return (
    <div className="space-y-5">
      <TabBanner tabKey="dashboard" />
      <BannerAndNotices />

      {/* 인사말 */}
      <div className="pt-1">
        <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">안녕하세요</p>
        <h1 className="text-[22px] font-bold tracking-tight mt-0.5 leading-snug">
          {trainerName} 스테퍼님,<br />
          오늘 <span className="text-primary">무엇을 시작</span>할까요?
        </h1>
      </div>

      {/* 주요 액션 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setRegisterTypeOpen(true)}
          className="relative overflow-hidden rounded-3xl p-5 text-left flex flex-col justify-between min-h-[140px] active:scale-95 transition-transform"
          style={{ background: "linear-gradient(145deg, #4F46E5 0%, #7C3AED 100%)", boxShadow: "0 8px 24px rgba(79,70,229,.25)" }}>
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-white" />
          </div>
          <div className="pr-8">
            <p className="text-[16px] font-semibold text-white">회원 등록</p>
            <p className="text-[12px] text-white/65 mt-0.5">새 회원을 빠르게 등록</p>
          </div>
          <div className="absolute bottom-4 right-4 w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
            <ArrowRight className="h-3.5 w-3.5 text-white" />
          </div>
        </button>

        <button onClick={() => setLocation("/attendance")}
          className="relative overflow-hidden rounded-3xl p-5 text-left flex flex-col justify-between min-h-[140px] active:scale-95 transition-transform"
          style={{ background: "linear-gradient(145deg, #0EA5E9 0%, #10B981 100%)", boxShadow: "0 8px 24px rgba(14,165,233,.2)" }}>
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-white" />
          </div>
          <div className="pr-8">
            <p className="text-[16px] font-semibold text-white">수업 시작</p>
            <p className="text-[12px] text-white/65 mt-0.5">오늘 PT 바로 기록</p>
          </div>
          <div className="absolute bottom-4 right-4 w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
            <ArrowRight className="h-3.5 w-3.5 text-white" />
          </div>
        </button>
      </div>

      <QuickAskCard trainerName={trainerName} />

      {/* 최근 회원 */}
      {recentMembers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">최근 회원</p>
            <button onClick={() => setLocation("/members")} className="text-xs font-semibold text-primary">전체보기</button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
            {recentMembers.map((m) => (
              <button key={m.id} onClick={() => setLocation(`/members/${m.id}`)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-90 transition-transform">
                <div className={`w-14 h-14 rounded-[18px] bg-gradient-to-br ${AVATAR_GRADIENTS[m.id % AVATAR_GRADIENTS.length]} flex items-center justify-center`}
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,.1)" }}>
                  <span className="text-lg font-bold text-white">{m.name.charAt(0)}</span>
                </div>
                <span className="text-[10.5px] font-semibold text-foreground/65 text-center w-14 truncate">{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 운영 툴 그룹 ─── */}

      {/* 회원 관리 */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Users className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <span className="text-sm font-semibold">회원 관리</span>
        </div>
        <ToolGrid items={[
          { label: "회원 목록", icon: Users, colorCls: "text-indigo-500", bgCls: "bg-indigo-500/10", borderCls: "border-indigo-500/20", onClick: () => setLocation("/members") },
          { label: "정보 수정", icon: Pencil, colorCls: "text-indigo-500", bgCls: "bg-indigo-500/10", borderCls: "border-indigo-500/20", onClick: () => setMemberSearchOpen(true) },
          { label: "만료 임박", icon: Clock, colorCls: "text-indigo-500", bgCls: "bg-indigo-500/10", borderCls: "border-indigo-500/20", onClick: () => setExpiringModalOpen(true), badge: expiring?.length ?? null },
          { label: "미수금", icon: AlertTriangle, colorCls: "text-indigo-500", bgCls: "bg-indigo-500/10", borderCls: "border-indigo-500/20", onClick: () => setUnpaidModalOpen(true), badge: unpaid?.length ?? null },
          { label: "6회 이하 세션", icon: RefreshCw, colorCls: "text-indigo-500", bgCls: "bg-indigo-500/10", borderCls: "border-indigo-500/20", onClick: () => setLowSessionsModalOpen(true), badge: lowSessions6?.length ?? null },
          { label: "재등록 안내", icon: RefreshCw, colorCls: "text-indigo-500", bgCls: "bg-indigo-500/10", borderCls: "border-indigo-500/20", onClick: () => { setRenewalSelected(new Set((lowSessions ?? []).map(m => m.id))); setRenewalModalOpen(true); }, badge: lowSessions?.length ?? null },
          { label: "회원 운영 현황", icon: Users, colorCls: "text-indigo-500", bgCls: "bg-indigo-500/10", borderCls: "border-indigo-500/20", onClick: () => openFeature("member_overview"), comingSoon: true },
        ]} />
      </div>

      {/* 수업·운동 */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-teal-500/10 flex items-center justify-center">
            <Dumbbell className="h-3.5 w-3.5 text-teal-500" />
          </div>
          <span className="text-sm font-semibold">수업·운동</span>
        </div>
        <ToolGrid items={[
          { label: "오늘 수업 수", icon: CalendarCheck, colorCls: "text-teal-500", bgCls: "bg-teal-500/10", borderCls: "border-teal-500/20", onClick: () => setTodayModalOpen(true), badge: stats?.todayAttendances ?? null },
          { label: "이번달 수업", icon: BarChart3, colorCls: "text-teal-500", bgCls: "bg-teal-500/10", borderCls: "border-teal-500/20", onClick: () => setPtStatsModalOpen(true) },
          { label: "수업 일지", icon: BookOpen, colorCls: "text-teal-500", bgCls: "bg-teal-500/10", borderCls: "border-teal-500/20", onClick: () => setJournalOpen(true) },
          { label: "PAR-Q 미기록", icon: ShieldCheck, colorCls: "text-teal-500", bgCls: "bg-teal-500/10", borderCls: "border-teal-500/20", onClick: () => setParqModalOpen(true), badge: parqMissing?.length ?? null },
          { label: "운동 템플릿", icon: Dumbbell, colorCls: "text-teal-500", bgCls: "bg-teal-500/10", borderCls: "border-teal-500/20", onClick: () => openFeature("templates") },
          { label: "운동 영상 200", icon: PlaySquare, colorCls: "text-teal-500", bgCls: "bg-teal-500/10", borderCls: "border-teal-500/20", onClick: () => openFeature("fitstep_videos"), locked: !isProPlan },
          { label: "식단 관리", icon: Utensils, colorCls: "text-teal-500", bgCls: "bg-teal-500/10", borderCls: "border-teal-500/20", onClick: () => openFeature("fitstep_diet"), locked: !isProPlan },
          { label: "운동 기록", icon: Activity, colorCls: "text-teal-500", bgCls: "bg-teal-500/10", borderCls: "border-teal-500/20", onClick: () => openFeature("fitstep_personal"), locked: !isProPlan },
          { label: "일지+영상", icon: Video, colorCls: "text-teal-500", bgCls: "bg-teal-500/10", borderCls: "border-teal-500/20", onClick: () => openFeature("training_video"), comingSoon: true },
        ]} />
      </div>

      {/* 매출·분석 */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <span className="text-sm font-semibold">매출·분석</span>
          </div>
          <button onClick={() => setLocation("/settlement")}
            className="text-[12px] font-semibold text-muted-foreground hover:text-primary transition-colors">
            전체보기 →
          </button>
        </div>
        <ToolGrid items={[
          { label: "일일 매출", icon: TrendingUp, colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10", borderCls: "border-emerald-500/20", onClick: () => setLocation("/settlement?tab=revenue&view=daily") },
          { label: "월 매출", icon: BarChart3, colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10", borderCls: "border-emerald-500/20", onClick: () => setLocation("/settlement?tab=revenue&view=monthly") },
          { label: "월 지출", icon: Wallet, colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10", borderCls: "border-emerald-500/20", onClick: () => setLocation("/settlement?tab=expense") },
          { label: "정산 요약", icon: FileText, colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10", borderCls: "border-emerald-500/20", onClick: () => setLocation("/settlement?tab=revenue") },
          { label: "월간 손익", icon: PieChart, colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10", borderCls: "border-emerald-500/20", onClick: () => setLocation("/settlement?tab=analysis") },
          { label: "재등록 분석", icon: TrendingUp, colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10", borderCls: "border-emerald-500/20", onClick: () => openFeature("renewal_analysis"), comingSoon: true },
          { label: "상담 전환율", icon: ArrowUpRight, colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10", borderCls: "border-emerald-500/20", onClick: () => openFeature("consult_conversion"), comingSoon: true },
        ]} />
      </div>

      {/* AI·운영 리포트 */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Cpu className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <span className="text-sm font-semibold">AI·운영 리포트</span>
        </div>
        <ToolGrid items={[
          { label: "체형 분석", icon: ScanLine, colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20", onClick: () => window.open("https://noble-unity-production-8100.up.railway.app/posture", "_blank") },
          { label: "맞춤 식단", icon: UtensilsCrossed, colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20", onClick: () => window.open("https://noble-unity-production-8100.up.railway.app/?ref=fitstep", "_blank") },
          { label: "AI 리포트", icon: Brain, colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20", onClick: () => openFeature("ai_insights"), locked: userPlan === "free" },
          { label: "활동 통계", icon: Activity, colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20", onClick: () => openFeature("activity_stats"), comingSoon: true },
          { label: "KPI 리포트", icon: Target, colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20", onClick: () => openFeature("kpi_report"), comingSoon: true },
          { label: "채널 분석", icon: Share2, colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20", onClick: () => openFeature("channel_analysis"), comingSoon: true },
          { label: "마케팅 분석", icon: Zap, colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20", onClick: () => openFeature("marketing_analysis"), comingSoon: true },
          { label: "데이터 이전", icon: Database, colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20", onClick: () => openFeature("data_migration"), comingSoon: true },
        ]} />
      </div>

      {WS_DASH.map(cat => (
        <WsCatGroup key={cat.key} cat={cat} plan={userPlan} onNavigate={openFeature} featureConfigs={wsStatus?.featureConfigs} addonUnlocks={wsStatus?.addonUnlocks} />
      ))}

      {/* 오늘 출석 모달 */}
      <Dialog open={todayModalOpen} onOpenChange={setTodayModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-600" />
              오늘 출석 현황
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {todayStr.replace(/-/g, ".")} · 출석 {todayAttendanceList?.filter(m => m.check?.status === "attended").length ?? 0}명
            </p>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {!todayAttendanceList ? (
              <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>
            ) : todayAttendanceList.filter(m => m.check).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">오늘 출석 기록이 없습니다.</p>
            ) : (
              todayAttendanceList.filter(m => m.check).map(m => {
                const statusColor = m.check?.status === "attended" ? "text-green-400" : m.check?.status === "noshow" ? "text-red-400" : "text-amber-600";
                const statusLabel = m.check?.status === "attended" ? "출석" : m.check?.status === "noshow" ? "노쇼" : "캔슬";
                return (
                  <button key={m.id} onClick={() => { setTodayModalOpen(false); setLocation(`/members/${m.id}`); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/40 transition-colors">
                    <span className="text-sm font-medium">{m.name}</span>
                    <div className="flex items-center gap-2">
                      {m.check?.checkTime && <span className="text-xs text-muted-foreground">{m.check.checkTime}</span>}
                      <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 이번달 수업 모달 */}
      <Dialog open={ptStatsModalOpen} onOpenChange={setPtStatsModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-purple-400" />
              회원별 수업 현황
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {currentYearMonth.replace("-", "년 ")}월 · 이번달 총{" "}
              <span className="font-semibold text-purple-400">
                {(memberSessionStats ?? []).reduce((s, m) => s + Number(m.totalSessions), 0)}회
              </span>
            </p>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {!memberSessionStats ? (
              <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>
            ) : memberSessionStats.filter(m => Number(m.totalSessions) > 0).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">세션 기록이 없습니다.</p>
            ) : (
              memberSessionStats.filter(m => Number(m.totalSessions) > 0).map((m, idx) => (
                <button key={m.memberId} onClick={() => { setPtStatsModalOpen(false); setLocation(`/members/${m.memberId}`); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 text-right">{idx + 1}</span>
                    <span className="text-sm font-medium">{m.memberName}</span>
                  </div>
                  <span className="text-sm font-semibold text-purple-400">{Number(m.totalSessions)}회</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 정보 수정 모달 */}
      <MemberPickModal open={memberSearchOpen} onClose={() => setMemberSearchOpen(false)}
        title="회원 정보 수정" subtitle="이름으로 검색해 회원을 선택하세요"
        icon={Pencil} iconCls="text-indigo-500" allMembers={allMembers}
        onPick={(id) => { sessionStorage.setItem("dash_reopen_modal", "info_edit"); setLocation(`/members/${id}`); }} />

      {/* 수업 일지 모달 */}
      <MemberPickModal open={journalOpen} onClose={() => setJournalOpen(false)}
        title="수업 일지" subtitle="일지를 확인할 회원을 선택하세요"
        icon={BookOpen} iconCls="text-blue-500" allMembers={allMembers}
        onPick={(id) => { sessionStorage.setItem("dash_reopen_modal", "journal"); setLocation(`/members/${id}?tab=training`); }} />

      {/* 만료 임박 모달 */}
      <Dialog open={expiringModalOpen} onOpenChange={setExpiringModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              만료 임박 회원
            </DialogTitle>
            <p className="text-xs text-muted-foreground">7일 이내 만료 예정</p>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {!expiring || expiring.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">만료 임박 회원이 없습니다.</p>
            ) : (
              expiring.map(m => {
                const days = Math.ceil((new Date(m.membershipEnd!).getTime() - Date.now()) / 86400000);
                return (
                  <button key={m.id} onClick={() => { setExpiringModalOpen(false); setLocation(`/members/${m.id}`); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-accent/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[m.id % AVATAR_GRADIENTS.length]} flex items-center justify-center shrink-0`}>
                        <span className="text-sm font-semibold text-white">{m.name.charAt(0)}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.membershipEnd?.slice(0, 10)}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${days <= 0 ? "bg-red-500/15 text-red-500" : days <= 3 ? "bg-orange-500/15 text-orange-500" : "bg-amber-500/15 text-amber-600"}`}>
                      {days <= 0 ? "오늘 만료" : `D-${days}`}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 미수금 모달 */}
      <Dialog open={unpaidModalOpen} onOpenChange={setUnpaidModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              미수금 회원
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              총 {unpaid?.length ?? 0}명 · {(unpaid ?? []).reduce((s, m) => s + (m.unpaidAmount ?? 0), 0).toLocaleString()}원
            </p>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {!unpaid || unpaid.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">미수금 회원이 없습니다.</p>
            ) : (
              unpaid.map(m => (
                <button key={m.id} onClick={() => { setUnpaidModalOpen(false); setLocation(`/members/${m.id}`); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[m.id % AVATAR_GRADIENTS.length]} flex items-center justify-center shrink-0`}>
                      <span className="text-sm font-semibold text-white">{m.name.charAt(0)}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">{m.name}</p>
                      {m.packageName && <p className="text-xs text-muted-foreground">{m.packageName}</p>}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-orange-500">{(m.unpaidAmount ?? 0).toLocaleString()}원</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 6회 이하 세션 모달 */}
      <Dialog open={lowSessionsModalOpen} onOpenChange={setLowSessionsModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-cyan-500" />
              6회 이하 세션 회원
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              잔여 세션 6회 이하 · 총 {lowSessions6?.length ?? 0}명 · 재등록 안내가 필요해요
            </p>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {!lowSessions6 || lowSessions6.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">잔여 세션이 적은 회원이 없습니다.</p>
            ) : (
              lowSessions6.map(m => {
                const remaining = m.totalSessions - m.usedSessions;
                return (
                  <button key={m.id} onClick={() => { setLowSessionsModalOpen(false); setLocation(`/members/${m.id}`); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-accent/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[m.id % AVATAR_GRADIENTS.length]} flex items-center justify-center shrink-0`}>
                        <span className="text-sm font-semibold text-white">{m.name.charAt(0)}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold">{m.name}</p>
                        {m.packageName && <p className="text-xs text-muted-foreground">{m.packageName}</p>}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${remaining <= 0 ? "bg-red-500/15 text-red-500" : remaining <= 2 ? "bg-orange-500/15 text-orange-500" : "bg-cyan-500/15 text-cyan-600"}`}>
                      {remaining <= 0 ? "소진" : `${remaining}회 남음`}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 재등록 안내 푸시 모달 */}
      <Dialog open={renewalModalOpen} onOpenChange={setRenewalModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-cyan-500" />
              재등록 안내 보내기
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              선택한 회원의 FIT STEP+ 앱으로 재등록 안내 푸시 알림을 보내요. 앱에서 알림을 켠 회원만 받을 수 있어요.
            </p>
          </DialogHeader>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {!lowSessions || lowSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">재등록 안내가 필요한 회원이 없습니다.</p>
            ) : (
              lowSessions.map(m => {
                const remaining = m.totalSessions - m.usedSessions;
                const checked = renewalSelected.has(m.id);
                return (
                  <label key={m.id} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/40 transition-colors cursor-pointer">
                    <input type="checkbox" className="accent-primary" checked={checked}
                      onChange={() => setRenewalSelected(prev => {
                        const next = new Set(prev);
                        checked ? next.delete(m.id) : next.add(m.id);
                        return next;
                      })} />
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[m.id % AVATAR_GRADIENTS.length]} flex items-center justify-center shrink-0`}>
                      <span className="text-sm font-semibold text-white">{m.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold truncate">{m.name}</p>
                      {m.packageName && <p className="text-xs text-muted-foreground truncate">{m.packageName}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${remaining <= 0 ? "bg-red-500/15 text-red-500" : "bg-cyan-500/15 text-cyan-600"}`}>
                      {remaining <= 0 ? "소진" : `${remaining}회 남음`}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {lowSessions && lowSessions.length > 0 && (
            <Button className="w-full" disabled={renewalSelected.size === 0 || sendRenewalPushMutation.isPending}
              onClick={() => sendRenewalPushMutation.mutate({ memberIds: Array.from(renewalSelected) })}>
              {sendRenewalPushMutation.isPending ? "발송 중..." : `선택한 ${renewalSelected.size}명에게 알림 보내기`}
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* PAR-Q 미기록 회원 모달 */}
      <Dialog open={parqModalOpen} onOpenChange={setParqModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-rose-500" />
              PAR-Q 미기록 회원
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              사전건강검사를 아직 작성하지 않은 활성 회원 · 총 {parqMissing?.length ?? 0}명
            </p>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {!parqMissing || parqMissing.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">모든 회원이 PAR-Q를 작성했습니다.</p>
            ) : (
              parqMissing.map(m => (
                <button key={m.id} onClick={() => { setParqModalOpen(false); setLocation(`/members/${m.id}/parq`); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[m.id % AVATAR_GRADIENTS.length]} flex items-center justify-center shrink-0`}>
                      <span className="text-sm font-semibold text-white">{m.name.charAt(0)}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">{m.name}</p>
                      {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-500">미기록</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 회원 등록 유형 선택 모달 */}
      <Dialog open={registerTypeOpen} onOpenChange={setRegisterTypeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-indigo-500" />
              회원 등록
            </DialogTitle>
            <p className="text-xs text-muted-foreground">등록 유형을 선택해주세요</p>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={() => { setRegisterTypeOpen(false); setLocation("/pt?register=1"); }}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 active:scale-95 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 flex items-center justify-center">
                <UserPlus className="h-6 w-6 text-indigo-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-indigo-600">신규 등록</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">새 회원 추가</p>
              </div>
            </button>
            <button onClick={() => { setRegisterTypeOpen(false); setLocation("/members"); }}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                <RefreshCw className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-emerald-600">재등록</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">기존 회원 연장</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 기능 편집 모달 (작업실 경유 없이 대시보드에서 바로) */}
      <Dialog open={!!editorModalId} onOpenChange={(o) => { if (!o) setEditorModalId(null); }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editorModalId ? MODAL_FEATURE_META[editorModalId]?.title : ""}</DialogTitle>
          </DialogHeader>
          {editorModalId && (() => {
            const Editor = MODAL_FEATURE_META[editorModalId].Component;
            return <Editor />;
          })()}
        </DialogContent>
      </Dialog>

      {/* 준비 중/안내성 기능 정보 모달 (작업실 경유 없이) */}
      <Dialog open={!!infoFeatureId} onOpenChange={(o) => { if (!o) setInfoFeatureId(null); }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          {infoFeatureId && (() => {
            const item = WS_CATALOG.flatMap(c => c.items).find(i => i.id === infoFeatureId);
            if (!item) return null;
            return (
              <div className="space-y-3">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {item.name}
                    {item.status === "coming_soon" && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">준비 중</span>
                    )}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map(tag => (
                    <span key={tag} className="text-[12px] px-2 py-1 rounded-full bg-accent/50 text-foreground/70">{tag}</span>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">활용 예시</p>
                  {item.useCases.map(uc => (
                    <p key={uc} className="text-xs text-muted-foreground">· {uc}</p>
                  ))}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 로딩 스켈레톤 ────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="h-3 w-16 bg-card rounded animate-pulse" />
        <div className="h-7 w-48 bg-card rounded animate-pulse" />
        <div className="h-7 w-36 bg-card rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-36 rounded-3xl bg-card border border-border animate-pulse" />
        <div className="h-36 rounded-3xl bg-card border border-border animate-pulse" />
      </div>
      <div className="h-20 rounded-2xl bg-card border border-border animate-pulse" />
      {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl bg-card border border-border animate-pulse" />)}
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: user } = trpc.auth.me.useQuery();
  if (user?.role === "admin") return <AdminDashboard />;
  return <TrainerDashboard />;
}
