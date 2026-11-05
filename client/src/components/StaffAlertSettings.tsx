import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, ChevronDown, ChevronUp, Smartphone } from "lucide-react";

// 관리자 설정 > 키오스크 알림: 직원별 알림 대상·지점·근무시간 + 호출 기록
// 서버: server/staffAlerts.ts (adminList / adminSave / adminTest / callLog)

type Day = { on: boolean; start: string; end: string };
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const ROLE_LABEL: Record<string, string> = { admin: "관리자", sub_admin: "부관리자", consultant: "FC", trainer: "트레이너" };
const BRANCHES = [1, 2];
const defaultSchedule = (): Day[] => DAYS.map((_, i) => ({ on: i < 6, start: "06:00", end: "23:00" }));

function scheduleSummary(s: Day[] | null) {
  if (!s) return "항상";
  const on = s.map((d, i) => (d.on ? i : -1)).filter(i => i >= 0);
  if (!on.length) return "받지 않음";
  const same = on.every(i => s[i].start === s[on[0]].start && s[i].end === s[on[0]].end);
  const days = on.length === 7 ? "매일" : on.map(i => DAYS[i]).join("·");
  return same ? `${days} ${s[on[0]].start}~${s[on[0]].end}` : `${days} (요일별 시간)`;
}

type Row = {
  userId: number; username: string; role: string; trainerName: string | null;
  enabled: boolean; staffCall: boolean; consult: boolean; branches: number[] | null; schedule: Day[] | null;
  defaultBranches: number[] | null; devices: number; onDuty: boolean;
};

