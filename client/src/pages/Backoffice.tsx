import { useState } from "react";
import { trpc } from "../lib/trpc";

type BottomTab = "home" | "locker" | "search" | "logs" | "stats";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${DAYS[d.getDay()]}) 기준`;
}

// ── 로고 — 바벨 + Z 구조 (|H-Z-H|) ────────────────────────────────────────
function ZiantLogo({ size = 28, color = "white" }: { size?: number; color?: string }) {
  const w = Math.round(size * 2.75);
  return (
    <svg width={w} height={size} viewBox="0 0 220 80" fill="none">
      <rect x="1" y="20" width="11" height="40" rx="3" fill={color}/>
      <rect x="18" y="10" width="14" height="60" rx="3" fill={color}/>
      <rect x="36" y="10" width="14" height="60" rx="3" fill={color}/>
      <rect x="18" y="33" width="32" height="14" fill={color}/>
      <polygon points="50,10 162,10 162,22 100,22 162,58 162,70 50,70 50,58 112,58 50,22" fill={color}/>
      <rect x="164" y="10" width="14" height="60" rx="3" fill={color}/>
      <rect x="182" y="10" width="14" height="60" rx="3" fill={color}/>
      <rect x="164" y="33" width="32" height="14" fill={color}/>
      <rect x="208" y="20" width="11" height="40" rx="3" fill={color}/>
    </svg>
  );
}

// ── 아이콘 ───────────────────────────────────────────────────────────────────
function Icon({ children, active }: { children: React.ReactNode; active: boolean }) {
  return <span style={{ color: active ? "white" : "#555" }}>{children}</span>;
}
const navItems: [BottomTab, string, React.ReactNode][] = [
  ["home", "홈", <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M1 10L11 2L21 10V20C21 20.55 20.55 21 20 21H14V15H8V21H2C1.45 21 1 20.55 1 20V10Z" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>],
  ["locker", "락커현황", <svg width="20" height="22" viewBox="0 0 20 22" fill="none"><rect x="1" y="6" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M6 6V4C6 2.34 7.34 1 9 1H11C12.66 1 14 2.34 14 4V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="13.5" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>],
  ["search", "회원검색", <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/><line x1="14" y1="14" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>],
  ["logs", "출입기록", <svg width="20" height="22" viewBox="0 0 20 22" fill="none"><rect x="1" y="1" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/><line x1="5" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="15" x2="10" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>],
  ["stats", "더보기", <svg width="22" height="6" viewBox="0 0 22 6" fill="none"><circle cx="3" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="11" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="19" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>],
];

// ── 공통 카드 ─────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #252525", borderRadius: 16, padding: "16px 20px", ...style }}>
      {children}
    </div>
  );
}

// ── 홈 탭 ────────────────────────────────────────────────────────────────────
function HomeTab({ setTab }: { setTab: (t: BottomTab) => void }) {
  const { data: stats } = trpc.access.todayStats.useQuery();
  const { data: lockers = [] } = trpc.backoffice.getLockers.useQuery();

  const total = (lockers as any[]).length;
  const used = (lockers as any[]).filter((l) => l.isOccupied).length;
  const free = total - used;
  const today = new Date().toISOString().slice(0, 10);
  const expiringSoon = (lockers as any[]).filter((l) => l.isOccupied && l.endDate && l.endDate >= today && daysLeft(l.endDate) <= 7).length;
  const expired = (lockers as any[]).filter((l) => l.isOccupied && l.endDate && l.endDate < today).length;

  const lockerPct = total > 0 ? Math.round((used / total) * 100) : 0;

  const shortcuts = [
    { label: "회원 검색", icon: "🔍", tab: "search" as BottomTab },
    { label: "락커 현황", icon: "🔒", tab: "locker" as BottomTab },
    { label: "만료 예정", icon: "📅", tab: "locker" as BottomTab },
    { label: "장기 미사용", icon: "👤", tab: "logs" as BottomTab },
    { label: "출입 기록", icon: "📋", tab: "logs" as BottomTab },
    { label: "락커 배정", icon: "🔑", tab: "locker" as BottomTab },
    { label: "통계", icon: "📊", tab: "stats" as BottomTab },
    { label: "설정", icon: "⚙️", tab: "stats" as BottomTab },
  ];

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "16px 16px 8px" }}>
      {/* 오늘의 현황 */}
      <Card style={{ marginBottom: 12 }}>
        <div className="flex justify-between items-center mb-4">
          <p style={{ fontSize: 15, fontWeight: 700, color: "white" }}>오늘의 현황</p>
          <p style={{ fontSize: 11, color: "#555" }}>{todayStr()}</p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "전체 회원", value: "-" },
            { label: "오늘 출석", value: stats?.total ?? 0 },
            { label: "출석률", value: "-" },
            { label: "락커사용률", value: `${lockerPct}%` },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p style={{ fontSize: 22, fontWeight: 700, color: "white" }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 락커 현황 */}
      <Card style={{ marginBottom: 12 }}>
        <div className="flex justify-between items-center mb-4">
          <p style={{ fontSize: 15, fontWeight: 700, color: "white" }}>락커 현황</p>
          <button onClick={() => setTab("locker")} style={{ fontSize: 12, color: "#555" }}>총 {total}개 &gt;</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "사용중", value: used, dot: "#4CAF50" },
            { label: "빈 락커", value: free, dot: "#555" },
            { label: "만료 임박", value: expiringSoon, sub: "(7일 이내)", dot: "#ff8800" },
            { label: "만료", value: expired, dot: "#cc4444" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="flex justify-center items-center gap-1 mb-1">
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }}/>
                <span style={{ fontSize: 10, color: "#666" }}>{s.label}</span>
              </div>
              <p style={{ fontSize: 24, fontWeight: 700, color: "white" }}>{s.value}</p>
              {s.sub && <p style={{ fontSize: 9, color: "#555" }}>{s.sub}</p>}
            </div>
          ))}
        </div>
      </Card>

      {/* 바로가기 */}
      <Card style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "white", marginBottom: 14 }}>바로가기</p>
        <div className="grid grid-cols-4 gap-3">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              onClick={() => setTab(s.tab)}
              className="flex flex-col items-center gap-2"
            >
              <div style={{ width: 48, height: 48, background: "#252525", borderRadius: 14, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {s.icon}
              </div>
              <span style={{ fontSize: 11, color: "#888" }}>{s.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* 최근 알림 */}
      <Card>
        <div className="flex justify-between items-center mb-3">
          <p style={{ fontSize: 15, fontWeight: 700, color: "white" }}>최근 알림</p>
          <button style={{ fontSize: 12, color: "#555" }}>전체보기 &gt;</button>
        </div>
        <div className="space-y-4">
          {expiringSoon > 0 && (
            <AlertRow icon="📅" title={`락커 만료 임박`} desc={`${expiringSoon}개 락커가 7일 이내 만료됩니다.`} time="방금" />
          )}
          {expired > 0 && (
            <AlertRow icon="⚠️" title={`만료된 락커`} desc={`${expired}개 락커가 이미 만료되었습니다.`} time="확인 필요" />
          )}
          {stats && stats.denied > 0 && (
            <AlertRow icon="🚫" title={`출입 거부`} desc={`오늘 ${stats.denied}건 출입이 거부되었습니다.`} time="오늘" />
          )}
          {!expiringSoon && !expired && (!stats || stats.denied === 0) && (
            <p style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "8px 0" }}>새로운 알림이 없습니다</p>
          )}
        </div>
      </Card>

      <div style={{ height: 16 }} />
    </div>
  );
}

function AlertRow({ icon, title, desc, time }: { icon: string; title: string; desc: string; time: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div style={{ width: 36, height: 36, background: "#252525", borderRadius: 10, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <p style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{title}</p>
          <span style={{ fontSize: 11, color: "#555", flexShrink: 0, marginLeft: 8 }}>{time}</span>
        </div>
        <p style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{desc}</p>
      </div>
    </div>
  );
}

function daysLeft(dateStr: string) {
  const end = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

// ── 락커 탭 ──────────────────────────────────────────────────────────────────
const DEFAULT_CATS = [
  { id: "male_a", label: "남자락커룸 A" },
  { id: "male_b", label: "남자락커룸 B" },
  { id: "female_a", label: "여자락커룸 A" },
];

function loadCats(): { id: string; label: string }[] {
  try {
    const s = localStorage.getItem("ziant_locker_cats");
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_CATS;
}
function saveCats(cats: { id: string; label: string }[]) {
  localStorage.setItem("ziant_locker_cats", JSON.stringify(cats));
}

function LockerTab() {
  const { data: lockers = [], refetch } = trpc.backoffice.getLockers.useQuery();
  const [cat, setCat] = useState("all");
  const [cats, setCatsState] = useState(loadCats);
  const [newNum, setNewNum] = useState("");
  const [newCatId, setNewCatId] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [editingCat, setEditingCat] = useState<{ id: string; label: string } | null>(null);
  const [newCatLabel, setNewCatLabel] = useState("");

  const createLocker = trpc.backoffice.createLocker.useMutation({ onSuccess: () => { refetch(); setNewNum(""); setNewCatId("all"); setShowAdd(false); } });
  const releaseLocker = trpc.backoffice.releaseLocker.useMutation({ onSuccess: refetch });
  const deleteLocker = trpc.backoffice.deleteLocker.useMutation({ onSuccess: refetch });

  const today = new Date().toISOString().slice(0, 10);
  const allLockers = lockers as any[];
  const allCats = [{ id: "all", label: "전체" }, ...cats];
  const filtered = cat === "all" ? allLockers : allLockers.filter((l) => l.lockerType === cat);

  function updateCats(next: { id: string; label: string }[]) {
    setCatsState(next);
    saveCats(next);
  }
  function addCat() {
    if (!newCatLabel.trim()) return;
    const id = "cat_" + Date.now();
    const next = [...cats, { id, label: newCatLabel.trim() }];
    updateCats(next);
    setNewCatLabel("");
  }
  function renameCat(id: string, label: string) {
    updateCats(cats.map((c) => (c.id === id ? { id, label } : c)));
    setEditingCat(null);
  }
  function removeCat(id: string) {
    if (!confirm("이 탭을 삭제하면 해당 탭의 락커는 '전체'에서만 보입니다.\n삭제하시겠습니까?")) return;
    if (cat === id) setCat("all");
    updateCats(cats.filter((c) => c.id !== id));
  }

  function statusOf(l: any) {
    if (!l.isOccupied) return "empty";
    if (l.endDate && l.endDate < today) return "expired";
    if (l.endDate && daysLeft(l.endDate) <= 7) return "expiring";
    return "used";
  }
  const statusStyle: Record<string, React.CSSProperties> = {
    empty: { background: "#1c1c1c", border: "1px solid #2a2a2a" },
    used: { background: "#1c2c1c", border: "1px solid #2a4a2a" },
    expiring: { background: "#2a2000", border: "1px solid #554400" },
    expired: { background: "#2a0000", border: "1px solid #550000" },
  };
  const statusLabel: Record<string, { text: string; color: string }> = {
    empty: { text: "비어있음", color: "#444" },
    used: { text: "사용중", color: "#4CAF50" },
    expiring: { text: "만료임박", color: "#ff8800" },
    expired: { text: "만료", color: "#cc4444" },
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 카테고리 탭 */}
      <div className="overflow-x-auto flex-shrink-0" style={{ borderBottom: "1px solid #222" }}>
        <div className="flex whitespace-nowrap items-end">
          {allCats.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setCat(id)}
              style={{
                padding: "10px 16px",
                fontSize: 13,
                color: cat === id ? "white" : "#555",
                borderBottom: cat === id ? "2px solid white" : "2px solid transparent",
                fontWeight: cat === id ? 600 : 400,
                background: "transparent",
                marginBottom: -1,
                flexShrink: 0,
              }}
            >{label}</button>
          ))}
          {/* 탭 설정 버튼 */}
          <button
            onClick={() => setShowCatMgr(true)}
            style={{ padding: "10px 14px", fontSize: 18, color: "#444", marginBottom: -1, flexShrink: 0 }}
            title="탭 설정"
          >⚙</button>
        </div>
      </div>

      {/* 필터 배지 */}
      <div className="flex gap-2 px-4 py-3 flex-shrink-0 overflow-x-auto">
        {[
          { label: `사용중 ${filtered.filter(l=>statusOf(l)==="used").length}`, color: "#4CAF50" },
          { label: `비어있음 ${filtered.filter(l=>statusOf(l)==="empty").length}`, color: "#555" },
          { label: `만료임박 ${filtered.filter(l=>statusOf(l)==="expiring").length}`, color: "#ff8800" },
          { label: `만료 ${filtered.filter(l=>statusOf(l)==="expired").length}`, color: "#cc4444" },
        ].map((b) => (
          <span key={b.label} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#1c1c1c", color: b.color, border: "1px solid #2a2a2a", flexShrink: 0 }}>{b.label}</span>
        ))}
        <button
          onClick={() => { setNewCatId(cat === "all" ? (cats[0]?.id ?? "all") : cat); setShowAdd(true); }}
          className="ml-auto"
          style={{ fontSize: 12, padding: "3px 12px", borderRadius: 20, background: "#252525", color: "white", border: "1px solid #333", flexShrink: 0 }}
        >+ 추가</button>
      </div>

      {/* 락커 그리드 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-4 gap-2">
          {filtered.map((l: any) => {
            const s = statusOf(l);
            return (
              <div
                key={l.id}
                className="rounded-xl p-2 relative group"
                style={{ ...statusStyle[s], minHeight: 72 }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 2 }}>{l.lockerNumber}</div>
                <div style={{ fontSize: 10, color: statusLabel[s].color, fontWeight: 600 }}>{statusLabel[s].text}</div>
                {l.isOccupied && (
                  <>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.memberName}</div>
                    {l.endDate && <div style={{ fontSize: 9, color: "#555" }}>{l.endDate.slice(5)}</div>}
                    <button
                      onClick={() => confirm(`${l.lockerNumber}번 반납?`) && releaseLocker.mutate({ lockerId: l.id })}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ fontSize: 9, padding: "2px 6px", background: "#333", color: "#aaa", borderRadius: 4 }}
                    >반납</button>
                  </>
                )}
                {!l.isOccupied && (
                  <button
                    onClick={() => confirm(`${l.lockerNumber}번 삭제?`) && deleteLocker.mutate({ lockerId: l.id })}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ fontSize: 9, padding: "2px 6px", background: "#2a1a1a", color: "#884444", borderRadius: 4 }}
                  >삭제</button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-4 text-center py-16" style={{ color: "#444", fontSize: 14 }}>
              락커가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex justify-center gap-4 py-3 flex-shrink-0 overflow-x-auto" style={{ borderTop: "1px solid #1c1c1c" }}>
        {[["사용중","#4CAF50"],["비어있음","#444"],["만료임박","#ff8800"],["만료","#cc4444"]].map(([l,c])=>(
          <div key={l} className="flex items-center gap-1">
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block" }}/>
            <span style={{ fontSize: 10, color: "#666" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* 락커 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setShowAdd(false)}>
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 20, padding: 24, width: 300 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 16 }}>락커 추가</p>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>락커 번호</p>
            <input
              className="w-full text-white"
              placeholder="예: 001"
              value={newNum}
              onChange={e => setNewNum(e.target.value)}
              style={{ background: "#252525", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", fontSize: 15, outline: "none", marginBottom: 14 }}
            />
            <p style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>구역 (탭)</p>
            <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setNewCatId(c.id)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 13,
                    background: newCatId === c.id ? "white" : "#252525",
                    color: newCatId === c.id ? "#0d0d0d" : "#888",
                    border: "1px solid " + (newCatId === c.id ? "white" : "#333"),
                    fontWeight: newCatId === c.id ? 600 : 400,
                  }}
                >{c.label}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#252525", color: "#888", fontSize: 14 }}>취소</button>
              <button
                disabled={!newNum || !newCatId || newCatId === "all"}
                onClick={() => createLocker.mutate({ lockerNumber: newNum, lockerType: newCatId })}
                style={{ flex: 1, padding: "10px", borderRadius: 10, background: (newNum && newCatId && newCatId !== "all") ? "white" : "#333", color: (newNum && newCatId && newCatId !== "all") ? "#0d0d0d" : "#555", fontSize: 14, fontWeight: 600 }}
              >추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 탭 설정 모달 */}
      {showCatMgr && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => { setShowCatMgr(false); setEditingCat(null); setNewCatLabel(""); }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "20px 20px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <p style={{ fontSize: 16, fontWeight: 700, color: "white" }}>락커 탭 설정</p>
              <button onClick={() => { setShowCatMgr(false); setEditingCat(null); setNewCatLabel(""); }} style={{ color: "#555", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            {/* 기존 탭 목록 */}
            <div className="space-y-2 mb-4">
              {cats.map((c) => (
                <div key={c.id} style={{ background: "#252525", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  {editingCat?.id === c.id ? (
                    <>
                      <input
                        autoFocus
                        value={editingCat.label}
                        onChange={e => setEditingCat({ ...editingCat, label: e.target.value })}
                        onKeyDown={e => { if (e.key === "Enter") renameCat(c.id, editingCat.label); if (e.key === "Escape") setEditingCat(null); }}
                        style={{ flex: 1, background: "#1a1a1a", border: "1px solid #444", borderRadius: 8, padding: "5px 10px", color: "white", fontSize: 14, outline: "none" }}
                      />
                      <button onClick={() => renameCat(c.id, editingCat.label)} style={{ fontSize: 13, padding: "5px 12px", background: "white", color: "#0d0d0d", borderRadius: 8, fontWeight: 600 }}>저장</button>
                      <button onClick={() => setEditingCat(null)} style={{ fontSize: 13, padding: "5px 10px", background: "#333", color: "#888", borderRadius: 8 }}>취소</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 14, color: "white" }}>{c.label}</span>
                      <span style={{ fontSize: 12, color: "#555" }}>{allLockers.filter(l => l.lockerType === c.id).length}개</span>
                      <button onClick={() => setEditingCat({ ...c })} style={{ fontSize: 12, padding: "4px 10px", background: "#333", color: "#aaa", borderRadius: 7 }}>이름 변경</button>
                      <button onClick={() => removeCat(c.id)} style={{ fontSize: 12, padding: "4px 10px", background: "#2a1a1a", color: "#884444", borderRadius: 7 }}>삭제</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* 새 탭 추가 */}
            <div style={{ background: "#252525", borderRadius: 12, padding: "12px 14px" }}>
              <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>새 탭 추가</p>
              <div className="flex gap-2">
                <input
                  placeholder="탭 이름 (예: 여자락커룸 B)"
                  value={newCatLabel}
                  onChange={e => setNewCatLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addCat(); }}
                  style={{ flex: 1, background: "#1a1a1a", border: "1px solid #444", borderRadius: 10, padding: "8px 12px", color: "white", fontSize: 13, outline: "none" }}
                />
                <button
                  disabled={!newCatLabel.trim()}
                  onClick={addCat}
                  style={{ padding: "8px 16px", borderRadius: 10, background: newCatLabel.trim() ? "white" : "#333", color: newCatLabel.trim() ? "#0d0d0d" : "#555", fontSize: 14, fontWeight: 600 }}
                >추가</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 회원검색 탭 ───────────────────────────────────────────────────────────────
function SearchTab() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: rows = [], refetch } = trpc.backoffice.searchMembers.useQuery({ q, page });
  const { data: detail } = trpc.backoffice.getMember.useQuery({ id: selectedId! }, { enabled: selectedId !== null });
  const updateMember = trpc.backoffice.updateMember.useMutation({ onSuccess: () => { refetch(); setEditMode(false); } });

  function openMember(id: number) { setSelectedId(id); setEditMode(false); }
  function startEdit() {
    if (!detail) return;
    setForm({ name: detail.member.name ?? "", phone: detail.member.phone ?? "", status: detail.member.status ?? "active", membershipStart: detail.member.membershipStart ?? "", membershipEnd: detail.member.membershipEnd ?? "", memo: detail.member.memo ?? "" });
    setEditMode(true);
  }

  const today = new Date().toISOString().slice(0, 10);

  if (selectedId && detail) {
    const m = detail.member;
    const isActive = m.membershipEnd && m.membershipEnd >= today;
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid #1e1e1e" }}>
          <button onClick={() => { setSelectedId(null); setEditMode(false); }} style={{ color: "#888", fontSize: 14 }}>← 뒤로</button>
          <p style={{ fontSize: 15, fontWeight: 700, color: "white" }}>회원 상세 정보</p>
          <button onClick={editMode ? () => updateMember.mutate({ id: selectedId, ...form, membershipStart: form.membershipStart||null, membershipEnd: form.membershipEnd||null, memo: form.memo||null }) : startEdit}
            style={{ marginLeft: "auto", fontSize: 13, padding: "4px 14px", background: "#252525", color: "white", borderRadius: 8 }}>
            {editMode ? "저장" : "수정"}
          </button>
          {editMode && <button onClick={() => setEditMode(false)} style={{ fontSize: 13, padding: "4px 14px", background: "#1c1c1c", color: "#888", borderRadius: 8 }}>취소</button>}
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* 프로필 헤더 */}
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #1e1e1e" }}>
            <div className="flex items-center gap-4">
              <div style={{ width: 60, height: 60, background: "#252525", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👤</div>
              <div>
                {editMode ? (
                  <input className="text-white font-bold" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={{ fontSize: 20, background: "#252525", border: "1px solid #333", borderRadius: 8, padding: "4px 10px", outline: "none" }}/>
                ) : (
                  <p style={{ fontSize: 20, fontWeight: 700, color: "white" }}>{m.name}</p>
                )}
                <p style={{ fontSize: 12, color: "#555", marginTop: 2 }}>회원번호 {String(m.id).padStart(7, "0")}</p>
                {editMode ? (
                  <input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} style={{ fontSize: 13, background: "#252525", border: "1px solid #333", borderRadius: 8, padding: "3px 8px", color: "#aaa", marginTop: 4, outline: "none" }}/>
                ) : (
                  <p style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{m.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* 락커 배정 */}
          {detail.locker && (
            <InfoSection title="락커 번호">
              <DetailRow icon="🔒" label="락커번호" value={`${detail.locker.lockerNumber} (${detail.locker.lockerType})`}/>
            </InfoSection>
          )}

          {/* 이용권 */}
          <InfoSection title="이용권">
            <DetailRow icon="💳" label="이용권" value={isActive ? "헬스 회원권" : "만료"} valueColor={isActive ? "#4CAF50" : "#cc4444"}/>
            <DetailRow icon="📅" label="이용기간"
              value={m.membershipStart && m.membershipEnd ? `${m.membershipStart} ~ ${m.membershipEnd}` : "-"}
            />
            {editMode && (
              <>
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <p style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>시작일</p>
                    <input type="date" value={form.membershipStart} onChange={e => setForm(f=>({...f,membershipStart:e.target.value}))} style={{ width: "100%", background: "#252525", border: "1px solid #333", borderRadius: 8, padding: "6px 10px", color: "white", fontSize: 12, outline: "none" }}/>
                  </div>
                  <div className="flex-1">
                    <p style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>종료일</p>
                    <input type="date" value={form.membershipEnd} onChange={e => setForm(f=>({...f,membershipEnd:e.target.value}))} style={{ width: "100%", background: "#252525", border: "1px solid #333", borderRadius: 8, padding: "6px 10px", color: "white", fontSize: 12, outline: "none" }}/>
                  </div>
                </div>
              </>
            )}
          </InfoSection>

          {/* PT 패키지 */}
          {detail.packages.length > 0 && (
            <InfoSection title="수강권">
              {detail.packages.map((p: any) => (
                <DetailRow key={p.id} icon="⭐" label={p.packageName}
                  value={`잔여 ${(p.totalSessions??0)-(p.usedSessions??0)}회 · ${p.expiryDate ? `~${p.expiryDate}` : "무기한"}`}
                  valueColor={p.status === "active" ? "#4CAF50" : "#555"}
                />
              ))}
            </InfoSection>
          )}

          {/* 메모 */}
          <InfoSection title="메모">
            {editMode ? (
              <textarea
                value={form.memo}
                onChange={e => setForm(f=>({...f,memo:e.target.value}))}
                placeholder="특이사항 입력..."
                style={{ width: "100%", background: "#252525", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 13, outline: "none", minHeight: 80, resize: "none" }}
              />
            ) : (
              <p style={{ fontSize: 13, color: m.memo ? "#aaa" : "#444" }}>{m.memo || "특이사항 없음"}</p>
            )}
          </InfoSection>

          {editMode && (
            <InfoSection title="상태">
              <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}
                style={{ background: "#252525", border: "1px solid #333", borderRadius: 8, padding: "6px 10px", color: "white", fontSize: 13, outline: "none" }}>
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
                <option value="blocked">차단</option>
              </select>
            </InfoSection>
          )}

          <div style={{ height: 24 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div style={{ background: "#1c1c1c", border: "1px solid #272727", borderRadius: 12, display: "flex", alignItems: "center", padding: "0 14px", gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="#555" strokeWidth="1.5"/><line x1="10" y1="10" x2="15" y2="15" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <input
            className="flex-1 text-white"
            placeholder="이름 또는 전화번호 검색"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            style={{ background: "transparent", border: "none", outline: "none", padding: "12px 0", fontSize: 14 }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          {(rows as any[]).map((m: any) => {
            const active = m.membershipEnd && m.membershipEnd >= today;
            return (
              <button key={m.id} onClick={() => openMember(m.id)} className="w-full text-left"
                style={{ background: "#1a1a1a", border: "1px solid #252525", borderRadius: 14, padding: "14px 16px", display: "block" }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 44, height: 44, background: "#252525", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>👤</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p style={{ fontSize: 15, fontWeight: 600, color: "white" }}>{m.name}</p>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: active ? "rgba(76,175,80,0.15)" : "rgba(180,0,0,0.15)", color: active ? "#4CAF50" : "#cc4444", fontWeight: 500 }}>
                        {active ? "활성" : "만료"}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{m.phone}</p>
                    <p style={{ fontSize: 11, color: "#444", marginTop: 1 }}>{m.membershipEnd ? `~${m.membershipEnd}` : "기간 없음"}</p>
                  </div>
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </button>
            );
          })}
          {(rows as any[]).length === 0 && (
            <div className="text-center py-16">
              <p style={{ fontSize: 14, color: "#444" }}>{q ? "검색 결과가 없습니다" : "이름 또는 전화번호를 입력하세요"}</p>
            </div>
          )}
        </div>

        {(rows as any[]).length === 30 && (
          <div className="flex justify-center gap-3 mt-4">
            <button disabled={page === 1} onClick={() => setPage(p=>p-1)} style={{ padding: "6px 16px", background: "#1c1c1c", color: page===1?"#333":"#888", borderRadius: 8, fontSize: 13 }}>이전</button>
            <span style={{ padding: "6px 0", color: "#555", fontSize: 13 }}>{page}p</span>
            <button onClick={() => setPage(p=>p+1)} style={{ padding: "6px 16px", background: "#1c1c1c", color: "#888", borderRadius: 8, fontSize: 13 }}>다음</button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid #1a1a1a" }}>
      <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.08em", marginBottom: 10 }}>{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function DetailRow({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, color: "#666", flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: valueColor ?? "#aaa", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ── 출입기록 탭 ───────────────────────────────────────────────────────────────
type LogFilter = "all" | "allowed" | "denied";

function LogsTab() {
  const { data: logs = [] } = trpc.backoffice.todayLogs.useQuery();
  const [filter, setFilter] = useState<LogFilter>("all");

  const allLogs = logs as any[];
  const filtered = filter === "all" ? allLogs : filter === "allowed" ? allLogs.filter(l => l.accessResult === "allowed") : allLogs.filter(l => l.accessResult !== "allowed");

  const resultInfo: Record<string, { label: string; color: string; bg: string }> = {
    allowed: { label: "입장", color: "#4CAF50", bg: "rgba(76,175,80,0.12)" },
    expired: { label: "만료", color: "#ff8800", bg: "rgba(255,136,0,0.12)" },
    blocked: { label: "차단", color: "#cc4444", bg: "rgba(180,0,0,0.12)" },
    not_found: { label: "미등록", color: "#555", bg: "rgba(80,80,80,0.12)" },
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 필터 탭 */}
      <div className="flex px-4 py-3 gap-2 flex-shrink-0" style={{ borderBottom: "1px solid #1e1e1e" }}>
        {([["all","전체"],["allowed","입장"],["denied","거부"]] as [LogFilter, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            style={{
              padding: "5px 16px",
              fontSize: 13,
              borderRadius: 20,
              background: filter === id ? "white" : "#1c1c1c",
              color: filter === id ? "#0d0d0d" : "#666",
              fontWeight: filter === id ? 600 : 400,
              border: "1px solid " + (filter === id ? "white" : "#2a2a2a"),
            }}
          >{label}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#444", alignSelf: "center" }}>{filtered.length}건</span>
      </div>

      {/* 날짜 헤더 */}
      <div style={{ padding: "10px 20px 6px", flexShrink: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#777" }}>
          {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
      </div>

      {/* 로그 목록 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          {filtered.map((l: any) => {
            const info = resultInfo[l.accessResult] ?? resultInfo.not_found;
            return (
              <div key={l.id} style={{ background: "#1a1a1a", border: "1px solid #252525", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, background: info.bg, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 18 }}>{l.accessResult === "allowed" ? "✓" : l.accessResult === "blocked" ? "🚫" : l.accessResult === "expired" ? "⏰" : "?"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p style={{ fontSize: 14, fontWeight: 600, color: "white" }}>{l.memberName ?? "미등록"}</p>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: info.bg, color: info.color, fontWeight: 600 }}>{info.label}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#555", marginTop: 1 }}>
                    {l.phone}
                    {l.membershipType ? ` · ${l.membershipType}` : ""}
                    {l.lockerNumber ? ` · 락커 ${l.lockerNumber}` : ""}
                  </p>
                </div>
                <p style={{ fontSize: 13, color: "#555", flexShrink: 0 }}>
                  {l.accessedAt ? l.accessedAt.slice(11, 16) : "-"}
                </p>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16"><p style={{ fontSize: 14, color: "#444" }}>출입 기록이 없습니다</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 통계 탭 ──────────────────────────────────────────────────────────────────
function StatsTab() {
  const { data: stats } = trpc.access.todayStats.useQuery();
  const { data: lockers = [] } = trpc.backoffice.getLockers.useQuery();

  const total = (lockers as any[]).length;
  const used = (lockers as any[]).filter((l: any) => l.isOccupied).length;
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;

  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* 일간/주간/월간/연간 탭 */}
        <Card style={{ gridColumn: "1 / -1" }}>
          <div className="flex gap-1 mb-4">
            {["일간","주간","월간","연간"].map((l, i) => (
              <button key={l} style={{ flex: 1, padding: "6px", fontSize: 12, borderRadius: 8, background: i===0 ? "#252525" : "transparent", color: i===0 ? "white" : "#555", fontWeight: i===0 ? 600 : 400 }}>{l}</button>
            ))}
          </div>
          <div className="flex justify-between items-center mb-2">
            <span style={{ color: "#555", fontSize: 12 }}>← 오늘 →</span>
          </div>
          {/* 간단한 막대 그래프 */}
          <div className="flex items-end gap-1" style={{ height: 60 }}>
            {[30,45,60,40,55,70,stats?.allowed ?? 0].map((v, i) => (
              <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(v,4)}%`, background: i===6 ? "white" : "#2a2a2a" }}/>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {["06","08","10","12","14","16","18"].map(h=>(
              <span key={h} style={{ fontSize: 9, color: "#444" }}>{h}</span>
            ))}
          </div>
        </Card>

        {/* 락커 사용률 도넛 */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, color: "white", marginBottom: 12 }}>락커 사용률</p>
          <div className="flex items-center gap-3">
            <svg width="88" height="88" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r="40" fill="none" stroke="#1c1c1c" strokeWidth="8"/>
              <circle cx="44" cy="44" r="40" fill="none" stroke="white" strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 0.5s" }}
              />
              <text x="44" y="44" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="14" fontWeight="bold">{pct}%</text>
            </svg>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, color: "white" }}>({used} / {total})</p>
              <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>사용 / 전체</p>
            </div>
          </div>
        </Card>

        {/* 출석 현황 */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, color: "white", marginBottom: 12 }}>출석 현황</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "white" }}>{stats?.allowed ?? 0}</p>
          <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>오늘 입장</p>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <div style={{ flex: 1, textAlign: "center", background: "#1c1c1c", borderRadius: 8, padding: "8px 4px" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#4CAF50" }}>{stats?.allowed ?? 0}</p>
              <p style={{ fontSize: 10, color: "#555" }}>입장</p>
            </div>
            <div style={{ flex: 1, textAlign: "center", background: "#1c1c1c", borderRadius: 8, padding: "8px 4px" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#cc4444" }}>{stats?.denied ?? 0}</p>
              <p style={{ fontSize: 10, color: "#555" }}>거부</p>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function Backoffice() {
  const [tab, setTab] = useState<BottomTab>("home");

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: "#0d0d0d", fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", color: "white" }}
    >
      {/* 상단 헤더 */}
      <div className="flex items-center px-5 py-3 flex-shrink-0" style={{ borderBottom: "1px solid #1a1a1a", background: "#0d0d0d" }}>
        <p className="font-bold tracking-widest" style={{ fontSize: 15 }}>ZIANTGYM</p>
        <div className="ml-auto flex items-center gap-3">
          <button style={{ color: "#555" }}>
            <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
              <path d="M10 22C11.1 22 12 21.1 12 20H8C8 21.1 8.9 22 10 22ZM18 16V10C18 6.93 16.37 4.36 13.5 3.68V3C13.5 2.17 12.83 1.5 12 1.5H8C7.17 1.5 6.5 2.17 6.5 3V3.68C3.64 4.36 2 6.92 2 10V16L0 18V19H20V18L18 16Z" fill="#555"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {tab === "home" && <HomeTab setTab={setTab} />}
        {tab === "locker" && <LockerTab />}
        {tab === "search" && <SearchTab />}
        {tab === "logs" && <LogsTab />}
        {tab === "stats" && <StatsTab />}
      </div>

      {/* 하단 네비게이션 */}
      <div className="flex flex-shrink-0" style={{ background: "#111111", borderTop: "1px solid #1e1e1e", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {navItems.map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Icon active={tab === id}>{icon}</Icon>
            <span style={{ fontSize: 10, color: tab === id ? "white" : "#555", fontWeight: tab === id ? 600 : 400 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
