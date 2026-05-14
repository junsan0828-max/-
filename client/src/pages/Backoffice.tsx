import { useState } from "react";
import { trpc } from "../lib/trpc";

type Tab = "members" | "lockers" | "logs";

function Badge({ result }: { result: string }) {
  const map: Record<string, string> = {
    allowed: "bg-green-100 text-green-700",
    expired: "bg-yellow-100 text-yellow-700",
    blocked: "bg-red-100 text-red-700",
    not_found: "bg-gray-100 text-gray-500",
  };
  const label: Record<string, string> = {
    allowed: "입장",
    expired: "만료",
    blocked: "차단",
    not_found: "미등록",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[result] ?? "bg-gray-100 text-gray-500"}`}>
      {label[result] ?? result}
    </span>
  );
}

// ── 회원 관리 탭 ──────────────────────────────────────────────────────────────
function MembersTab() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: rows = [], refetch } = trpc.backoffice.searchMembers.useQuery({ q, page });
  const { data: detail } = trpc.backoffice.getMember.useQuery(
    { id: selectedId! },
    { enabled: selectedId !== null }
  );

  const updateMember = trpc.backoffice.updateMember.useMutation({ onSuccess: () => refetch() });
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  function openMember(id: number) {
    setSelectedId(id);
    setEditMode(false);
    setForm({});
  }

  function startEdit() {
    if (!detail) return;
    setForm({
      name: detail.member.name ?? "",
      phone: detail.member.phone ?? "",
      status: detail.member.status ?? "active",
      membershipStart: detail.member.membershipStart ?? "",
      membershipEnd: detail.member.membershipEnd ?? "",
      memo: detail.member.memo ?? "",
    });
    setEditMode(true);
  }

  function saveEdit() {
    if (!selectedId) return;
    updateMember.mutate({
      id: selectedId,
      ...form,
      membershipStart: form.membershipStart || null,
      membershipEnd: form.membershipEnd || null,
      memo: form.memo || null,
    });
    setEditMode(false);
  }

  return (
    <div className="flex gap-4 h-full">
      {/* 목록 */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2">
        <input
          className="border rounded px-3 py-2 text-sm w-full"
          placeholder="이름 / 전화번호 검색"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <div className="overflow-y-auto flex-1 border rounded divide-y">
          {rows.map((m: any) => (
            <button
              key={m.id}
              onClick={() => openMember(m.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition-colors ${selectedId === m.id ? "bg-orange-50 font-semibold" : ""}`}
            >
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-gray-400">{m.phone}</div>
              <div className={`text-xs ${m.status === "active" ? "text-green-600" : "text-red-400"}`}>
                {m.status === "active" ? "활성" : m.status} · {m.membershipEnd ? `~${m.membershipEnd}` : "기간없음"}
              </div>
            </button>
          ))}
          {rows.length === 0 && <p className="text-center text-gray-400 text-sm py-6">검색 결과 없음</p>}
        </div>
        <div className="flex gap-2 justify-center text-xs">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-40">이전</button>
          <span className="py-1">{page}페이지</span>
          <button disabled={rows.length < 30} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-40">다음</button>
        </div>
      </div>

      {/* 상세 */}
      <div className="flex-1 border rounded p-4 overflow-y-auto">
        {!detail ? (
          <p className="text-gray-400 text-sm text-center pt-10">회원을 선택하세요</p>
        ) : editMode ? (
          <div className="space-y-3">
            <h3 className="font-bold text-base">회원 정보 수정</h3>
            {[
              { label: "이름", key: "name" },
              { label: "전화번호", key: "phone" },
              { label: "상태 (active/inactive)", key: "status" },
              { label: "회원권 시작일 (YYYY-MM-DD)", key: "membershipStart" },
              { label: "회원권 종료일 (YYYY-MM-DD)", key: "membershipEnd" },
              { label: "메모", key: "memo" },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input
                  className="border rounded px-3 py-1.5 text-sm w-full"
                  value={form[key] ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={saveEdit} className="bg-orange-500 text-white px-4 py-2 rounded text-sm font-medium">저장</button>
              <button onClick={() => setEditMode(false)} className="border px-4 py-2 rounded text-sm">취소</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{detail.member.name}</h3>
                <p className="text-sm text-gray-500">{detail.member.phone}</p>
                <p className={`text-xs font-medium ${detail.member.status === "active" ? "text-green-600" : "text-red-500"}`}>
                  {detail.member.status === "active" ? "활성 회원" : "비활성"}
                </p>
              </div>
              <button onClick={startEdit} className="text-xs border rounded px-3 py-1.5 hover:bg-gray-50">수정</button>
            </div>

            <section>
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">회원권</h4>
              <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">시작일</span>
                  <span>{detail.member.membershipStart ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">종료일</span>
                  <span>{detail.member.membershipEnd ?? "-"}</span>
                </div>
              </div>
            </section>

            {detail.locker && (
              <section>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">락커</h4>
                <div className="bg-blue-50 rounded p-3 text-sm">
                  {detail.locker.lockerNumber}번 · {detail.locker.lockerType} · ~{detail.locker.endDate ?? "무기한"}
                </div>
              </section>
            )}

            {detail.packages.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">PT 패키지</h4>
                <div className="space-y-2">
                  {detail.packages.map((p: any) => (
                    <div key={p.id} className="border rounded p-3 text-sm space-y-1">
                      <div className="flex justify-between font-medium">
                        <span>{p.packageName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.status}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>잔여 {(p.totalSessions ?? 0) - (p.usedSessions ?? 0)}회</span>
                        <span>{p.expiryDate ? `~${p.expiryDate}` : "기간제한없음"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {detail.member.memo && (
              <section>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">메모</h4>
                <p className="text-sm bg-yellow-50 rounded p-3">{detail.member.memo}</p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 락커 관리 탭 ──────────────────────────────────────────────────────────────
function LockersTab() {
  const { data: lockers = [], refetch } = trpc.backoffice.getLockers.useQuery();
  const releaseLocker = trpc.backoffice.releaseLocker.useMutation({ onSuccess: refetch });
  const deleteLocker = trpc.backoffice.deleteLocker.useMutation({ onSuccess: refetch });
  const createLocker = trpc.backoffice.createLocker.useMutation({ onSuccess: () => { refetch(); setNewNum(""); } });
  const [newNum, setNewNum] = useState("");

  const free = lockers.filter((l: any) => !l.isOccupied).length;
  const used = lockers.filter((l: any) => l.isOccupied).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-sm">
        <div className="bg-green-50 rounded px-4 py-2">사용가능 <strong>{free}</strong></div>
        <div className="bg-orange-50 rounded px-4 py-2">사용중 <strong>{used}</strong></div>
        <div className="bg-gray-50 rounded px-4 py-2">전체 <strong>{lockers.length}</strong></div>
        <div className="ml-auto flex gap-2">
          <input
            className="border rounded px-2 py-1 text-sm w-24"
            placeholder="락커 번호"
            value={newNum}
            onChange={(e) => setNewNum(e.target.value)}
          />
          <button
            disabled={!newNum}
            onClick={() => createLocker.mutate({ lockerNumber: newNum })}
            className="bg-orange-500 text-white px-3 py-1 rounded text-sm disabled:opacity-40"
          >추가</button>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {lockers.map((l: any) => (
          <div
            key={l.id}
            className={`rounded-lg border p-2 text-xs text-center relative group ${l.isOccupied ? "bg-orange-50 border-orange-200" : "bg-gray-50"}`}
          >
            <div className="font-bold text-sm">{l.lockerNumber}</div>
            {l.isOccupied ? (
              <>
                <div className="text-gray-600 truncate">{l.memberName}</div>
                <div className="text-gray-400">{l.endDate ? `~${l.endDate.slice(5)}` : "무기한"}</div>
                <button
                  onClick={() => { if (confirm(`${l.lockerNumber}번 락커를 반납 처리하시겠습니까?`)) releaseLocker.mutate({ lockerId: l.id }); }}
                  className="mt-1 text-orange-500 text-xs underline hidden group-hover:block"
                >반납</button>
              </>
            ) : (
              <>
                <div className="text-gray-400">비어있음</div>
                <button
                  onClick={() => { if (confirm(`${l.lockerNumber}번 락커를 삭제하시겠습니까?`)) deleteLocker.mutate({ lockerId: l.id }); }}
                  className="mt-1 text-red-400 text-xs underline hidden group-hover:block"
                >삭제</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 출입 로그 탭 ──────────────────────────────────────────────────────────────
function LogsTab() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const { data: logs = [] } = trpc.backoffice.todayLogs.useQuery();

  const filtered = date === today
    ? logs
    : logs.filter((l: any) => l.accessedAt?.startsWith(date));

  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-center">
        <input type="date" className="border rounded px-3 py-1.5 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        <span className="text-sm text-gray-500">{filtered.length}건</span>
      </div>
      <div className="overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">시간</th>
              <th className="px-3 py-2 text-left">이름</th>
              <th className="px-3 py-2 text-left">전화번호</th>
              <th className="px-3 py-2 text-left">결과</th>
              <th className="px-3 py-2 text-left">회원권</th>
              <th className="px-3 py-2 text-left">락커</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((l: any) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                  {l.accessedAt ? l.accessedAt.slice(11, 16) : "-"}
                </td>
                <td className="px-3 py-2 font-medium">{l.memberName ?? "-"}</td>
                <td className="px-3 py-2 text-gray-500">{l.phone}</td>
                <td className="px-3 py-2"><Badge result={l.accessResult} /></td>
                <td className="px-3 py-2 text-gray-500">{l.membershipType ?? "-"}</td>
                <td className="px-3 py-2 text-gray-500">{l.lockerNumber ?? "-"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8">출입 기록이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function Backoffice() {
  const [tab, setTab] = useState<Tab>("members");
  const { data: stats } = trpc.access.todayStats.useQuery();

  const tabs: { id: Tab; label: string }[] = [
    { id: "members", label: "회원관리" },
    { id: "lockers", label: "락커관리" },
    { id: "logs", label: "출입로그" },
  ];

  return (
    <div className="p-4 h-screen flex flex-col max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-orange-500">자이언트짐 백오피스</h1>
        {stats && (
          <div className="flex gap-3 text-sm">
            <div className="bg-green-50 rounded px-3 py-1">오늘 입장 <strong>{stats.allowed}</strong></div>
            <div className="bg-red-50 rounded px-3 py-1">거부 <strong>{stats.denied}</strong></div>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "members" && <MembersTab />}
        {tab === "lockers" && <LockersTab />}
        {tab === "logs" && <LogsTab />}
      </div>
    </div>
  );
}