function Editor({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(row.enabled);
  const [staffCall, setStaffCall] = useState(row.staffCall);
  const [consult, setConsult] = useState(row.consult);
  const [branches, setBranches] = useState<number[]>(row.branches ?? []);
  const [useSchedule, setUseSchedule] = useState(!!row.schedule);
  const [schedule, setSchedule] = useState<Day[]>(row.schedule ?? defaultSchedule());
  const save = trpc.staffAlerts.adminSave.useMutation({
    onSuccess: () => { toast.success("저장했습니다"); onSaved(); },
    onError: e => toast.error(e.message),
  });
  const test = trpc.staffAlerts.adminTest.useMutation({
    onSuccess: d => d.sent ? toast.success(`테스트 알림 보냄 (${d.sent}대)`) : toast.error("알림을 켠 기기가 없습니다. 본인이 🔔 → 알림 켜기를 해야 합니다."),
  });

  const setDay = (i: number, patch: Partial<Day>) => setSchedule(s => s.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const defaultLabel = row.role === "trainer"
    ? `기본: 소속 지점(${(row.defaultBranches ?? []).map(b => `${b}호점`).join("·") || "없음"})`
    : "기본: 전 지점";

  return (
    <div className="mt-3 space-y-4 border-t border-border pt-3">
      {row.devices === 0 && (
        <p className="text-xs rounded-md bg-red-500/10 text-red-400 px-3 py-2">
          아직 알림을 켠 휴대폰이 없어 설정을 저장해도 알림이 가지 않습니다.
          이 직원이 자기 휴대폰으로 운영시스템에 로그인 → 오른쪽 위 🔔 → <b>알림 켜기</b>를 해야 합니다.
        </p>
      )}
      <label className="flex items-center justify-between">
        <span className="text-sm font-medium">알림 받기</span>
        <input type="checkbox" className="h-5 w-5 accent-primary" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
      </label>

      <div className={enabled ? "space-y-4" : "space-y-4 opacity-40 pointer-events-none"}>
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">받을 알림</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={staffCall} onChange={e => setStaffCall(e.target.checked)} /> 직원 호출</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={consult} onChange={e => setConsult(e.target.checked)} /> 상담 접수</label>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1.5">지점 <span className="opacity-70">(선택 안 하면 {defaultLabel})</span></p>
          <div className="flex gap-4">
            {BRANCHES.map(b => (
              <label key={b} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={branches.includes(b)}
                  onChange={e => setBranches(prev => e.target.checked ? [...prev, b].sort() : prev.filter(x => x !== b))} />
                {b}호점
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-muted-foreground">근무시간</p>
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button className={`px-2.5 py-1 ${!useSchedule ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setUseSchedule(false)}>항상</button>
              <button className={`px-2.5 py-1 ${useSchedule ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setUseSchedule(true)}>요일별 시간</button>
            </div>
          </div>
          {useSchedule && (
            <div className="space-y-1.5">
              {schedule.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 w-12 text-sm shrink-0">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={d.on} onChange={e => setDay(i, { on: e.target.checked })} />
                    {DAYS[i]}
                  </label>
                  <input type="time" value={d.start} disabled={!d.on} onChange={e => setDay(i, { start: e.target.value })}
                    className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-1 text-sm disabled:opacity-40" />
                  <span className="text-xs text-muted-foreground">~</span>
                  <input type="time" value={d.end} disabled={!d.on} onChange={e => setDay(i, { end: e.target.value })}
                    className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-1 text-sm disabled:opacity-40" />
                </div>
              ))}
              <button className="text-xs text-primary" onClick={() => setSchedule(s => s.map(d => ({ ...d, start: s[0].start, end: s[0].end })))}>
                월요일 시간을 모든 요일에 적용
              </button>
              <p className="text-[11px] text-muted-foreground">끝 시간이 시작보다 이르면 자정을 넘기는 근무로 봅니다 (예: 22:00~02:00).</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          disabled={save.isPending}
          onClick={() => save.mutate({ userId: row.userId, enabled, staffCall, consult, branches: branches.length ? branches : null, schedule: useSchedule ? schedule : null })}
          className="flex-1 text-sm font-medium bg-primary text-primary-foreground py-2 rounded-md disabled:opacity-50"
        >
          {save.isPending ? "저장 중…" : "저장"}
        </button>
        <button
          disabled={test.isPending}
          onClick={() => test.mutate({ userId: row.userId })}
          className="text-sm font-medium bg-primary/15 text-primary px-3 py-2 rounded-md disabled:opacity-50"
        >
          테스트 알림
        </button>
      </div>
    </div>
  );
}

export default function StaffAlertSettings() {
  const { data: rows, refetch } = trpc.staffAlerts.adminList.useQuery();
  const { data: log } = trpc.staffAlerts.callLog.useQuery();
  const [open, setOpen] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(false);
  const testAll = trpc.staffAlerts.adminTest.useMutation({
    onSuccess: d => toast.success(`전체 테스트 알림 보냄 (${d.sent}대)`),
    onError: e => toast.error(e.message),
  });

  const answered = (log ?? []).filter(l => l.responseMin != null);
  const avgMin = answered.length ? Math.round(answered.reduce((a, l) => a + (l.responseMin ?? 0), 0) / answered.length) : null;
  const missed = (log ?? []).filter(l => l.status === "pending").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> 키오스크 알림 설정</CardTitle>
        <p className="text-xs text-muted-foreground">
          키오스크 직원 호출·상담 접수 알림을 누가, 어느 지점, 언제 받을지 정합니다.
          오른쪽 <b>휴대폰 미등록</b>은 그 직원이 아직 자기 휴대폰에서 🔔 → 알림 켜기를 안 했다는 뜻입니다(관리자가 대신 켤 수 없음).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <button
          disabled={testAll.isPending}
          onClick={() => testAll.mutate({})}
          className="w-full text-sm font-medium bg-primary/15 text-primary py-2 rounded-md disabled:opacity-50"
        >
          {testAll.isPending ? "보내는 중…" : "알림 켠 전 직원에게 테스트 알림 보내기"}
        </button>

        <div className="space-y-2">
          {(rows ?? []).map(r => {
            const name = r.trainerName ?? r.username;
            const br = r.branches?.length ? r.branches : r.defaultBranches;
            const kinds = [r.staffCall && "호출", r.consult && "상담"].filter(Boolean).join("·") || "없음";
            return (
              <div key={r.userId} className="rounded-lg border border-border p-3">
                <button className="w-full flex items-center gap-3 text-left" onClick={() => setOpen(open === r.userId ? null : r.userId)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{name}</span>
                      <span className="text-[11px] text-muted-foreground">{ROLE_LABEL[r.role] ?? r.role}{r.trainerName ? ` · ${r.username}` : ""}</span>
                      {!r.enabled
                        ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">끔</span>
                        : r.onDuty
                          ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">지금 받음</span>
                          : <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">근무시간 외</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.enabled
                        ? `${kinds} · ${br === null ? "전 지점" : br.length ? br.map(b => `${b}호점`).join("·") : "지점 없음"} · ${scheduleSummary(r.schedule)}`
                        : "알림 받지 않음"}
                    </p>
                  </div>
                  <span className={`text-[11px] flex items-center gap-1 shrink-0 ${r.devices ? "text-emerald-500" : "text-red-500"}`}>
                    <Smartphone className="h-3.5 w-3.5" />{r.devices ? `휴대폰 ${r.devices}대` : "휴대폰 미등록"}
                  </span>
                  {open === r.userId ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {open === r.userId && <Editor row={r as Row} onSaved={() => { refetch(); setOpen(null); }} />}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-3">
          <button className="w-full flex items-center justify-between text-sm font-medium" onClick={() => setShowLog(v => !v)}>
            <span>
              최근 직원 호출 기록
              <span className="text-xs text-muted-foreground font-normal ml-2">
                평균 응답 {avgMin == null ? "-" : `${avgMin}분`} · 미확인 {missed}건
              </span>
            </span>
            {showLog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showLog && (
            <div className="mt-2 space-y-1">
              {(log ?? []).length === 0 && <p className="text-xs text-muted-foreground">기록이 없습니다.</p>}
              {(log ?? []).map(l => (
                <div key={l.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground tabular-nums shrink-0">{l.createdAt.slice(5)}</span>
                  <span className="shrink-0">{l.branchNo ? `${l.branchNo}호점` : "-"}</span>
                  <span className="flex-1 min-w-0 truncate">
                    {l.status === "pending" ? <span className="text-red-500 font-medium">미확인</span>
                      : l.ackBy ? `${l.ackBy} 확인` : "확인됨"}
                  </span>
                  <span className="tabular-nums shrink-0 text-muted-foreground">{l.responseMin != null ? `${l.responseMin}분` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
