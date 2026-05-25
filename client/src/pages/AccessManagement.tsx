import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import {
  DoorOpen,
  Lock,
  Unlock,
  Plus,
  Trash2,
  RefreshCw,
  CalendarDays,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LogIn,
  Image,
  Eye,
  EyeOff,
  Pencil,
} from "lucide-react";

type Branch = { id: number; name: string };

type LockerCategory = {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  branchId: number | null;
};

type Locker = {
  id: number;
  lockerNumber: string;
  lockerType: string;
  isOccupied: number;
  memberId: number | null;
  memberName: string | null;
  memberPhone: string | null;
  startDate: string | null;
  endDate: string | null;
  memo: string | null;
  branchId: number | null;
  categoryId: number | null;
};

type AccessLog = {
  id: number;
  memberName: string | null;
  phone: string;
  accessResult: string;
  membershipType: string | null;
  membershipEnd: string | null;
  lockerNumber: string | null;
  accessedAt: string;
  branchId: number | null;
};

type Member = { id: number; name: string; phone: string | null };

type KioskBanner = {
  id: number;
  title: string;
  body: string | null;
  imageUrl: string | null;
  bgColor: string;
  textColor: string;
  isActive: number;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

function resultLabel(r: string) {
  switch (r) {
    case "allowed": return { label: "입장", color: "text-green-400", icon: CheckCircle2 };
    case "expired": return { label: "만료", color: "text-yellow-400", icon: AlertCircle };
    case "not_found": return { label: "미등록", color: "text-gray-400", icon: XCircle };
    case "blocked": return { label: "차단", color: "text-red-400", icon: XCircle };
    default: return { label: r, color: "text-gray-400", icon: XCircle };
  }
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export default function AccessManagement() {
  const [tab, setTab] = useState<"logs" | "lockers" | "banners">("logs");
  const [logDate, setLogDate] = useState(new Date().toISOString().substring(0, 10));
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [showAddLocker, setShowAddLocker] = useState(false);
  const [showAssign, setShowAssign] = useState<Locker | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<LockerCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", color: "#3b82f6" });
  const [movingLockerId, setMovingLockerId] = useState<number | null>(null);
  const [showBannerForm, setShowBannerForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<KioskBanner | null>(null);
  const [bannerForm, setBannerForm] = useState({
    title: "", body: "", imageUrl: "", bgColor: "#1a3a6e", textColor: "#ffffff", sortOrder: 0, startDate: "", endDate: "", textAlign: "center", textVAlign: "center", branchId: null as number | null,
  });

  const utils = trpc.useUtils();

  const branchesQuery = trpc.access.getBranches.useQuery();
  const todayStats = trpc.access.todayStats.useQuery();
  const accessLogs = trpc.access.getAccessLogs.useQuery({ date: logDate, limit: 200 });
  const lockersQuery = trpc.access.getLockers.useQuery();
  const membersQuery = trpc.access.getMembersForLocker.useQuery();
  const bannersQuery = trpc.access.getAllBanners.useQuery();
  const categoriesQuery = trpc.access.getLockerCategories.useQuery();

  const categories = (categoriesQuery.data ?? []) as LockerCategory[];

  const releaseLocker = trpc.access.releaseLocker.useMutation({
    onSuccess: () => { utils.access.getLockers.invalidate(); toast.success("락커 반납 완료"); },
  });
  const deleteLocker = trpc.access.deleteLocker.useMutation({
    onSuccess: () => { utils.access.getLockers.invalidate(); toast.success("락커 삭제 완료"); },
  });
  const createCategory = trpc.access.createLockerCategory.useMutation({
    onSuccess: () => { utils.access.getLockerCategories.invalidate(); setShowCategoryForm(false); setCategoryForm({ name: "", color: "#3b82f6" }); toast.success("카테고리 추가 완료"); },
  });
  const updateCategory = trpc.access.updateLockerCategory.useMutation({
    onSuccess: () => { utils.access.getLockerCategories.invalidate(); setEditingCategory(null); setCategoryForm({ name: "", color: "#3b82f6" }); toast.success("카테고리 수정 완료"); },
  });
  const deleteCategory = trpc.access.deleteLockerCategory.useMutation({
    onSuccess: () => { utils.access.getLockerCategories.invalidate(); utils.access.getLockers.invalidate(); toast.success("카테고리 삭제 완료"); },
  });
  const setLockerCategory = trpc.access.setLockerCategory.useMutation({
    onSuccess: () => { utils.access.getLockers.invalidate(); setMovingLockerId(null); },
  });
  const createBanner = trpc.access.createBanner.useMutation({
    onSuccess: () => { utils.access.getAllBanners.invalidate(); setShowBannerForm(false); resetBannerForm(); toast.success("배너 추가 완료"); },
  });
  const updateBanner = trpc.access.updateBanner.useMutation({
    onSuccess: () => { utils.access.getAllBanners.invalidate(); setEditingBanner(null); resetBannerForm(); toast.success("배너 수정 완료"); },
  });
  const deleteBanner = trpc.access.deleteBanner.useMutation({
    onSuccess: () => { utils.access.getAllBanners.invalidate(); toast.success("배너 삭제 완료"); },
  });

  function resetBannerForm() {
    setBannerForm({ title: "", body: "", imageUrl: "", bgColor: "#1a3a6e", textColor: "#ffffff", sortOrder: 0, startDate: "", endDate: "", textAlign: "center", textVAlign: "center", branchId: null });
  }
  function openEditBanner(b: KioskBanner) {
    setEditingBanner(b);
    setBannerForm({
      title: b.title, body: b.body ?? "", imageUrl: b.imageUrl ?? "",
      bgColor: b.bgColor, textColor: b.textColor, sortOrder: b.sortOrder,
      startDate: b.startDate ?? "", endDate: b.endDate ?? "",
      textAlign: (b as any).textAlign ?? "center",
      textVAlign: (b as any).textVAlign ?? "center",
      branchId: (b as any).branchId ?? null,
    });
  }
  function saveBanner() {
    const payload = {
      title: bannerForm.title,
      body: bannerForm.body || undefined,
      imageUrl: bannerForm.imageUrl || undefined,
      bgColor: bannerForm.bgColor,
      textColor: bannerForm.textColor,
      sortOrder: bannerForm.sortOrder,
      startDate: bannerForm.startDate || undefined,
      endDate: bannerForm.endDate || undefined,
      textAlign: bannerForm.textAlign,
      textVAlign: bannerForm.textVAlign,
      branchId: bannerForm.branchId,
    };
    if (editingBanner) {
      updateBanner.mutate({ id: editingBanner.id, ...payload });
    } else {
      createBanner.mutate(payload);
    }
  }

  const branches = (branchesQuery.data ?? []) as Branch[];
  const allLockers = (lockersQuery.data ?? []) as Locker[];
  const allLogs = (accessLogs.data ?? []) as AccessLog[];
  const members = (membersQuery.data ?? []) as Member[];

  const lockers = selectedBranch
    ? allLockers.filter((l) => l.branchId === selectedBranch)
    : allLockers;
  const logs = selectedBranch
    ? allLogs.filter((l) => l.branchId === selectedBranch)
    : allLogs;

  const occupiedCount = lockers.filter((l) => l.isOccupied).length;

  // 지점 필터가 걸린 경우 해당 지점 통계를 logs에서 계산
  const stats = selectedBranch
    ? {
        total: logs.length,
        allowed: logs.filter((l) => l.accessResult === "allowed").length,
        denied: logs.filter((l) => l.accessResult !== "allowed").length,
      }
    : todayStats.data ?? { total: 0, allowed: 0, denied: 0 };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <DoorOpen className="h-5 w-5 text-primary" />
          출입 관리
        </h1>
        <a
          href="/kiosk"
          target="_blank"
          className="flex items-center gap-1.5 text-sm bg-primary/20 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/30 transition-colors"
        >
          <LogIn className="h-4 w-4" />
          키오스크 열기
        </a>
      </div>

      {/* 지점 필터 */}
      {branches.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedBranch(null)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedBranch === null
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            전체
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBranch(b.id)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedBranch === b.id
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* 오늘 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label={selectedBranch ? `${branches.find(b => b.id === selectedBranch)?.name} 출입` : "오늘 총 출입"}
          value={stats.total}
          icon={<Users className="h-4 w-4" />}
          color="text-primary"
        />
        <StatCard
          label="입장 허가"
          value={stats.allowed}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="text-green-400"
        />
        <StatCard
          label="입장 거부"
          value={stats.denied}
          icon={<XCircle className="h-4 w-4" />}
          color="text-red-400"
        />
      </div>

      {/* 탭 */}
      <div className="flex gap-0 rounded-lg overflow-hidden border border-border">
        {(["logs", "lockers", "banners"] as const).map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-accent"
            } ${i < 2 ? "border-r border-border" : ""}`}
          >
            {t === "logs" ? (
              <span className="flex items-center justify-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> 출입 로그
              </span>
            ) : t === "lockers" ? (
              <span className="flex items-center justify-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> 락커 관리 ({occupiedCount}/{lockers.length})
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <Image className="h-3.5 w-3.5" /> 배너 관리
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 출입 로그 */}
      {tab === "logs" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
            />
            <button
              onClick={() => utils.access.getAccessLogs.invalidate()}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-sm text-muted-foreground">{logs.length}건</span>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">시간</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">이름</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium hidden sm:table-cell">전화번호</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">결과</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium hidden sm:table-cell">회원권</th>
                  {branches.length > 0 && (
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium hidden md:table-cell">지점</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={branches.length > 0 ? 6 : 5} className="text-center py-10 text-muted-foreground">
                      출입 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const res = resultLabel(log.accessResult);
                    const ResIcon = res.icon;
                    const branchName = branches.find((b) => b.id === log.branchId)?.name;
                    return (
                      <tr key={log.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                          {formatTime(log.accessedAt)}
                        </td>
                        <td className="px-3 py-2.5 font-medium">
                          {log.memberName ?? <span className="text-muted-foreground text-xs">미등록</span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{log.phone}</td>
                        <td className="px-3 py-2.5">
                          <span className={`flex items-center gap-1 ${res.color}`}>
                            <ResIcon className="h-3.5 w-3.5" />
                            {res.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                          {log.membershipType ?? "-"}
                        </td>
                        {branches.length > 0 && (
                          <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                            {branchName ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                                {branchName}
                              </span>
                            ) : "-"}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 락커 관리 */}
      {tab === "lockers" && (
        <div className="space-y-3">
          {/* 카테고리 관리 바 */}
          <div className="flex items-center gap-2 flex-wrap border border-border rounded-xl p-3 bg-card/50">
            <span className="text-xs text-muted-foreground font-medium shrink-0">카테고리</span>
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-1 group">
                {editingCategory?.id === cat.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={categoryForm.color}
                      onChange={(e) => setCategoryForm((f) => ({ ...f, color: e.target.value }))}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                    />
                    <input
                      className="border border-border rounded px-2 py-0.5 text-xs bg-background w-20"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateCategory.mutate({ id: cat.id, name: categoryForm.name, color: categoryForm.color });
                        if (e.key === "Escape") setEditingCategory(null);
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => updateCategory.mutate({ id: cat.id, name: categoryForm.name, color: categoryForm.color })}
                      className="text-xs text-primary"
                    >저장</button>
                    <button onClick={() => setEditingCategory(null)} className="text-xs text-muted-foreground">취소</button>
                  </div>
                ) : (
                  <span
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-default"
                    style={{ background: cat.color + "22", color: cat.color, border: `1px solid ${cat.color}44` }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: cat.color }}
                    />
                    {cat.name}
                    <button
                      onClick={() => { setEditingCategory(cat); setCategoryForm({ name: cat.name, color: cat.color }); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`"${cat.name}" 카테고리를 삭제하시겠습니까?\n해당 카테고리의 락커는 미분류로 이동됩니다.`)) deleteCategory.mutate({ id: cat.id }); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XCircle className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
              </div>
            ))}
            {showCategoryForm ? (
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                />
                <input
                  className="border border-border rounded px-2 py-0.5 text-xs bg-background w-24"
                  placeholder="카테고리명"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && categoryForm.name) createCategory.mutate({ name: categoryForm.name, color: categoryForm.color, branchId: selectedBranch ?? undefined });
                    if (e.key === "Escape") { setShowCategoryForm(false); setCategoryForm({ name: "", color: "#3b82f6" }); }
                  }}
                  autoFocus
                />
                <button
                  onClick={() => categoryForm.name && createCategory.mutate({ name: categoryForm.name, color: categoryForm.color, branchId: selectedBranch ?? undefined })}
                  className="text-xs text-primary"
                >추가</button>
                <button
                  onClick={() => { setShowCategoryForm(false); setCategoryForm({ name: "", color: "#3b82f6" }); }}
                  className="text-xs text-muted-foreground"
                >취소</button>
              </div>
            ) : (
              <button
                onClick={() => setShowCategoryForm(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full border border-dashed border-border"
              >
                <Plus className="h-3 w-3" /> 추가
              </button>
            )}
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              사용 중 {occupiedCount}개 / 전체 {lockers.length}개
            </p>
            <button
              onClick={() => setShowAddLocker(true)}
              className="flex items-center gap-1.5 text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> 락커 추가
            </button>
          </div>

          {/* 카테고리별 그룹 표시 */}
          {(() => {
            const displayLockers = lockers;
            const grouped: { label: string; color?: string; catId: number | null; items: typeof displayLockers }[] = [
              ...categories.map((cat) => ({
                label: cat.name,
                color: cat.color,
                catId: cat.id,
                items: displayLockers.filter((l) => l.categoryId === cat.id),
              })),
              {
                label: "미분류",
                color: undefined,
                catId: null,
                items: displayLockers.filter((l) => !l.categoryId || !categories.find((c) => c.id === l.categoryId)),
              },
            ].filter((g) => g.items.length > 0);

            if (grouped.length === 0) return (
              <div className="text-center py-10 text-muted-foreground text-sm">등록된 락커가 없습니다.</div>
            );

            return grouped.map((group) => (
              <div key={group.catId ?? "uncat"} className="space-y-2">
                <div className="flex items-center gap-2">
                  {group.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: group.color }} />}
                  <span className="text-sm font-semibold" style={{ color: group.color ?? undefined }}>
                    {group.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.items.filter((l) => l.isOccupied).length}/{group.items.length}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {group.items.map((locker) => (
                    <LockerCard
                      key={locker.id}
                      locker={locker}
                      categories={categories}
                      movingLockerId={movingLockerId}
                      onAssign={() => setShowAssign(locker)}
                      onRelease={() => {
                        if (confirm(`${locker.lockerNumber}번 락커를 반납하시겠습니까?`))
                          releaseLocker.mutate({ lockerId: locker.id });
                      }}
                      onDelete={() => {
                        if (!locker.isOccupied && confirm(`${locker.lockerNumber}번 락커를 삭제하시겠습니까?`))
                          deleteLocker.mutate({ lockerId: locker.id });
                      }}
                      onMoveCategory={(catId) => setLockerCategory.mutate({ lockerId: locker.id, categoryId: catId })}
                      onToggleMove={() => setMovingLockerId((id) => id === locker.id ? null : locker.id)}
                    />
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* 배너 관리 */}
      {tab === "banners" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              키오스크 상단에 표시되는 이벤트/공지 배너입니다.
            </p>
            <button
              onClick={() => { resetBannerForm(); setEditingBanner(null); setShowBannerForm(true); }}
              className="flex items-center gap-1.5 text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> 배너 추가
            </button>
          </div>

          {/* 배너 등록/수정 폼 */}
          {(showBannerForm || editingBanner) && (
            <div className="border border-border rounded-xl p-4 bg-card space-y-3">
              <h3 className="font-semibold text-sm">{editingBanner ? "배너 수정" : "새 배너 추가"}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">제목 *</label>
                  <input
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    placeholder="예: 🎉 5월 특별 이벤트"
                    value={bannerForm.title}
                    onChange={(e) => setBannerForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">노출 지점</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={bannerForm.branchId ?? ""}
                    onChange={(e) => setBannerForm((f) => ({ ...f, branchId: e.target.value === "" ? null : Number(e.target.value) }))}
                  >
                    <option value="">전체 (모든 지점)</option>
                    {branches.map((br) => (
                      <option key={br.id} value={br.id}>{br.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">내용 (선택)</label>
                  <textarea
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none"
                    rows={2}
                    placeholder="예: 신규 회원 등록 시 PT 3회 무료 증정"
                    value={bannerForm.body}
                    onChange={(e) => setBannerForm((f) => ({ ...f, body: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">이미지 URL (선택)</label>
                  <input
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    placeholder="https://i.imgur.com/xxx.jpg  ← 직접 이미지 주소(.jpg/.png)만 가능"
                    value={bannerForm.imageUrl}
                    onChange={(e) => setBannerForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  />
                  {bannerForm.imageUrl && !/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(bannerForm.imageUrl) && (
                    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                      ⚠ 이미지 파일 URL이 아닌 것 같습니다. imgbb.com 또는 imgur.com에 업로드 후 직접 링크를 사용하세요.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">배경색 (이미지 없을 때)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="w-10 h-9 rounded border border-border bg-background cursor-pointer"
                      value={bannerForm.bgColor}
                      onChange={(e) => setBannerForm((f) => ({ ...f, bgColor: e.target.value }))}
                    />
                    <input
                      className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                      value={bannerForm.bgColor}
                      onChange={(e) => setBannerForm((f) => ({ ...f, bgColor: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">글자색</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="w-10 h-9 rounded border border-border bg-background cursor-pointer"
                      value={bannerForm.textColor}
                      onChange={(e) => setBannerForm((f) => ({ ...f, textColor: e.target.value }))}
                    />
                    <input
                      className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                      value={bannerForm.textColor}
                      onChange={(e) => setBannerForm((f) => ({ ...f, textColor: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">노출 시작일 (선택)</label>
                  <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={bannerForm.startDate}
                    onChange={(e) => setBannerForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">노출 종료일 (선택)</label>
                  <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={bannerForm.endDate}
                    onChange={(e) => setBannerForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">순서</label>
                  <input type="number" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={bannerForm.sortOrder}
                    onChange={(e) => setBannerForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                  />
                </div>
                {/* 텍스트 위치 피커 */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">텍스트 위치</label>
                  <div className="grid grid-cols-3 gap-1.5" style={{ width: 108 }}>
                    {(["top","center","bottom"] as const).map((v) =>
                      (["left","center","right"] as const).map((h) => {
                        const active = bannerForm.textVAlign === v && bannerForm.textAlign === h;
                        return (
                          <button
                            key={`${v}-${h}`}
                            type="button"
                            onClick={() => setBannerForm((f) => ({ ...f, textAlign: h, textVAlign: v }))}
                            className={`rounded flex items-center justify-center transition-colors ${active ? "bg-primary" : "bg-muted hover:bg-accent border border-border"}`}
                            style={{ width: 32, height: 32 }}
                          >
                            <div className={`rounded-sm ${active ? "bg-white" : "bg-muted-foreground/50"}`}
                              style={{
                                width: 14, height: 10,
                                alignSelf: v === "top" ? "flex-start" : v === "bottom" ? "flex-end" : "center",
                                marginLeft: h === "left" ? 2 : h === "right" ? "auto" : "auto",
                                marginRight: h === "right" ? 2 : h === "left" ? "auto" : "auto",
                              }}
                            />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
              {/* 미리보기 */}
              <div
                className="rounded-xl relative overflow-hidden"
                style={{
                  height: 120,
                  background: bannerForm.imageUrl
                    ? `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.55)), url(${bannerForm.imageUrl}) center/cover`
                    : bannerForm.bgColor,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: bannerForm.textAlign === "left" ? "flex-start" : bannerForm.textAlign === "right" ? "flex-end" : "center",
                  justifyContent: bannerForm.textVAlign === "top" ? "flex-start" : bannerForm.textVAlign === "bottom" ? "flex-end" : "center",
                  padding: 16,
                }}
              >
                <p className="font-bold text-sm" style={{ color: bannerForm.textColor, textAlign: bannerForm.textAlign as any }}>{bannerForm.title || "제목 미리보기"}</p>
                {bannerForm.body && <p className="text-xs mt-1 opacity-80" style={{ color: bannerForm.textColor, textAlign: bannerForm.textAlign as any }}>{bannerForm.body}</p>}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowBannerForm(false); setEditingBanner(null); resetBannerForm(); }}
                  className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent"
                >취소</button>
                <button
                  onClick={saveBanner}
                  disabled={!bannerForm.title || createBanner.isPending || updateBanner.isPending}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >{editingBanner ? "수정 완료" : "추가"}</button>
              </div>
            </div>
          )}

          {/* 배너 목록 */}
          <div className="space-y-2">
            {(bannersQuery.data ?? []).length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">등록된 배너가 없습니다.</div>
            ) : (
              (bannersQuery.data as KioskBanner[] ?? []).map((b) => (
                <div key={b.id} className="flex items-center gap-3 border border-border rounded-xl p-3 bg-card">
                  {/* 미니 배너 미리보기 */}
                  <div
                    className="shrink-0 rounded-lg flex items-end p-2"
                    style={{
                      width: 80, height: 52,
                      background: b.imageUrl
                        ? `linear-gradient(to bottom,rgba(0,0,0,0.1),rgba(0,0,0,0.55)),url(${b.imageUrl}) center/cover`
                        : b.bgColor,
                    }}
                  >
                    <p className="text-xs font-semibold truncate" style={{ color: b.textColor }}>{b.title}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{b.title}</p>
                    {b.body && <p className="text-xs text-muted-foreground truncate">{b.body}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>{b.startDate && `${b.startDate} ~`} {b.endDate && b.endDate}{!b.startDate && !b.endDate && "항상 표시"}</span>
                      {(b as any).branchId
                        ? <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
                            {branches.find((br) => br.id === (b as any).branchId)?.name ?? `지점 ${(b as any).branchId}`}
                          </span>
                        : <span className="px-1.5 py-0.5 rounded text-xs text-muted-foreground/60" style={{ background: "rgba(255,255,255,0.05)" }}>전체</span>
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateBanner.mutate({ id: b.id, isActive: b.isActive === 0 })}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors border ${
                        b.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                          : "bg-muted text-muted-foreground border-border hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30"
                      }`}
                      title={b.isActive ? "클릭하면 끄기" : "클릭하면 켜기"}
                    >
                      {b.isActive ? <><Eye className="h-3 w-3" />노출 중</> : <><EyeOff className="h-3 w-3" />숨김</>}
                    </button>
                    <button
                      onClick={() => { openEditBanner(b); setShowBannerForm(false); }}
                      className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm("배너를 삭제하시겠습니까?")) deleteBanner.mutate({ id: b.id }); }}
                      className="p-1.5 rounded-lg hover:bg-accent text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 락커 추가 모달 */}
      {showAddLocker && (
        <AddLockerModal
          branches={branches}
          defaultBranchId={selectedBranch}
          onClose={() => setShowAddLocker(false)}
          onAdded={() => { utils.access.getLockers.invalidate(); setShowAddLocker(false); }}
        />
      )}

      {/* 락커 배정 모달 */}
      {showAssign && (
        <AssignLockerModal
          locker={showAssign}
          members={members}
          onClose={() => setShowAssign(null)}
          onAssigned={() => { utils.access.getLockers.invalidate(); setShowAssign(null); }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className={`flex items-center gap-1.5 ${color} mb-1`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function LockerCard({
  locker,
  categories,
  movingLockerId,
  onAssign,
  onRelease,
  onDelete,
  onMoveCategory,
  onToggleMove,
}: {
  locker: Locker;
  categories: LockerCategory[];
  movingLockerId: number | null;
  onAssign: () => void;
  onRelease: () => void;
  onDelete: () => void;
  onMoveCategory: (catId: number | null) => void;
  onToggleMove: () => void;
}) {
  const isOccupied = locker.isOccupied === 1;
  const isMoving = movingLockerId === locker.id;
  const currentCat = categories.find((c) => c.id === locker.categoryId);

  return (
    <div className={`border rounded-xl p-3 space-y-1.5 relative ${isOccupied ? "border-orange-500/50 bg-orange-500/5" : "border-border bg-card"}`}>
      <div className="flex justify-between items-center">
        <span className="font-bold text-lg">{locker.lockerNumber}</span>
        <div className="flex items-center gap-1">
          {currentCat && (
            <span className="w-2 h-2 rounded-full" style={{ background: currentCat.color }} title={currentCat.name} />
          )}
          {isOccupied ? <Lock className="h-4 w-4 text-orange-500" /> : <Unlock className="h-4 w-4 text-gray-500" />}
        </div>
      </div>

      {/* 카테고리 이동 드롭다운 */}
      {isMoving && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-card border border-primary rounded-xl p-2 shadow-lg space-y-1">
          <p className="text-xs text-muted-foreground mb-1 font-medium">카테고리 이동</p>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { onMoveCategory(cat.id); }}
              className="w-full text-left text-xs px-2 py-1.5 rounded flex items-center gap-2 hover:bg-accent transition-colors"
              style={{ color: cat.color }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
              {cat.name}
            </button>
          ))}
          <button
            onClick={() => onMoveCategory(null)}
            className="w-full text-left text-xs px-2 py-1.5 rounded text-muted-foreground hover:bg-accent"
          >미분류</button>
          <button onClick={onToggleMove} className="w-full text-xs py-1 text-muted-foreground border-t border-border mt-1 pt-1">닫기</button>
        </div>
      )}

      {isOccupied ? (
        <>
          <p className="text-sm font-medium text-foreground truncate">{locker.memberName}</p>
          <p className="text-xs text-muted-foreground truncate">{locker.memberPhone ?? ""}</p>
          {locker.endDate && <p className="text-xs text-muted-foreground">~ {locker.endDate}</p>}
          <button onClick={onRelease} className="w-full text-xs py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors mt-1">반납</button>
          {categories.length > 0 && (
            <button onClick={onToggleMove} className="w-full text-xs py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted transition-colors">
              카테고리
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">비어있음</p>
          <button onClick={onAssign} className="w-full text-xs py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors mt-1">배정</button>
          {categories.length > 0 && (
            <button onClick={onToggleMove} className="w-full text-xs py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted transition-colors">
              카테고리
            </button>
          )}
          <button onClick={onDelete} className="w-full text-xs py-1 rounded-md bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 transition-colors">
            <Trash2 className="h-3 w-3 inline" /> 삭제
          </button>
        </>
      )}
    </div>
  );
}

function AddLockerModal({
  branches,
  defaultBranchId,
  onClose,
  onAdded,
}: {
  branches: Branch[];
  defaultBranchId: number | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [number, setNumber] = useState("");
  const [type, setType] = useState("personal");
  const [memo, setMemo] = useState("");
  const [branchId, setBranchId] = useState<string>(defaultBranchId ? String(defaultBranchId) : "");
  const [categoryId, setCategoryId] = useState<string>("");
  const [bulk, setBulk] = useState(false);
  const [bulkFrom, setBulkFrom] = useState("1");
  const [bulkTo, setBulkTo] = useState("10");

  const categoriesQuery = trpc.access.getLockerCategories.useQuery();

  const createLocker = trpc.access.createLocker.useMutation({
    onSuccess: onAdded,
    onError: () => toast.error("락커 추가 실패"),
  });

  const handleSubmit = async () => {
    const bid = branchId ? parseInt(branchId) : undefined;
    if (bulk) {
      const from = parseInt(bulkFrom);
      const to = parseInt(bulkTo);
      if (isNaN(from) || isNaN(to) || from > to) {
        toast.error("올바른 범위를 입력하세요");
        return;
      }
      for (let i = from; i <= to; i++) {
        await createLocker.mutateAsync({ lockerNumber: String(i), lockerType: type, memo, branchId: bid });
      }
    } else {
      if (!number.trim()) { toast.error("락커 번호를 입력하세요"); return; }
      createLocker.mutate({ lockerNumber: number.trim(), lockerType: type, memo, branchId: bid, categoryId: categoryId ? Number(categoryId) : undefined });
    }
  };

  return (
    <Modal title="락커 추가" onClose={onClose}>
      <div className="space-y-3">
        {branches.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">지점</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="">지점 미지정</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {(categoriesQuery.data ?? []).length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">카테고리</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="">미분류</option>
              {(categoriesQuery.data as LockerCategory[]).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bulk} onChange={(e) => setBulk(e.target.checked)} />
          일괄 추가
        </label>

        {bulk ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={bulkFrom}
              onChange={(e) => setBulkFrom(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-24"
              placeholder="시작"
            />
            <span className="text-muted-foreground">~</span>
            <input
              type="number"
              value={bulkTo}
              onChange={(e) => setBulkTo(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-24"
              placeholder="끝"
            />
          </div>
        ) : (
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            placeholder="락커 번호 (예: 101)"
          />
        )}

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
        >
          <option value="personal">개인 락커</option>
          <option value="sports_wear">운동복 보관</option>
        </select>

        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
          placeholder="메모 (선택)"
        />

        <button
          onClick={handleSubmit}
          disabled={createLocker.isPending}
          className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {createLocker.isPending ? "추가 중..." : "추가"}
        </button>
      </div>
    </Modal>
  );
}

function AssignLockerModal({
  locker,
  members,
  onClose,
  onAssigned,
}: {
  locker: Locker;
  members: Member[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [endDate, setEndDate] = useState("");

  const assignLocker = trpc.access.assignLocker.useMutation({
    onSuccess: onAssigned,
    onError: () => toast.error("배정 실패"),
  });

  const selectedMember = members.find((m) => String(m.id) === memberId);

  const handleSubmit = () => {
    if (!selectedMember) { toast.error("회원을 선택하세요"); return; }
    assignLocker.mutate({
      lockerId: locker.id,
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      memberPhone: selectedMember.phone ?? undefined,
      startDate,
      endDate: endDate || undefined,
    });
  };

  return (
    <Modal title={`락커 ${locker.lockerNumber} 배정`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">회원 선택</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
          >
            <option value="">-- 회원 선택 --</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.phone ? `(${m.phone})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">만료일 (선택)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={assignLocker.isPending}
          className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {assignLocker.isPending ? "배정 중..." : "배정"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
