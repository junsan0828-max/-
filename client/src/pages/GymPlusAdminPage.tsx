import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { GymPlusMembersAdmin, GymPlusVideosAdmin, GymPlusEventsAdmin, GymPlusWorkoutLogsAdmin, GymPlusRenewalsAdmin } from "./gym-plus/GymPlusAdmin";
import GymPlusMessageAdmin from "./gym-plus/GymPlusMessageAdmin";

type Tab = "members" | "renewals" | "videos" | "events" | "logs" | "messages" | "shop";

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: "members", label: "회원관리", icon: "◎" },
  { key: "renewals", label: "재등록신청", icon: "↻" },
  { key: "videos", label: "운동영상", icon: "▶" },
  { key: "events", label: "공지", icon: "★" },
  { key: "logs", label: "기록관리", icon: "≡" },
  { key: "messages", label: "메시지", icon: "✉" },
  { key: "shop", label: "포인트샵", icon: "⭐" },
];

const SESSION_KEY = "gymplus_admin_verified";

function AdminLoginGate({ onVerified }: { onVerified: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const loginMutation = trpc.gymPlus.adminLogin.useMutation({
    onSuccess: async (data) => {
      sessionStorage.setItem(SESSION_KEY, data.username);
      await utils.gymPlus.adminMe.invalidate();
      onVerified();
    },
    onError: (err) => toast.error(err.message || "로그인 실패"),
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1
            style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.1em" }}
            className="text-2xl font-semibold text-foreground"
          >
            ZIANTGYM<span className="text-primary">+</span>
          </h1>
          <p className="text-sm text-muted-foreground">관리자 로그인</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loginMutation.mutate({ username, password });
          }}
          className="space-y-3"
        >
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디"
            className="w-full px-4 py-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="w-full px-4 py-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loginMutation.isPending || !username || !password}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-opacity"
          >
            {loginMutation.isPending ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}

function LogoutButton({ onDone }: { onDone: () => void }) {
  const logout = trpc.gymPlus.adminLogout.useMutation({ onSettled: onDone });
  return (
    <button
      onClick={() => logout.mutate()}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      로그아웃
    </button>
  );
}

export default function GymPlusAdminPage() {
  const [verified, setVerified] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("members");

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) setVerified(true);
  }, []);

  // 서버 세션 검증: sessionStorage에 흔적이 남아있어도 서버 세션이 없으면(만료·배포 등)
  // 로그인 게이트로 되돌린다. 안 그러면 admin_* 호출이 401로 깨진다.
  const { data: adminSession, isFetched } = trpc.gymPlus.adminMe.useQuery();
  useEffect(() => {
    if (isFetched && !adminSession && verified) {
      sessionStorage.removeItem(SESSION_KEY);
      setVerified(false);
    }
  }, [isFetched, adminSession, verified]);

  if (!verified) {
    return <AdminLoginGate onVerified={() => setVerified(true)} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span
          style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.1em" }}
          className="text-xl font-semibold text-foreground"
        >
          ZIANTGYM<span className="text-primary">+</span>
        </span>
        <LogoutButton onDone={() => { sessionStorage.removeItem(SESSION_KEY); setVerified(false); }} />
      </header>

      <main className="flex-1 overflow-y-auto pb-20 max-w-2xl w-full mx-auto">
        <div className="p-4">
          {activeTab === "members" && <GymPlusMembersAdmin />}
          {activeTab === "renewals" && <GymPlusRenewalsAdmin />}
          {activeTab === "videos" && <GymPlusVideosAdmin />}
          {activeTab === "events" && <GymPlusEventsAdmin />}
          {activeTab === "logs" && <GymPlusWorkoutLogsAdmin />}
          {activeTab === "messages" && <GymPlusMessageAdmin />}
          {activeTab === "shop" && <PointShopAdmin />}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-10">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
                activeTab === tab.key ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span className="text-[10px] leading-none">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ─── 포인트샵 상품 관리 ────────────────────────────────────────────────────────
function PointShopAdmin() {
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.access.shopAdmin.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "0", stock: "" });

  const createMutation = trpc.access.createShopItem.useMutation({
    onSuccess: () => { toast.success("상품 추가 완료"); utils.access.shopAdmin.invalidate(); utils.access.getShopItems.invalidate(); setShowForm(false); resetForm(); },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.access.updateShopItem.useMutation({
    onSuccess: () => { toast.success("수정 완료"); utils.access.shopAdmin.invalidate(); utils.access.getShopItems.invalidate(); setEditing(null); },
    onError: e => toast.error(e.message),
  });
  const deleteMutation = trpc.access.deleteShopItem.useMutation({
    onSuccess: () => { toast.success("삭제 완료"); utils.access.shopAdmin.invalidate(); utils.access.getShopItems.invalidate(); },
    onError: e => toast.error(e.message),
  });

  function resetForm() { setForm({ name: "", description: "", price: "0", stock: "" }); }
  function openEdit(item: any) {
    setEditing(item);
    setForm({ name: item.name, description: item.description ?? "", price: String(item.price ?? 0), stock: item.stock !== null ? String(item.stock) : "" });
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("상품명을 입력해주세요"); return; }
    const price = Number(form.price);
    if (isNaN(price) || price < 0) { toast.error("판매가를 입력해주세요"); return; }
    const stock = form.stock !== "" ? Number(form.stock) : undefined;
    if (editing) {
      updateMutation.mutate({ id: editing.id, name: form.name.trim(), description: form.description || undefined, price, stock: stock ?? null });
    } else {
      createMutation.mutate({ name: form.name.trim(), description: form.description || undefined, price, stock });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">키오스크 포인트 사용 버튼에 표시되는 구매 가능 상품입니다.</p>
        {!showForm && !editing && (
          <button onClick={() => { resetForm(); setEditing(null); setShowForm(true); }}
            className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90">
            + 상품 추가
          </button>
        )}
      </div>

      {(showForm || editing) && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{editing ? "상품 수정" : "새 상품 추가"}</p>
            <button onClick={() => { setShowForm(false); setEditing(null); resetForm(); }} className="text-muted-foreground text-sm">✕</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">상품명 *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 아이스티, 단백질 바"
                className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">설명</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="간단한 설명 (선택)"
                className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">판매가 (원) *</label>
                <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                <p className="text-[10px] text-muted-foreground mt-1">3,000P 이상 보유 시 포인트 할인, 차액 카드/이체</p>
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">재고 (비워두면 무제한)</label>
                <input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="무제한"
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-50">
              {createMutation.isPending || updateMutation.isPending ? "저장 중..." : editing ? "수정 저장" : "추가"}
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-muted-foreground py-6 text-sm">로딩 중...</div>
      ) : !items?.length ? (
        <div className="text-center text-muted-foreground py-8 text-sm">
          ⭐<br />등록된 상품이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{item.name}</span>
                  <span className="text-xs font-bold">{(item.price ?? 0).toLocaleString()}원</span>
                  {item.isActive === 0 && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">비활성</span>}
                </div>
                {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">재고: {item.stock !== null ? `${item.stock}개` : "무제한"}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(item)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/40 text-xs">수정</button>
                <button onClick={() => updateMutation.mutate({ id: item.id, isActive: item.isActive === 1 ? 0 : 1 })}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/40 text-xs">
                  {item.isActive === 1 ? "숨김" : "표시"}
                </button>
                <button onClick={() => { if (confirm(`"${item.name}" 삭제?`)) deleteMutation.mutate({ id: item.id }); }}
                  className="p-1.5 text-red-400 hover:text-red-300 rounded-lg text-xs">삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
