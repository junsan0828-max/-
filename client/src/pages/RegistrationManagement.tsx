import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Lock,
  Unlock,
  Plus,
  Trash2,
  XCircle,
  Pencil,
  Shirt,
  UserPlus,
  RefreshCw,
  Gift,
  CalendarDays,
  Key,
  Search,
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

type Member = { id: number; name: string; phone: string | null };

type ServiceModal = {
  memberId: number | null;
  memberName: string;
  memberPhone?: string | null;
  serviceType: string;
  details: string;
} | null;

export default function RegistrationManagement() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = trpc.auth.me.useQuery();
  const isTrainer = currentUser?.role === "trainer";
  const [tab, setTab] = useState<"members" | "lockers" | "uniforms" | "services">("members");
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceModal, setServiceModal] = useState<ServiceModal>(null);
  const { data: memberRevenue, isLoading: memberRevenueLoading } = trpc.gym.revenue.getByMember.useQuery(
    { memberId: serviceModal?.memberId ?? 0 },
    { enabled: !!(serviceModal?.memberId) }
  );

  // 락커 관리 state
  const [showAddLocker, setShowAddLocker] = useState(false);
  const [showAssign, setShowAssign] = useState<Locker | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<LockerCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", color: "#3b82f6" });
  const [movingLockerId, setMovingLockerId] = useState<number | null>(null);
  const [showDeleteRange, setShowDeleteRange] = useState(false);
  const [deleteRangeFrom, setDeleteRangeFrom] = useState("");
  const [deleteRangeTo, setDeleteRangeTo] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null | "uncat">(null);

  // 운동복 관리 state
  const [showUniformForm, setShowUniformForm] = useState(false);
  const [editingUniform, setEditingUniform] = useState<any | null>(null);
  const [uniformSearch, setUniformSearch] = useState("");
  const [uniformActiveOnly, setUniformActiveOnly] = useState(true);
  const [uniformForm, setUniformForm] = useState({
    memberId: "", memberName: "", memberPhone: "",
    paymentDate: new Date().toISOString().substring(0, 10),
    startDate: new Date().toISOString().substring(0, 10), endDate: "", memo: "",
    memberType: "existing", rentalType: "paid", isPaid: "1", paymentAmount: "",
  });
  const [uniformMemberSearch, setUniformMemberSearch] = useState("");

  // 간편 등록 state
  type QuickModal = null | "locker" | "uniform" | "daypass";
  const [quickModal, setQuickModal] = useState<QuickModal>(null);
  const todayStr = new Date().toISOString().substring(0, 10);
  const [lockerForm, setLockerForm] = useState({
    memberId: "", memberName: "", memberPhone: "",
    memberSearch: "", lockerId: "",
    months: 1, customAmount: false, amount: 5000,
    paymentMethod: "카드", startDate: todayStr,
  });
  const [uniformQForm, setUniformQForm] = useState({
    memberId: "", memberName: "", memberPhone: "",
    memberSearch: "",
    months: 1, customAmount: false, amount: 10000,
    paymentMethod: "카드", startDate: todayStr, paymentDate: todayStr,
  });
  const [dayPassForm, setDayPassForm] = useState({
    name: "", phone: "", amount: "", paymentMethod: "카드",
  });

  const utils = trpc.useUtils();

  const branchesQuery = trpc.access.getBranches.useQuery();
  const lockersQuery = trpc.access.getLockers.useQuery();
  const membersQuery = trpc.access.getMembersForLocker.useQuery();
  const categoriesQuery = trpc.access.getLockerCategories.useQuery();
  const uniformsQuery = trpc.access.getUniforms.useQuery({
    branchId: selectedBranch ?? undefined,
  });
  const activeMembershipsQuery = trpc.access.getActiveMemberships.useQuery(undefined, { enabled: tab === "services" });
  const activePtQuery = trpc.access.getActivePtPackages.useQuery(undefined, { enabled: tab === "services" });
  const serviceLockerQuery = trpc.access.getServiceLockers.useQuery(undefined, { enabled: tab === "services" });
  const serviceHealthQuery = trpc.access.getServiceHealthMemberships.useQuery(undefined, { enabled: tab === "services" });
  const serviceItemsQuery = trpc.gym.revenue.listServiceItems.useQuery(undefined, { enabled: tab === "services" || tab === "uniforms" });

  const branches = (branchesQuery.data ?? []) as Branch[];
  const categories = (categoriesQuery.data ?? []) as LockerCategory[];
  const allLockers = (lockersQuery.data ?? []) as Locker[];
  const members = (membersQuery.data ?? []) as Member[];

  const lockers = selectedBranch
    ? allLockers.filter((l) => l.branchId === selectedBranch)
    : allLockers;

  const occupiedCount = lockers.filter((l) => l.isOccupied).length;

  // 락커 mutations
  const releaseLocker = trpc.access.releaseLocker.useMutation({
    onSuccess: () => { utils.access.getLockers.invalidate(); toast.success("락커 반납 완료"); },
  });
  const deleteLocker = trpc.access.deleteLocker.useMutation({
    onSuccess: () => { utils.access.getLockers.invalidate(); toast.success("락커 삭제 완료"); },
  });
  const deleteLockerRange = trpc.access.deleteLockerRange.useMutation({
    onSuccess: (data) => {
      utils.access.getLockers.invalidate();
      setShowDeleteRange(false);
      setDeleteRangeFrom(""); setDeleteRangeTo("");
      toast.success(`${data.deleted}개 락커 삭제 완료`);
    },
    onError: () => toast.error("삭제 실패"),
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

  // 운동복 mutations
  const createUniform = trpc.access.createUniform.useMutation({
    onSuccess: () => { utils.access.getUniforms.invalidate(); setShowUniformForm(false); resetUniformForm(); toast.success("운동복 추가 완료"); },
    onError: (e) => toast.error(e.message),
  });
  const updateUniform = trpc.access.updateUniform.useMutation({
    onSuccess: () => { utils.access.getUniforms.invalidate(); setEditingUniform(null); resetUniformForm(); toast.success("수정 완료"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteUniform = trpc.access.deleteUniform.useMutation({
    onSuccess: () => { utils.access.getUniforms.invalidate(); toast.success("삭제 완료"); },
  });
  const returnUniform = trpc.access.updateUniform.useMutation({
    onSuccess: () => { utils.access.getUniforms.invalidate(); toast.success("반납 처리 완료"); },
  });

  const purchaseLockerMutation = trpc.access.purchaseLocker.useMutation({
    onSuccess: () => {
      utils.access.getLockers.invalidate();
      setQuickModal(null);
      setLockerForm({ memberId: "", memberName: "", memberPhone: "", memberSearch: "", lockerId: "", months: 1, customAmount: false, amount: 5000, paymentMethod: "카드", startDate: new Date().toISOString().substring(0, 10) });
      toast.success("락커 구매 완료");
    },
    onError: (e) => toast.error(e.message),
  });
  const createUniformQuickMutation = trpc.access.createUniform.useMutation({
    onSuccess: () => {
      utils.access.getUniforms.invalidate();
      setQuickModal(null);
      setUniformQForm({ memberId: "", memberName: "", memberPhone: "", memberSearch: "", months: 1, customAmount: false, amount: 10000, paymentMethod: "카드", startDate: new Date().toISOString().substring(0, 10), paymentDate: new Date().toISOString().substring(0, 10) });
      toast.success("운동복 대여 완료");
    },
    onError: (e) => toast.error(e.message),
  });
  const createDayPassMutation = trpc.gym.revenue.create.useMutation({
    onSuccess: () => {
      setQuickModal(null);
      setDayPassForm({ name: "", phone: "", amount: "", paymentMethod: "카드" });
      toast.success("1일권 등록 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  function addMonths(dateStr: string, months: number): string {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().substring(0, 10);
  }

  function submitLockerPurchase() {
    if (!lockerForm.memberId) { toast.error("회원을 선택하세요"); return; }
    if (!lockerForm.lockerId) { toast.error("락커를 선택하세요"); return; }
    if (!lockerForm.amount) { toast.error("금액을 입력하세요"); return; }
    purchaseLockerMutation.mutate({
      lockerId: parseInt(lockerForm.lockerId),
      memberId: parseInt(lockerForm.memberId),
      memberName: lockerForm.memberName,
      memberPhone: lockerForm.memberPhone || undefined,
      months: lockerForm.months,
      amount: lockerForm.amount,
      paymentMethod: lockerForm.paymentMethod || undefined,
      startDate: lockerForm.startDate,
      endDate: addMonths(lockerForm.startDate, lockerForm.months),
    });
  }

  function submitUniformQuick() {
    if (!uniformQForm.memberId) { toast.error("회원을 선택하세요"); return; }
    if (!uniformQForm.amount) { toast.error("금액을 입력하세요"); return; }
    createUniformQuickMutation.mutate({
      memberId: parseInt(uniformQForm.memberId),
      memberName: uniformQForm.memberName,
      memberPhone: uniformQForm.memberPhone || undefined,
      memberType: "existing",
      rentalType: "paid",
      isPaid: 1,
      paymentAmount: uniformQForm.amount,
      paymentMethod: uniformQForm.paymentMethod || undefined,
      paymentDate: uniformQForm.paymentDate || undefined,
      startDate: uniformQForm.startDate,
      endDate: addMonths(uniformQForm.startDate, uniformQForm.months),
      branchId: selectedBranch ?? undefined,
    });
  }

  function submitDayPass() {
    if (!dayPassForm.name.trim()) { toast.error("이름을 입력하세요"); return; }
    if (!dayPassForm.amount) { toast.error("금액을 입력하세요"); return; }
    createDayPassMutation.mutate({
      customerName: dayPassForm.name.trim(),
      phone: dayPassForm.phone || undefined,
      programDetail: "1일권",
      type: "기타",
      subType: "신규",
      amount: parseInt(dayPassForm.amount),
      discountAmount: 0,
      paidAmount: parseInt(dayPassForm.amount),
      unpaidAmount: 0,
      paymentMethod: dayPassForm.paymentMethod || undefined,
      paymentDate: new Date().toISOString().substring(0, 10),
    });
  }

  // 운동복 헬퍼
  function resetUniformForm() {
    setUniformForm({ memberId: "", memberName: "", memberPhone: "", paymentDate: new Date().toISOString().substring(0, 10), startDate: new Date().toISOString().substring(0, 10), endDate: "", memo: "", memberType: "existing", rentalType: "paid", isPaid: "1", paymentAmount: "" });
    setUniformMemberSearch("");
  }
  function openEditUniform(u: any) {
    setEditingUniform(u);
    setUniformForm({
      memberId: String(u.memberId ?? ""), memberName: u.memberName ?? "", memberPhone: u.memberPhone ?? "",
      paymentDate: u.paymentDate ?? new Date().toISOString().substring(0, 10),
      startDate: u.startDate ?? "", endDate: u.endDate ?? "", memo: u.memo ?? "",
      memberType: u.memberType ?? "existing", rentalType: u.rentalType ?? "paid",
      isPaid: String(u.isPaid ?? 1), paymentAmount: String(u.paymentAmount ?? ""),
    });
    setUniformMemberSearch(u.memberName ?? "");
    setShowUniformForm(true);
  }
  function saveUniform() {
    if (uniformForm.memberType === "existing" && !uniformForm.memberId && !uniformForm.memberName) {
      toast.error("회원을 선택하세요"); return;
    }
    if (uniformForm.memberType === "new" && !uniformForm.memberName) {
      toast.error("이름을 입력하세요"); return;
    }
    const payload = {
      memberId: uniformForm.memberId ? parseInt(uniformForm.memberId) : undefined,
      memberName: uniformForm.memberName || undefined,
      memberPhone: uniformForm.memberPhone || undefined,
      paymentDate: uniformForm.paymentDate || undefined,
      startDate: uniformForm.startDate || undefined,
      endDate: uniformForm.endDate || undefined,
      memo: uniformForm.memo || undefined,
      memberType: uniformForm.memberType,
      rentalType: uniformForm.rentalType,
      isPaid: uniformForm.rentalType === "service" ? 1 : parseInt(uniformForm.isPaid) || 0,
      paymentAmount: uniformForm.rentalType === "paid" && uniformForm.paymentAmount ? parseInt(uniformForm.paymentAmount) : 0,
    };
    if (editingUniform) {
      updateUniform.mutate({ id: editingUniform.id, ...payload });
    } else {
      createUniform.mutate({ branchId: selectedBranch ?? undefined, ...payload });
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-foreground">등록 관리</h1>

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

      {/* 탭 헤더 */}
      <div className="flex gap-0 rounded-lg overflow-hidden border border-border overflow-x-auto">
        {(isTrainer
          ? (["members", "lockers", "uniforms"] as const)
          : (["members", "lockers", "uniforms", "services"] as const)
        ).map((t, i, arr) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 min-w-max py-2.5 px-2 text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-accent"
            } ${i < arr.length - 1 ? "border-r border-border" : ""}`}
          >
            {t === "members" ? (
              <span className="flex items-center justify-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> 회원 등록
              </span>
            ) : t === "lockers" ? (
              <span className="flex items-center justify-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> 락커 관리 ({occupiedCount}/{lockers.length})
              </span>
            ) : t === "uniforms" ? (
              <span className="flex items-center justify-center gap-1.5">
                <Shirt className="h-3.5 w-3.5" /> 운동복 관리
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <Gift className="h-3.5 w-3.5" /> 서비스 관리
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 1: 회원 등록 */}
      {tab === "members" && (
        <div className="space-y-6">
          {/* 회원 등록 */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">회원 등록</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setLocation("/members/new")}
                className="flex flex-col items-center justify-center gap-3 p-8 bg-card border border-border rounded-2xl hover:bg-accent hover:border-primary/50 transition-all group"
              >
                <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <UserPlus className="h-8 w-8 text-primary" />
                </div>
                <span className="text-base font-semibold text-foreground">신규 회원 등록</span>
                <span className="text-xs text-muted-foreground text-center">새로운 회원을 등록합니다</span>
              </button>
              <button
                onClick={() => setLocation("/members/re-register")}
                className="flex flex-col items-center justify-center gap-3 p-8 bg-card border border-border rounded-2xl hover:bg-accent hover:border-primary/50 transition-all group"
              >
                <div className="p-4 rounded-full bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                  <RefreshCw className="h-8 w-8 text-green-500" />
                </div>
                <span className="text-base font-semibold text-foreground">재등록</span>
                <span className="text-xs text-muted-foreground text-center">기존 회원을 재등록합니다</span>
              </button>
            </div>
          </div>

          {/* 간편 등록 */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">간편 등록</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => { setQuickModal("locker"); setLockerForm(f => ({ ...f, startDate: new Date().toISOString().substring(0, 10) })); }}
                className="flex flex-col items-center justify-center gap-2 p-5 bg-card border border-border rounded-2xl hover:bg-accent hover:border-amber-500/50 transition-all group"
              >
                <div className="p-3 rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                  <Key className="h-6 w-6 text-amber-500" />
                </div>
                <span className="text-sm font-semibold text-foreground">락커 구매</span>
                <span className="text-xs text-muted-foreground text-center">5,000원/월</span>
              </button>
              <button
                onClick={() => { setQuickModal("uniform"); setUniformQForm(f => ({ ...f, startDate: new Date().toISOString().substring(0, 10) })); }}
                className="flex flex-col items-center justify-center gap-2 p-5 bg-card border border-border rounded-2xl hover:bg-accent hover:border-purple-500/50 transition-all group"
              >
                <div className="p-3 rounded-full bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                  <Shirt className="h-6 w-6 text-purple-500" />
                </div>
                <span className="text-sm font-semibold text-foreground">운동복 대여</span>
                <span className="text-xs text-muted-foreground text-center">10,000원/월</span>
              </button>
              <button
                onClick={() => setQuickModal("daypass")}
                className="flex flex-col items-center justify-center gap-2 p-5 bg-card border border-border rounded-2xl hover:bg-accent hover:border-blue-500/50 transition-all group"
              >
                <div className="p-3 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <CalendarDays className="h-6 w-6 text-blue-500" />
                </div>
                <span className="text-sm font-semibold text-foreground">1일권 구매</span>
                <span className="text-xs text-muted-foreground text-center">직접 입력</span>
              </button>
            </div>
          </div>

          {/* 락커 구매 모달 */}
          {quickModal === "locker" && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4" onClick={() => setQuickModal(null)}>
              <div className="bg-card border border-border rounded-2xl w-full max-w-md space-y-4 p-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2"><Key className="h-4 w-4 text-amber-500" />락커 구매</h3>
                  <button onClick={() => setQuickModal(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>

                {/* 회원 검색 */}
                <div>
                  <label className="text-xs text-muted-foreground">회원 검색 *</label>
                  <input
                    value={lockerForm.memberSearch}
                    onChange={e => setLockerForm(f => ({ ...f, memberSearch: e.target.value, memberId: "", memberName: "", memberPhone: "" }))}
                    placeholder="이름 또는 전화번호"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                  {lockerForm.memberSearch.length >= 1 && !lockerForm.memberId && (() => {
                    const q = lockerForm.memberSearch.toLowerCase();
                    const filtered = members.filter(m => m.name.toLowerCase().includes(q) || (m.phone ?? "").includes(q)).slice(0, 6);
                    return filtered.length > 0 ? (
                      <div className="mt-1 border border-border rounded-lg overflow-hidden bg-background">
                        {filtered.map(m => (
                          <button key={m.id} type="button"
                            onClick={() => setLockerForm(f => ({ ...f, memberId: String(m.id), memberName: m.name, memberPhone: m.phone ?? "", memberSearch: m.name }))}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b border-border last:border-0">
                            {m.name} {m.phone && <span className="text-xs text-muted-foreground">{m.phone}</span>}
                          </button>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground mt-1 px-1">검색 결과 없음</p>;
                  })()}
                  {lockerForm.memberName && <p className="text-xs text-primary mt-1">선택됨: {lockerForm.memberName}</p>}
                </div>

                {/* 락커 선택 */}
                <div>
                  <label className="text-xs text-muted-foreground">락커 선택 *</label>
                  <select
                    value={lockerForm.lockerId}
                    onChange={e => setLockerForm(f => ({ ...f, lockerId: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">-- 사용 가능한 락커 선택 --</option>
                    {(() => {
                      const available = lockers.filter(l => !l.isOccupied && (!selectedBranch || l.branchId === selectedBranch));
                      const grouped = available.reduce((acc, l) => {
                        const cat = categories.find(c => c.id === l.categoryId);
                        const key = cat ? `${cat.name}` : "미분류";
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(l);
                        return acc;
                      }, {} as Record<string, Locker[]>);
                      return Object.entries(grouped).map(([catName, items]) => (
                        <optgroup key={catName} label={`── ${catName} (${items.length}개)`}>
                          {items.map(l => <option key={l.id} value={l.id}>락커 {l.lockerNumber}</option>)}
                        </optgroup>
                      ));
                    })()}
                  </select>
                </div>

                {/* 사용 기간 */}
                <div>
                  <label className="text-xs text-muted-foreground">사용 기간</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {[1, 3, 6, 12].map(m => (
                      <button key={m} type="button"
                        onClick={() => setLockerForm(f => ({ ...f, months: m, amount: f.customAmount ? f.amount : m * 5000 }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${lockerForm.months === m && !lockerForm.customAmount ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground"}`}>
                        {m}개월
                      </button>
                    ))}
                  </div>
                </div>

                {/* 금액 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">결제 금액</label>
                    <button type="button" onClick={() => setLockerForm(f => ({ ...f, customAmount: !f.customAmount, amount: !f.customAmount ? f.amount : f.months * 5000 }))}
                      className="text-xs text-primary underline">
                      {lockerForm.customAmount ? "자동 계산" : "직접 입력"}
                    </button>
                  </div>
                  {lockerForm.customAmount ? (
                    <input type="number" value={lockerForm.amount} onChange={e => setLockerForm(f => ({ ...f, amount: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="0" />
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-sm font-semibold text-amber-400">
                      {(lockerForm.months * 5000).toLocaleString()}원 ({lockerForm.months}개월 × 5,000원)
                    </div>
                  )}
                </div>

                {/* 결제 방법 */}
                <div>
                  <label className="text-xs text-muted-foreground">결제 방법</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {["카드", "현금영수증", "이체", "지역화폐"].map(m => (
                      <button key={m} type="button"
                        onClick={() => setLockerForm(f => ({ ...f, paymentMethod: m }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${lockerForm.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 시작일 */}
                <div>
                  <label className="text-xs text-muted-foreground">시작일</label>
                  <input type="date" value={lockerForm.startDate} onChange={e => setLockerForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setQuickModal(null)} className="flex-1 border border-border text-muted-foreground rounded-xl py-2.5 text-sm">취소</button>
                  <button onClick={submitLockerPurchase} disabled={purchaseLockerMutation.isPending}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                    {purchaseLockerMutation.isPending ? "처리 중..." : "락커 구매"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 운동복 대여 모달 */}
          {quickModal === "uniform" && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4" onClick={() => setQuickModal(null)}>
              <div className="bg-card border border-border rounded-2xl w-full max-w-md space-y-4 p-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2"><Shirt className="h-4 w-4 text-purple-500" />운동복 대여</h3>
                  <button onClick={() => setQuickModal(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>

                {/* 회원 검색 */}
                <div>
                  <label className="text-xs text-muted-foreground">회원 검색 *</label>
                  <input
                    value={uniformQForm.memberSearch}
                    onChange={e => setUniformQForm(f => ({ ...f, memberSearch: e.target.value, memberId: "", memberName: "", memberPhone: "" }))}
                    placeholder="이름 또는 전화번호"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                  {uniformQForm.memberSearch.length >= 1 && !uniformQForm.memberId && (() => {
                    const q = uniformQForm.memberSearch.toLowerCase();
                    const filtered = members.filter(m => m.name.toLowerCase().includes(q) || (m.phone ?? "").includes(q)).slice(0, 6);
                    return filtered.length > 0 ? (
                      <div className="mt-1 border border-border rounded-lg overflow-hidden bg-background">
                        {filtered.map(m => (
                          <button key={m.id} type="button"
                            onClick={() => setUniformQForm(f => ({ ...f, memberId: String(m.id), memberName: m.name, memberPhone: m.phone ?? "", memberSearch: m.name }))}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b border-border last:border-0">
                            {m.name} {m.phone && <span className="text-xs text-muted-foreground">{m.phone}</span>}
                          </button>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground mt-1 px-1">검색 결과 없음</p>;
                  })()}
                  {uniformQForm.memberName && <p className="text-xs text-primary mt-1">선택됨: {uniformQForm.memberName}</p>}
                </div>

                {/* 사용 기간 */}
                <div>
                  <label className="text-xs text-muted-foreground">사용 기간</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {[1, 3, 6, 12].map(m => (
                      <button key={m} type="button"
                        onClick={() => setUniformQForm(f => ({ ...f, months: m, amount: f.customAmount ? f.amount : m * 10000 }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${uniformQForm.months === m && !uniformQForm.customAmount ? "bg-purple-500 text-white border-purple-500" : "border-border text-muted-foreground"}`}>
                        {m}개월
                      </button>
                    ))}
                  </div>
                </div>

                {/* 금액 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">결제 금액</label>
                    <button type="button" onClick={() => setUniformQForm(f => ({ ...f, customAmount: !f.customAmount, amount: !f.customAmount ? f.amount : f.months * 10000 }))}
                      className="text-xs text-primary underline">
                      {uniformQForm.customAmount ? "자동 계산" : "직접 입력"}
                    </button>
                  </div>
                  {uniformQForm.customAmount ? (
                    <input type="number" value={uniformQForm.amount} onChange={e => setUniformQForm(f => ({ ...f, amount: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="0" />
                  ) : (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 text-sm font-semibold text-purple-400">
                      {(uniformQForm.months * 10000).toLocaleString()}원 ({uniformQForm.months}개월 × 10,000원)
                    </div>
                  )}
                </div>

                {/* 결제 방법 */}
                <div>
                  <label className="text-xs text-muted-foreground">결제 방법</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {["카드", "현금영수증", "이체", "지역화폐"].map(m => (
                      <button key={m} type="button"
                        onClick={() => setUniformQForm(f => ({ ...f, paymentMethod: m }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${uniformQForm.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 시작일 + 결제 일자 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">시작일</label>
                    <input type="date" value={uniformQForm.startDate} onChange={e => setUniformQForm(f => ({ ...f, startDate: e.target.value }))}
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">결제 일자</label>
                    <input type="date" value={uniformQForm.paymentDate} onChange={e => setUniformQForm(f => ({ ...f, paymentDate: e.target.value }))}
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setQuickModal(null)} className="flex-1 border border-border text-muted-foreground rounded-xl py-2.5 text-sm">취소</button>
                  <button onClick={submitUniformQuick} disabled={createUniformQuickMutation.isPending}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                    {createUniformQuickMutation.isPending ? "처리 중..." : "운동복 대여"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 1일권 모달 */}
          {quickModal === "daypass" && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4" onClick={() => setQuickModal(null)}>
              <div className="bg-card border border-border rounded-2xl w-full max-w-md space-y-4 p-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-500" />1일권 구매</h3>
                  <button onClick={() => setQuickModal(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">이름 *</label>
                  <input value={dayPassForm.name} onChange={e => setDayPassForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="홍길동" className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">연락처</label>
                  <input value={dayPassForm.phone} onChange={e => setDayPassForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="010-0000-0000" className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">금액 *</label>
                  <input type="number" value={dayPassForm.amount} onChange={e => setDayPassForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0" className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">결제 방법</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {["카드", "현금영수증", "이체", "지역화폐"].map(m => (
                      <button key={m} type="button"
                        onClick={() => setDayPassForm(f => ({ ...f, paymentMethod: m }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${dayPassForm.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setQuickModal(null)} className="flex-1 border border-border text-muted-foreground rounded-xl py-2.5 text-sm">취소</button>
                  <button onClick={submitDayPass} disabled={createDayPassMutation.isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                    {createDayPassMutation.isPending ? "처리 중..." : "1일권 등록"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 탭 2: 락커 관리 */}
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
                    onClick={() => setSelectedCategoryId(prev => prev === cat.id ? null : cat.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all"
                    style={selectedCategoryId === cat.id
                      ? { background: cat.color + "55", color: cat.color, border: `2px solid ${cat.color}`, fontWeight: 700 }
                      : { background: cat.color + "22", color: cat.color, border: `1px solid ${cat.color}44` }}
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteRange((v) => !v)}
                className="flex items-center gap-1.5 text-sm border border-red-400 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" /> 범위 삭제
              </button>
              <button
                onClick={() => setShowAddLocker(true)}
                className="flex items-center gap-1.5 text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" /> 락커 추가
              </button>
            </div>
          </div>

          {/* 범위 삭제 패널 */}
          {showDeleteRange && (
            <div className="border border-red-400/40 rounded-xl p-4 bg-red-500/5 flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">시작 번호</label>
                <input type="number" value={deleteRangeFrom} onChange={(e) => setDeleteRangeFrom(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-24" placeholder="예: 100" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">끝 번호</label>
                <input type="number" value={deleteRangeTo} onChange={(e) => setDeleteRangeTo(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-24" placeholder="예: 210" />
              </div>
              <button
                disabled={deleteLockerRange.isPending}
                onClick={() => {
                  const f = parseInt(deleteRangeFrom), t = parseInt(deleteRangeTo);
                  if (isNaN(f) || isNaN(t) || f > t) { toast.error("올바른 범위를 입력하세요"); return; }
                  if (!confirm(`${f}~${t}번 빈 락커를 모두 삭제합니까? (배정된 락커는 제외됩니다)`)) return;
                  deleteLockerRange.mutate({ from: f, to: t });
                }}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {deleteLockerRange.isPending ? "삭제 중..." : "삭제"}
              </button>
              <p className="text-xs text-muted-foreground w-full">배정된(사용 중) 락커는 삭제되지 않습니다.</p>
            </div>
          )}

          {/* 카테고리별 그룹 표시 */}
          {(() => {
            const displayLockers = lockers;
            const allGrouped: { label: string; color?: string; catId: number | null; items: typeof displayLockers }[] = [
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
            const grouped = selectedCategoryId !== null
              ? allGrouped.filter((g) => selectedCategoryId === "uncat" ? g.catId === null : g.catId === selectedCategoryId)
              : allGrouped;

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

      {/* 탭 3: 운동복 관리 */}
      {tab === "uniforms" && (() => {
        const allUniforms = uniformsQuery.data ?? [];
        const serviceItemsList = (serviceItemsQuery.data ?? []) as any[];

        // serviceItems에서 운동복 항목 파싱
        const uniformFromServiceItems = serviceItemsList.flatMap((entry: any) =>
          (entry.serviceItems ?? "").split(",").filter((s: string) => s.startsWith("운동복"))
            .map(() => ({
              id: `si-${entry.id}`,
              memberName: entry.customerName ?? entry.memberName ?? "—",
              memberPhone: entry.phone ?? "",
              rentalType: "service",
              isActive: 1,
              startDate: entry.paymentDate ?? null,
              endDate: null,
              memo: "서비스 내역 기반",
              size: null, quantity: 1, memberType: null, isPaid: 1,
            }))
        );

        const allCombined = [...uniformFromServiceItems, ...allUniforms];
        const filteredUniforms = allCombined.filter((u: any) => {
          const q = uniformSearch.toLowerCase();
          const matchSearch = !q || (u.memberName ?? "").toLowerCase().includes(q) || (u.memberPhone ?? "").toLowerCase().includes(q);
          const matchActive = !uniformActiveOnly || u.isActive === 1;
          return matchSearch && matchActive;
        });
        const activeCount = allCombined.filter((u: any) => u.isActive === 1).length;

        return (
          <div className="space-y-3">
            {/* 요약 + 버튼 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                사용 중 <span className="text-foreground font-semibold">{activeCount}</span>개 / 전체 {allCombined.length}개
              </span>
              <button
                onClick={() => { setEditingUniform(null); resetUniformForm(); setShowUniformForm(true); }}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> 운동복 추가
              </button>
            </div>

            {/* 검색 + 필터 */}
            <div className="flex gap-2 items-center">
              <input
                value={uniformSearch}
                onChange={e => setUniformSearch(e.target.value)}
                placeholder="이름 또는 전화번호 검색"
                className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
              />
              <button
                onClick={() => setUniformActiveOnly(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${uniformActiveOnly ? "bg-primary/20 text-primary border-primary/30" : "border-border text-muted-foreground"}`}
              >
                사용 중만
              </button>
            </div>

            {/* 목록 */}
            {filteredUniforms.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">운동복 이용자가 없습니다</div>
            ) : (
              <div className="space-y-2">
                {filteredUniforms.map((u: any) => {
                  const isActive = u.isActive === 1;
                  const daysLeft = u.endDate ? Math.ceil((new Date(u.endDate).getTime() - Date.now()) / 86400000) : null;
                  const isExpired = daysLeft !== null && daysLeft < 0;
                  return (
                    <div key={u.id} className={`bg-card border rounded-xl p-3 ${isExpired ? "border-red-500/40" : isActive ? "border-border" : "border-border/40 opacity-60"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-foreground">{u.memberName || "—"}</span>
                            {u.size && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-medium">{u.size}</span>}
                            {u.quantity > 1 && <span className="text-xs text-muted-foreground">×{u.quantity}</span>}
                            {u.memberType === "new" && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">신규</span>}
                            {u.memberType === "existing" && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 font-medium">기존</span>}
                            {u.rentalType === "service" ? (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">서비스</span>
                            ) : u.isPaid === 1 ? (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">결제완료</span>
                            ) : (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">미결제</span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isActive ? (isExpired ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400") : "bg-muted text-muted-foreground"}`}>
                              {isActive ? (isExpired ? "기간 만료" : "착용 중") : "반납"}
                            </span>
                          </div>
                          {u.memberPhone && <div className="text-xs text-muted-foreground">{u.memberPhone}</div>}
                          <div className="text-xs text-muted-foreground">
                            {u.startDate && <span>{u.startDate}</span>}
                            {u.endDate && <span> ~ {u.endDate}</span>}
                            {daysLeft !== null && isActive && !isExpired && <span className="ml-1 text-amber-400">{daysLeft}일 남음</span>}
                            {isExpired && <span className="ml-1 text-red-400">{Math.abs(daysLeft!)}일 초과</span>}
                          </div>
                          {u.memo && <div className="text-xs text-muted-foreground mt-0.5">{u.memo}</div>}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {isActive && (
                            <button
                              onClick={() => { if (confirm("반납 처리하시겠습니까?")) returnUniform.mutate({ id: u.id, isActive: 0 }); }}
                              className="text-xs px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-medium"
                            >
                              반납
                            </button>
                          )}
                          <button
                            onClick={() => openEditUniform(u)}
                            className="text-xs px-2 py-1 rounded-lg bg-accent text-foreground hover:bg-accent/80"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => { if (confirm("삭제하시겠습니까?")) deleteUniform.mutate({ id: u.id }); }}
                            className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 추가/수정 폼 모달 */}
            {showUniformForm && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4">
                <div className="bg-card border border-border rounded-2xl w-full max-w-md space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{editingUniform ? "운동복 수정" : "운동복 추가"}</h3>
                    <button onClick={() => { setShowUniformForm(false); setEditingUniform(null); }} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                  {/* 회원 구분 */}
                  <div>
                    <label className="text-xs text-muted-foreground">회원 구분</label>
                    <div className="flex gap-2 mt-1">
                      {[{ v: "existing", label: "기존회원" }, { v: "new", label: "신규회원" }].map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => { setUniformForm(f => ({ ...f, memberType: opt.v, memberId: "", memberName: "", memberPhone: "" })); setUniformMemberSearch(""); }}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${uniformForm.memberType === opt.v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 기존회원: 검색 선택 */}
                  {uniformForm.memberType === "existing" ? (
                    <div>
                      <label className="text-xs text-muted-foreground">회원 검색</label>
                      <input
                        value={uniformMemberSearch}
                        onChange={e => { setUniformMemberSearch(e.target.value); setUniformForm(f => ({ ...f, memberId: "", memberName: "", memberPhone: "" })); }}
                        placeholder="이름 또는 전화번호"
                        className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                      />
                      {uniformMemberSearch.length >= 1 && !uniformForm.memberId && (() => {
                        const q = uniformMemberSearch.toLowerCase();
                        const filtered = members.filter(m => m.name.toLowerCase().includes(q) || (m.phone ?? "").includes(q)).slice(0, 6);
                        return filtered.length > 0 ? (
                          <div className="mt-1 border border-border rounded-lg overflow-hidden bg-background">
                            {filtered.map(m => (
                              <button key={m.id} type="button"
                                onClick={() => { setUniformForm(f => ({ ...f, memberId: String(m.id), memberName: m.name, memberPhone: m.phone ?? "" })); setUniformMemberSearch(m.name); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b border-border last:border-0">
                                {m.name} {m.phone ? <span className="text-muted-foreground text-xs">{m.phone}</span> : null}
                              </button>
                            ))}
                          </div>
                        ) : <p className="text-xs text-muted-foreground mt-1 px-1">검색 결과 없음</p>;
                      })()}
                      {uniformForm.memberName && (
                        <p className="text-xs text-primary mt-1 px-1">선택됨: {uniformForm.memberName} {uniformForm.memberPhone}</p>
                      )}
                    </div>
                  ) : (
                    /* 신규회원: 직접 입력 */
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">이름</label>
                        <input value={uniformForm.memberName} onChange={e => setUniformForm(f => ({ ...f, memberName: e.target.value }))}
                          placeholder="홍길동" className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">연락처</label>
                        <input value={uniformForm.memberPhone} onChange={e => setUniformForm(f => ({ ...f, memberPhone: e.target.value }))}
                          placeholder="010-0000-0000" className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                      </div>
                    </div>
                  )}

                  {/* 대여 유형 */}
                  <div>
                    <label className="text-xs text-muted-foreground">대여 유형</label>
                    <div className="flex gap-2 mt-1">
                      {[{ v: "paid", label: "결제 대여" }, { v: "service", label: "서비스 제공" }].map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => setUniformForm(f => ({ ...f, rentalType: opt.v }))}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${uniformForm.rentalType === opt.v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 결제 대여일 때: 결제여부 + 금액 */}
                  {uniformForm.rentalType === "paid" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">결제 여부</label>
                        <div className="flex gap-1 mt-1">
                          {[{ v: "1", label: "완료" }, { v: "0", label: "미결제" }].map(opt => (
                            <button key={opt.v} type="button"
                              onClick={() => setUniformForm(f => ({ ...f, isPaid: opt.v }))}
                              className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${uniformForm.isPaid === opt.v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">결제 금액</label>
                        <input type="number" min="0" value={uniformForm.paymentAmount} onChange={e => setUniformForm(f => ({ ...f, paymentAmount: e.target.value }))}
                          placeholder="0" className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">결제일</label>
                      <input type="date" value={uniformForm.paymentDate} onChange={e => setUniformForm(f => ({ ...f, paymentDate: e.target.value }))}
                        className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">시작일</label>
                      <input type="date" value={uniformForm.startDate} onChange={e => setUniformForm(f => ({ ...f, startDate: e.target.value }))}
                        className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">메모</label>
                    <input value={uniformForm.memo} onChange={e => setUniformForm(f => ({ ...f, memo: e.target.value }))}
                      placeholder="특이사항" className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <button
                    onClick={saveUniform}
                    disabled={createUniform.isPending || updateUniform.isPending}
                    className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold disabled:opacity-50"
                  >
                    {createUniform.isPending || updateUniform.isPending ? "저장 중..." : editingUniform ? "수정 완료" : "추가"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 탭 4: 서비스 관리 — 무료 서비스 이용자 전용 */}
      {tab === "services" && (() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const allUniforms = (uniformsQuery.data ?? []) as any[];
        const activePtPackages = (activePtQuery.data ?? []);
        const serviceLockers = (serviceLockerQuery.data ?? []) as any[];
        const serviceHealths = (serviceHealthQuery.data ?? []) as any[];
        const serviceItemsList = (serviceItemsQuery.data ?? []) as any[];

        const servicePt = activePtPackages.filter((p: any) => !p.paymentAmount || p.paymentAmount === 0);
        const serviceUniforms = allUniforms.filter((u: any) => u.isActive === 1 && u.rentalType === "service");

        function daysLeft(endDate: string | null) {
          if (!endDate) return null;
          const end = new Date(endDate); end.setHours(0, 0, 0, 0);
          return Math.ceil((end.getTime() - today.getTime()) / 86400000);
        }
        function durationLabel(start: string | null, end: string | null) {
          if (!start || !end) return "";
          const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
          if (days >= 28) return `${Math.round(days / 30)}개월`;
          return `${days}일`;
        }
        function DDay({ endDate }: { endDate: string | null }) {
          const d = daysLeft(endDate);
          if (d === null) return <span className="text-xs text-muted-foreground">무기한</span>;
          if (d < 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{Math.abs(d)}일 초과</span>;
          if (d === 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">오늘 만료</span>;
          if (d <= 7) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">D-{d}</span>;
          return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">D-{d}</span>;
        }

        // serviceItems(결제 기록) 파싱 → 카테고리별 분류
        // entry.serviceItems 예: "PT(10회),헬스(3개월),락커(45),운동복"
        type ParsedServiceItem = { entryId: number; name: string; phone: string; detail: string; paymentDate: string; category: string };
        const parsedItems: ParsedServiceItem[] = serviceItemsList.flatMap((entry: any) => {
          const name = entry.customerName ?? entry.memberName ?? "—";
          const phone = entry.phone ?? "";
          return (entry.serviceItems ?? "").split(",").filter(Boolean).map((raw: string) => {
            const cat = raw.startsWith("PT") ? "PT"
              : raw.startsWith("헬스") ? "헬스"
              : raw.startsWith("락커") ? "락커"
              : raw.startsWith("운동복") ? "운동복" : "기타";
            return { entryId: entry.id, name, phone, detail: raw, paymentDate: entry.paymentDate ?? "", category: cat };
          });
        });

        // 검색 필터
        const sq = serviceSearch.trim().toLowerCase();
        const match = (name: string, phone: string) =>
          !sq || name.toLowerCase().includes(sq) || (phone ?? "").replace(/\D/g, "").includes(sq.replace(/\D/g, ""));

        const filteredHealthItems = parsedItems.filter(i => i.category === "헬스" && match(i.name, i.phone));
        const filteredLockerItems = parsedItems.filter(i => i.category === "락커" && match(i.name, i.phone));
        const filteredUniformItems = parsedItems.filter(i => i.category === "운동복" && match(i.name, i.phone));
        const filteredPtItems = parsedItems.filter(i => i.category === "PT" && match(i.name, i.phone));

        const filteredServiceHealths = serviceHealths.filter((h: any) => match(h.memberName ?? "", h.memberPhone ?? ""));
        const filteredServicePt = servicePt.filter((p: any) => match(p.memberName ?? "", p.memberPhone ?? ""));
        const filteredServiceLockers = serviceLockers.filter((l: any) => match(l.memberName ?? "", l.memberPhone ?? ""));
        const filteredServiceUniforms = serviceUniforms.filter((u: any) => match(u.memberName ?? "", u.memberPhone ?? ""));

        const totalHealth = filteredHealthItems.length + filteredServiceHealths.length;
        const totalLocker = filteredLockerItems.length + filteredServiceLockers.length;
        const totalUniform = filteredUniformItems.length + filteredServiceUniforms.length;
        const totalPt = filteredPtItems.length + filteredServicePt.length;

        return (
          <div className="space-y-5">
            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="이름, 전화번호 검색..."
                value={serviceSearch}
                onChange={e => setServiceSearch(e.target.value)}
                className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* 서비스 헬스 */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <span className="text-emerald-400">◆</span> 서비스 헬스
                <span className="text-xs text-muted-foreground font-normal">({totalHealth}건)</span>
              </h3>
              {totalHealth === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">해당 서비스 이용자가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {filteredHealthItems.map((item, idx) => (
                    <div key={`hi-${item.entryId}-${idx}`} className="bg-card border border-border rounded-xl px-3 py-2.5 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.phone || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">🎁 {item.detail}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.paymentDate}</p>
                      </div>
                    </div>
                  ))}
                  {filteredServiceHealths.map((h: any) => (
                    <button key={`sh-${h.id}`} type="button"
                      onClick={() => setServiceModal({ memberId: h.memberId, memberName: h.memberName ?? "—", memberPhone: h.memberPhone, serviceType: "서비스 헬스", details: `${h.startDate ?? "-"} ~ ${h.endDate} · ${h.serviceHealthDuration}개월` })}
                      className="w-full flex items-start justify-between bg-card border border-border rounded-xl px-3 py-2.5 gap-2 hover:border-emerald-500/40 hover:bg-accent/30 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{h.memberName ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.startDate ?? "-"} ~ {h.endDate} · {h.serviceHealthDuration}개월
                        </p>
                      </div>
                      <DDay endDate={h.endDate} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 서비스 락커 */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Key className="h-4 w-4 text-amber-400" /> 서비스 락커
                <span className="text-xs text-muted-foreground font-normal">({totalLocker}건)</span>
              </h3>
              {totalLocker === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">해당 서비스 이용자가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {filteredLockerItems.map((item, idx) => (
                    <div key={`li-${item.entryId}-${idx}`} className="bg-card border border-border rounded-xl px-3 py-2.5 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.phone || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">🎁 {item.detail}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.paymentDate}</p>
                      </div>
                    </div>
                  ))}
                  {filteredServiceLockers.map((l: any) => (
                    <button key={`sl-${l.id}`} type="button"
                      onClick={() => setServiceModal({ memberId: l.memberId, memberName: l.memberName ?? "—", memberPhone: l.memberPhone, serviceType: "서비스 락커", details: `#${l.lockerNumber} · ${l.startDate ?? "-"}${l.endDate ? ` ~ ${l.endDate}` : ""}` })}
                      className="w-full flex items-start justify-between bg-card border border-border rounded-xl px-3 py-2.5 gap-2 hover:border-amber-500/40 hover:bg-accent/30 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{l.memberName ?? "—"}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">#{l.lockerNumber}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {l.startDate ?? "-"}{l.endDate && ` ~ ${l.endDate}`}
                          {l.startDate && l.endDate && (() => { const lbl = durationLabel(l.startDate, l.endDate); return lbl ? ` · ${lbl}` : ""; })()}
                        </p>
                      </div>
                      <DDay endDate={l.endDate} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 서비스 운동복 */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Shirt className="h-4 w-4 text-purple-400" /> 서비스 운동복
                <span className="text-xs text-muted-foreground font-normal">({totalUniform}건)</span>
              </h3>
              {totalUniform === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">해당 서비스 이용자가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {filteredUniformItems.map((item, idx) => (
                    <div key={`ui-${item.entryId}-${idx}`} className="bg-card border border-border rounded-xl px-3 py-2.5 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.phone || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">🎁 {item.detail}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.paymentDate}</p>
                      </div>
                    </div>
                  ))}
                  {filteredServiceUniforms.map((u: any) => (
                    <button key={`su-${u.id}`} type="button"
                      onClick={() => setServiceModal({ memberId: u.memberId ?? null, memberName: u.memberName ?? "—", memberPhone: u.memberPhone, serviceType: "서비스 운동복", details: `${u.startDate ?? "-"}${u.endDate ? ` ~ ${u.endDate}` : ""}` })}
                      className="w-full flex items-start justify-between bg-card border border-border rounded-xl px-3 py-2.5 gap-2 hover:border-purple-500/40 hover:bg-accent/30 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{u.memberName ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.startDate ?? "-"}{u.endDate && ` ~ ${u.endDate}`}
                          {u.startDate && u.endDate && (() => { const lbl = durationLabel(u.startDate, u.endDate); return lbl ? ` · ${lbl}` : ""; })()}
                        </p>
                      </div>
                      <DDay endDate={u.endDate} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 서비스 PT */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <span className="text-blue-400">◆</span> 서비스 PT
                <span className="text-xs text-muted-foreground font-normal">({totalPt}건)</span>
              </h3>
              {totalPt === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">해당 서비스 이용자가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {filteredPtItems.map((item, idx) => (
                    <div key={`pi-${item.entryId}-${idx}`} className="bg-card border border-border rounded-xl px-3 py-2.5 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.phone || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">🎁 {item.detail}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.paymentDate}</p>
                      </div>
                    </div>
                  ))}
                  {filteredServicePt.map((p: any) => {
                    const remaining = (p.totalSessions ?? 0) - (p.usedSessions ?? 0);
                    return (
                      <button key={`sp-${p.id}`} type="button"
                        onClick={() => setServiceModal({ memberId: p.memberId, memberName: p.memberName, memberPhone: p.memberPhone, serviceType: "서비스 PT", details: `${p.packageName ?? ""} · 잔여 ${remaining}회 / ${p.totalSessions}회${p.expiryDate ? ` · 만료 ${p.expiryDate}` : ""}` })}
                        className="w-full flex items-start justify-between bg-card border border-border rounded-xl px-3 py-2.5 gap-2 hover:border-blue-500/40 hover:bg-accent/30 transition-colors text-left">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{p.memberName}</p>
                            {p.packageName && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">{p.packageName}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            잔여 <span className="text-blue-400 font-semibold">{remaining}회</span> / {p.totalSessions}회
                            {p.expiryDate && ` · 만료 ${p.expiryDate}`}
                          </p>
                        </div>
                        <DDay endDate={p.expiryDate} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 서비스 회원 상세 모달 */}
      {serviceModal && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-end justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={() => setServiceModal(null)}>
          <div className="bg-card border border-border rounded-t-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(80svh - env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-foreground text-base">{serviceModal.memberName}</h3>
                  {serviceModal.memberPhone && (
                    <p className="text-xs text-muted-foreground mt-0.5">{serviceModal.memberPhone}</p>
                  )}
                  <span className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{serviceModal.serviceType}</span>
                </div>
                <button onClick={() => setServiceModal(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 bg-muted/30 rounded-lg px-3 py-2">{serviceModal.details}</p>
            </div>

            {/* 결제 내역 */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">결제 내역</h4>
              {!serviceModal.memberId ? (
                <p className="text-xs text-muted-foreground text-center py-6">회원 ID가 없어 결제 내역을 조회할 수 없습니다</p>
              ) : memberRevenueLoading ? (
                <p className="text-xs text-muted-foreground text-center py-6">로딩 중...</p>
              ) : !memberRevenue || memberRevenue.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">결제 내역이 없습니다</p>
              ) : (
                <>
                  {/* 미수금 요약 */}
                  {memberRevenue.some((r: any) => (r.unpaidAmount ?? 0) > 0) && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                      <span className="text-red-400 font-bold text-sm">미수금 있음</span>
                      <span className="ml-auto text-red-400 font-bold">
                        {memberRevenue.reduce((sum: number, r: any) => sum + (r.unpaidAmount ?? 0), 0).toLocaleString()}원
                      </span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {memberRevenue.map((r: any) => {
                      const hasUnpaid = (r.unpaidAmount ?? 0) > 0;
                      return (
                        <div key={r.id} className={`rounded-xl px-3 py-2.5 border ${hasUnpaid ? "bg-red-500/5 border-red-500/20" : "bg-background border-border"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{r.programDetail || r.type}</p>
                              <p className="text-xs text-muted-foreground">{r.paymentDate} · {r.subType}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-foreground">{(r.paidAmount ?? 0).toLocaleString()}원</p>
                              {hasUnpaid && (
                                <p className="text-xs font-semibold text-red-400">미수 {(r.unpaidAmount).toLocaleString()}원</p>
                              )}
                            </div>
                          </div>
                          {r.discountAmount > 0 && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5">할인 {r.discountAmount.toLocaleString()}원</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
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

  const expiryInfo = (() => {
    if (!locker.endDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(locker.endDate); end.setHours(0, 0, 0, 0);
    const diff = Math.round((end.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { label: `${Math.abs(diff)}일째 만료`, expired: true };
    if (diff === 0) return { label: "오늘 만료", expired: false };
    return { label: `${diff}일 후 만료`, expired: false };
  })();

  return (
    <div className={`border rounded-xl p-3 space-y-1.5 relative ${
      isOccupied
        ? expiryInfo?.expired
          ? "border-red-500/50 bg-red-500/5"
          : "border-orange-500/50 bg-orange-500/5"
        : "border-border bg-card"
    }`}>
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
          <div className="flex items-center justify-between gap-1">
            <p className="text-sm font-medium text-foreground truncate">{locker.memberName}</p>
            <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              expiryInfo?.expired
                ? "bg-red-500/20 text-red-400"
                : "bg-green-500/20 text-green-400"
            }`}>
              {expiryInfo?.expired ? "만료" : "활성"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{locker.memberPhone ?? ""}</p>
          {expiryInfo && (
            <p className={`text-xs font-medium ${expiryInfo.expired ? "text-red-400" : "text-muted-foreground"}`}>
              {expiryInfo.label}
            </p>
          )}
          <button onClick={onRelease} className="w-full text-xs py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors mt-1">반납</button>
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
    const cid = categoryId ? Number(categoryId) : undefined;
    if (bulk) {
      const from = parseInt(bulkFrom);
      const to = parseInt(bulkTo);
      if (isNaN(from) || isNaN(to) || from > to) {
        toast.error("올바른 범위를 입력하세요");
        return;
      }
      let created = 0, skipped = 0;
      for (let i = from; i <= to; i++) {
        try {
          await createLocker.mutateAsync({ lockerNumber: String(i), lockerType: type, memo, branchId: bid, categoryId: cid });
          created++;
        } catch {
          skipped++;
        }
      }
      toast.success(`${created}개 추가 완료${skipped > 0 ? ` (${skipped}개 이미 존재해 건너뜀)` : ""}`);
      onAdded();
      onClose();
    } else {
      if (!number.trim()) { toast.error("락커 번호를 입력하세요"); return; }
      createLocker.mutate({ lockerNumber: number.trim(), lockerType: type, memo, branchId: bid, categoryId: cid });
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
