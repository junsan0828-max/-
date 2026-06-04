import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Database, TrendingUp, Users, Megaphone, Building2,
  ChevronLeft, ChevronRight, UserCheck, UserX, CalendarDays,
  Dumbbell, ClipboardList, Lock, Shirt, PhoneCall, Target,
  RefreshCw, Activity, BarChart3, CreditCard,
} from "lucide-react";

// ── 재무 탭 ──────────────────────────────────────────────────────────────────
function FinanceTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const [branchFilter, setBranchFilter] = useState<number | null>(null);

  const { data, isLoading } = trpc.gym.kpi.financialDetail.useQuery(
    { year, ...(branchFilter ? { branchId: branchFilter } : {}) }
  );

  function w(n: number) {
    if (!n) return "-";
    return `₩${n.toLocaleString()}`;
  }
  function pct(n: number) {
    if (!n && n !== 0) return "-";
    return `${n}%`;
  }

  const rows = data?.monthlyData ?? [];
  const tot = data?.total;

  const thStyle = "px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground whitespace-nowrap border-b border-border bg-muted/40";
  const tdStyle = "px-2 py-1.5 text-center text-[10px] text-foreground whitespace-nowrap border-b border-border/50";
  const tdRed = "px-2 py-1.5 text-center text-[10px] text-red-400 whitespace-nowrap border-b border-border/50";
  const tdGreen = "px-2 py-1.5 text-center text-[10px] text-emerald-400 whitespace-nowrap border-b border-border/50";
  const tdBlue = "px-2 py-1.5 text-center text-[10px] text-blue-400 whitespace-nowrap border-b border-border/50";
  const totStyle = "px-2 py-2 text-center text-[10px] font-bold text-foreground whitespace-nowrap bg-muted/30";

  return (
    <div className="space-y-6">
      {/* 연도 + 지점 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <button onClick={() => setYear(y => y - 1)} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold w-14 text-center">{year}년</span>
          <button onClick={() => setYear(y => y + 1)} className="text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {branchList && branchList.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setBranchFilter(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              전체
            </button>
            {branchList.map((b: any) => (
              <button
                key={b.id}
                onClick={() => setBranchFilter(b.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === b.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">로딩 중...</div>
      ) : (
        <div className="space-y-6">
          {/* 이번달 요약 카드 */}
          {(() => {
            const cur = rows[now.getMonth()];
            if (!cur || cur.gs === 0) return null;
            return (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                  {now.getMonth() + 1}월 재무 요약
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "매출(GS)", value: w(cur.gs), color: "text-foreground" },
                    { label: "매출(NS)", value: w(cur.ns), sub: `부가세 ${w(cur.vat)}`, color: "text-foreground" },
                    { label: "영업이익", value: w(cur.op), sub: `OPM ${pct(cur.opm)}`, color: cur.op >= 0 ? "text-emerald-400" : "text-red-400" },
                    { label: "순이익", value: w(cur.np), sub: `NPM ${pct(cur.npm)}`, color: cur.np >= 0 ? "text-emerald-400" : "text-red-400" },
                  ].map(c => (
                    <div key={c.label} className="bg-card border border-border rounded-xl p-3">
                      <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
                      <div className={`text-sm font-bold ${c.color}`}>{c.value}</div>
                      {c.sub && <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>}
                    </div>
                  ))}
                </div>
                {/* PT/헬스 상세 */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr>
                        <th className={thStyle}>구분</th>
                        <th className={thStyle}>PT 신규</th>
                        <th className={thStyle}>PT 재등록</th>
                        <th className={thStyle}>헬스 신규</th>
                        <th className={thStyle}>헬스 재등록</th>
                        <th className={thStyle}>기타</th>
                        <th className={thStyle}>PT 객단가</th>
                        <th className={thStyle}>헬스 객단가</th>
                        <th className={thStyle}>계약수</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={`${tdStyle} font-medium`}>{now.getMonth() + 1}월</td>
                        <td className={tdBlue}>{w(cur.ptNew)}</td>
                        <td className={tdBlue}>{w(cur.ptRenewal)}</td>
                        <td className={tdGreen}>{w(cur.hlNew)}</td>
                        <td className={tdGreen}>{w(cur.hlRenewal)}</td>
                        <td className={tdStyle}>{w(cur.other)}</td>
                        <td className={tdStyle}>{w(cur.ptUnit)}</td>
                        <td className={tdStyle}>{w(cur.hlUnit)}</td>
                        <td className={tdStyle}>{cur.totalCnt || "-"}건</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* 결제수단 / 비용 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">결제 수단</div>
                    {[["카드", cur.card], ["계좌이체", cur.transfer], ["현금", cur.cash], ["지역화폐", cur.local]].filter(([, v]) => (v as number) > 0).map(([l, v]) => (
                      <div key={l as string} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{l as string}</span>
                        <span className="text-foreground">{w(v as number)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">비용 구성</div>
                    {[["고정비(FC)", cur.fc], ["변동비(VC)", cur.vc], ["광고비(CAC)", cur.cac], ["환불", cur.refund]].map(([l, v]) => (
                      <div key={l as string} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{l as string}</span>
                        <span className={(v as number) > 0 ? "text-red-400" : "text-muted-foreground"}>{w(v as number)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 연간 월별 테이블 */}
          <div>
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 mb-3">{year}년 월별 재무 데이터</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr>
                    <th className={thStyle} rowSpan={2}>월</th>
                    <th className={`${thStyle} border-r border-border`} colSpan={5}>핵심 재무</th>
                    <th className={`${thStyle} border-r border-border`} colSpan={4}>매출 구성</th>
                    <th className={`${thStyle} border-r border-border`} colSpan={3}>비용</th>
                    <th className={`${thStyle} border-r border-border`} colSpan={2}>객단가</th>
                    <th className={thStyle}>계약</th>
                  </tr>
                  <tr>
                    <th className={thStyle}>매출(GS)</th>
                    <th className={thStyle}>매출(NS)</th>
                    <th className={thStyle}>영업이익</th>
                    <th className={thStyle}>OPM</th>
                    <th className={`${thStyle} border-r border-border`}>순이익</th>
                    <th className={thStyle}>PT신규</th>
                    <th className={thStyle}>PT재등록</th>
                    <th className={thStyle}>헬스신규</th>
                    <th className={`${thStyle} border-r border-border`}>헬스재등록</th>
                    <th className={thStyle}>고정비</th>
                    <th className={thStyle}>변동비</th>
                    <th className={`${thStyle} border-r border-border`}>환불</th>
                    <th className={thStyle}>PT</th>
                    <th className={`${thStyle} border-r border-border`}>헬스</th>
                    <th className={thStyle}>건수</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.month} className={r.gs === 0 ? "opacity-30" : "hover:bg-muted/10"}>
                      <td className={`${tdStyle} font-medium`}>{r.month}월</td>
                      <td className={tdStyle}>{w(r.gs)}</td>
                      <td className={tdStyle}>{w(r.ns)}</td>
                      <td className={r.op >= 0 ? tdGreen : tdRed}>{w(r.op)}</td>
                      <td className={r.op >= 0 ? tdGreen : tdRed}>{r.gs > 0 ? pct(r.opm) : "-"}</td>
                      <td className={`border-r border-border/30 ${r.np >= 0 ? tdGreen : tdRed}`}>{w(r.np)}</td>
                      <td className={tdBlue}>{w(r.ptNew)}</td>
                      <td className={tdBlue}>{w(r.ptRenewal)}</td>
                      <td className={tdGreen}>{w(r.hlNew)}</td>
                      <td className={`border-r border-border/30 ${tdGreen}`}>{w(r.hlRenewal)}</td>
                      <td className={tdRed}>{w(r.fc)}</td>
                      <td className={tdRed}>{w(r.vc)}</td>
                      <td className={`border-r border-border/30 ${tdRed}`}>{w(r.refund)}</td>
                      <td className={tdStyle}>{w(r.ptUnit)}</td>
                      <td className={`border-r border-border/30 ${tdStyle}`}>{w(r.hlUnit)}</td>
                      <td className={tdStyle}>{r.totalCnt || "-"}</td>
                    </tr>
                  ))}
                  {tot && (
                    <tr className="border-t-2 border-border">
                      <td className={totStyle}>합계</td>
                      <td className={totStyle}>{w(tot.gs)}</td>
                      <td className={totStyle}>{w(tot.ns)}</td>
                      <td className={`${totStyle} ${tot.op >= 0 ? "text-emerald-400" : "text-red-400"}`}>{w(tot.op)}</td>
                      <td className={`${totStyle} ${tot.op >= 0 ? "text-emerald-400" : "text-red-400"}`}>{tot.ns > 0 ? pct(Math.round(tot.op / tot.ns * 1000) / 10) : "-"}</td>
                      <td className={`border-r border-border/30 ${totStyle} ${tot.np >= 0 ? "text-emerald-400" : "text-red-400"}`}>{w(tot.np)}</td>
                      <td className={`${totStyle} text-blue-400`}>{w(tot.ptNew)}</td>
                      <td className={`${totStyle} text-blue-400`}>{w(tot.ptRenewal)}</td>
                      <td className={`${totStyle} text-emerald-400`}>{w(tot.hlNew)}</td>
                      <td className={`border-r border-border/30 ${totStyle} text-emerald-400`}>{w(tot.hlRenewal)}</td>
                      <td className={`${totStyle} text-red-400`}>{w(tot.fc)}</td>
                      <td className={`${totStyle} text-red-400`}>{w(tot.vc)}</td>
                      <td className={`border-r border-border/30 ${totStyle} text-red-400`}>{w(tot.refund)}</td>
                      <td className={totStyle}>{tot.ptCnt > 0 ? w(Math.round((tot.ptNew + tot.ptRenewal) / tot.ptCnt)) : "-"}</td>
                      <td className={`border-r border-border/30 ${totStyle}`}>{tot.hlCnt > 0 ? w(Math.round((tot.hlNew + tot.hlRenewal) / tot.hlCnt)) : "-"}</td>
                      <td className={totStyle}>{tot.totalCnt || "-"}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 결제수단 및 세금 연간 */}
          <div>
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 mb-3">결제 수단 및 세금</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr>
                    <th className={thStyle}>월</th>
                    <th className={thStyle}>카드</th>
                    <th className={thStyle}>계좌이체</th>
                    <th className={thStyle}>현금</th>
                    <th className={thStyle}>지역화폐</th>
                    <th className={thStyle}>부가세(추정)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter(r => r.gs > 0).map(r => (
                    <tr key={r.month} className="hover:bg-muted/10">
                      <td className={`${tdStyle} font-medium`}>{r.month}월</td>
                      <td className={tdStyle}>{w(r.card)}</td>
                      <td className={tdStyle}>{w(r.transfer)}</td>
                      <td className={tdStyle}>{w(r.cash)}</td>
                      <td className={tdStyle}>{w(r.local)}</td>
                      <td className={tdRed}>{w(r.vat)}</td>
                    </tr>
                  ))}
                  {tot && (
                    <tr className="border-t-2 border-border">
                      <td className={totStyle}>합계</td>
                      <td className={totStyle}>{w(tot.card)}</td>
                      <td className={totStyle}>{w(tot.transfer)}</td>
                      <td className={totStyle}>{w(tot.cash)}</td>
                      <td className={totStyle}>{w(tot.local)}</td>
                      <td className={`${totStyle} text-red-400`}>{w(tot.vat)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center pb-2">
            * 부가세는 매출(GS)의 10/110 추정값 · 영업이익 = NS - 고정비 - 변동비 · 순이익 = 영업이익 - 광고비
          </p>
        </div>
      )}
    </div>
  );
}

// ── 카테고리 아이템 카드 ───────────────────────────────────────────────────────
type Item = { icon: React.ElementType; label: string; desc: string };

function ItemGrid({ items, color }: { items: Item[]; color: string }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
            <Icon className={`h-4 w-4 shrink-0 ${color} opacity-70`} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 탭 정의 ──────────────────────────────────────────────────────────────────
const TABS = [
  {
    key: "finance",
    label: "재무",
    icon: TrendingUp,
    color: "text-emerald-400",
    activeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  {
    key: "customer",
    label: "고객",
    icon: Users,
    color: "text-blue-400",
    activeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  {
    key: "marketing",
    label: "마케팅",
    icon: Megaphone,
    color: "text-violet-400",
    activeClass: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  },
  {
    key: "operations",
    label: "센터 운영",
    icon: Building2,
    color: "text-amber-400",
    activeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
] as const;

type TabKey = typeof TABS[number]["key"];

const TAB_ITEMS: Record<Exclude<TabKey, "finance">, { items: Item[]; color: string }> = {
  customer: {
    color: "text-blue-400",
    items: [
      { icon: UserCheck, label: "전체 회원 목록", desc: "회원 기본 정보 및 등록 현황" },
      { icon: CalendarDays, label: "만료 회원", desc: "이용권 만료 예정 및 만료된 회원" },
      { icon: Dumbbell, label: "PT 패키지 현황", desc: "회원별 PT 잔여 횟수 및 만료일" },
      { icon: Activity, label: "출석 현황", desc: "회원 출석 이력 및 방문 패턴" },
    ],
  },
  marketing: {
    color: "text-violet-400",
    items: [
      { icon: PhoneCall, label: "상담 내역", desc: "전체 상담 기록 및 결과 이력" },
      { icon: Target, label: "전환율 분석", desc: "상담에서 등록까지 전환 통계" },
      { icon: BarChart3, label: "채널별 유입 통계", desc: "마케팅 채널별 신규 상담 현황" },
      { icon: UserCheck, label: "신규·재등록 통계", desc: "기간별 신규 및 재등록 현황" },
    ],
  },
  operations: {
    color: "text-amber-400",
    items: [
      { icon: ClipboardList, label: "업무 일지", desc: "트레이너·컨설턴트 업무 기록" },
      { icon: Lock, label: "락커 현황", desc: "락커 사용 및 배정 현황" },
      { icon: Shirt, label: "운동복 현황", desc: "운동복 대여 및 반납 이력" },
      { icon: Dumbbell, label: "트레이너 실적", desc: "트레이너별 PT 진행 및 실적 현황" },
    ],
  },
};

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function DataManagementPage() {
  const [tab, setTab] = useState<TabKey>("finance");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        데이터 관리
      </h1>

      {/* 상단 탭 */}
      <div className="grid grid-cols-4 gap-2">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium border transition-colors ${
                isActive
                  ? t.activeClass
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "" : "opacity-60"}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === "finance" && <FinanceTab />}
      {tab !== "finance" && (
        <ItemGrid
          items={TAB_ITEMS[tab].items}
          color={TAB_ITEMS[tab].color}
        />
      )}
    </div>
  );
}
