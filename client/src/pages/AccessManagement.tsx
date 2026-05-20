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
} from "lucide-react";

type Branch = { id: number; name: string };

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
};

type Member = { id: number; name: string; phone: string | null };

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
  const [tab, setTab] = useState<"logs" | "lockers">("logs");
  const [logDate, setLogDate] = useState(new Date().toISOString().substring(0, 10));
  const [logBranchId, setLogBranchId] = useState<number | undefined>(undefined);
  const [lockerBranchId, setLockerBranchId] = useState<number | undefined>(undefined);
  const [showAddLocker, setShowAddLocker] = useState(false);
  const [showAssign, setShowAssign] = useState<Locker | null>(null);

  const utils = trpc.useUtils();

  const todayStats = trpc.access.todayStats.useQuery();
  const branchesQuery = trpc.access.getBranches.useQuery();
  const accessLogs = trpc.access.getAccessLogs.useQuery({ date: logDate, limit: 200, branchId: logBranchId });
  const lockersQuery = trpc.access.getLockers.useQuery({ branchId: lockerBranchId });
  const membersQuery = trpc.access.getMembersForLocker.useQuery();

  const releaseLocker = trpc.access.releaseLocker.useMutation({
    onSuccess: () => { utils.access.getLockers.invalidate(); toast.success("락커 반납 완료"); },
  });
  const deleteLocker = trpc.access.deleteLocker.useMutation({
    onSuccess: () => { utils.access.getLockers.invalidate(); toast.success("락커 삭제 완료"); },
  });

  const branches = (branchesQuery.data ?? []) as Branch[];
  const lockers = (lockersQuery.data ?? []) as Locker[];
  const logs = (accessLogs.data ?? []) as AccessLog[];
  const members = (membersQuery.data ?? []) as Member[];

  const occupiedCount = lockers.filter((l) => l.isOccupied).length;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
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

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="오늘 총 출입"
          value={todayStats.data?.total ?? 0}
          icon={<Users className="h-4 w-4" />}
          color="text-primary"
        />
        <StatCard
          label="입장 허가"
          value={todayStats.data?.allowed ?? 0}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="text-green-400"
        />
        <StatCard
          label="입장 거부"
          value={todayStats.data?.denied ?? 0}
          icon={<XCircle className="h-4 w-4" />}
          color="text-red-400"
        />
      </div>

      <div className="flex gap-0 rounded-lg overflow-hidden border border-border">
        {(["logs", "lockers"] as const).map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-accent"
            } ${i === 0 ? "border-r border-border" : ""}`}
          >
            {t === "logs" ? (
              <span className="flex items-center justify-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> 출입 로그
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> 락커 관리 ({occupiedCount}/{lockers.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "logs" && (
        <div className="space-y-3">
          {branches.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setLogBranchId(undefined)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  logBranchId === undefined
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                전체
              </button>
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setLogBranchId(b.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    logBranchId === b.id
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
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
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">전화번호</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">결과</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium hidden sm:table-cell">회원권</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium hidden sm:table-cell">락커</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      출입 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const res = resultLabel(log.accessResult);
                    const ResIcon = res.icon;
                    return (
                      <tr key={log.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                          {formatTime(log.accessedAt)}
                        </td>
                        <td className="px-3 py-2.5 font-medium">
                          {log.memberName ?? <span className="text-muted-foreground text-xs">미등록</span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{log.phone}</td>
                        <td className="px-3 py-2.5">
                          <span className={`flex items-center gap-1 ${res.color}`}>
                            <ResIcon className="h-3.5 w-3.5" />
                            {res.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                          {log.membershipType ?? "-"}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                          {log.lockerNumber ?? "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "lockers" && (
        <div className="space-y-3">
          {branches.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setLockerBranchId(undefined)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  lockerBranchId === undefined
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                전체
              </button>
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setLockerBranchId(b.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    lockerBranchId === b.id
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
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

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {lockers.map((locker) => (
              <LockerCard
                key={locker.id}
                locker={locker}
                onAssign={() => setShowAssign(locker)}
                onRelease={() => {
                  if (confirm(`${locker.lockerNumber}번 락커를 반납하시겠습니까?`))
                    releaseLocker.mutate({ lockerId: locker.id });
                }}
                onDelete={() => {
                  if (!locker.isOccupied && confirm(`${locker.lockerNumber}번 락커를 삭제하시겠습니까?`))
                    deleteLocker.mutate({ lockerId: locker.id });
                }}
              />
            ))}
            {lockers.length === 0 && (
              <div className="col-span-4 text-center py-10 text-muted-foreground text-sm">
                등록된 락커가 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {showAddLocker && (
        <AddLockerModal
          onClose={() => setShowAddLocker(false)}
          onAdded={() => { utils.access.getLockers.invalidate(); setShowAddLocker(false); }}
        />
      )}

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
  onAssign,
  onRelease,
  onDelete,
}: {
  locker: Locker;
  onAssign: () => void;
  onRelease: () => void;
  onDelete: () => void;
}) {
  const isOccupied = locker.isOccupied === 1;
  return (
    <div
      className={`border rounded-xl p-3 space-y-1.5 ${
        isOccupied
          ? "border-orange-500/50 bg-orange-500/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex justify-between items-center">
        <span className="font-bold text-lg">{locker.lockerNumber}</span>
        {isOccupied ? (
          <Lock className="h-4 w-4 text-orange-500" />
        ) : (
          <Unlock className="h-4 w-4 text-gray-500" />
        )}
      </div>
      {isOccupied ? (
        <>
          <p className="text-sm font-medium text-foreground truncate">{locker.memberName}</p>
          <p className="text-xs text-muted-foreground truncate">{locker.memberPhone ?? ""}</p>
          {locker.endDate && (
            <p className="text-xs text-muted-foreground">~ {locker.endDate}</p>
          )}
          <button
            onClick={onRelease}
            className="w-full text-xs py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors mt-1"
          >
            반납
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">비어있음</p>
          <button
            onClick={onAssign}
            className="w-full text-xs py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors mt-1"
          >
            배정
          </button>
          <button
            onClick={onDelete}
            className="w-full text-xs py-1 rounded-md bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 transition-colors"
          >
            <Trash2 className="h-3 w-3 inline" /> 삭제
          </button>
        </>
      )}
    </div>
  );
}

function AddLockerModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [number, setNumber] = useState("");
  const [type, setType] = useState("personal");
  const [memo, setMemo] = useState("");
  const [bulk, setBulk] = useState(false);
  const [bulkFrom, setBulkFrom] = useState("1");
  const [bulkTo, setBulkTo] = useState("10");
  const [branchId, setBranchId] = useState("");

  const branchesQuery = trpc.access.getBranches.useQuery();
  const branches = (branchesQuery.data ?? []) as Branch[];

  const createLocker = trpc.access.createLocker.useMutation({
    onSuccess: onAdded,
    onError: () => toast.error("락커 추가 실패"),
  });

  const parsedBranchId = branchId ? parseInt(branchId) : undefined;

  const handleSubmit = async () => {
    if (bulk) {
      const from = parseInt(bulkFrom);
      const to = parseInt(bulkTo);
      if (isNaN(from) || isNaN(to) || from > to) {
        toast.error("올바른 범위를 입력하세요");
        return;
      }
      for (let i = from; i <= to; i++) {
        await createLocker.mutateAsync({ lockerNumber: String(i), lockerType: type, memo, branchId: parsedBranchId });
      }
    } else {
      if (!number.trim()) { toast.error("락커 번호를 입력하세요"); return; }
      createLocker.mutate({ lockerNumber: number.trim(), lockerType: type, memo, branchId: parsedBranchId });
    }
  };

  return (
    <Modal title="락커 추가" onClose={onClose}>
      <div className="space-y-3">
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

        {branches.length > 0 && (
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
          >
            <option value="">지점 선택 (선택)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
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
