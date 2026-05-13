import { useState, useEffect, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { CheckCircle, XCircle, AlertCircle, Delete } from "lucide-react";

type CheckResult = {
  result: string;
  member: {
    id: number;
    name: string;
    phone: string | null;
    membershipStart: string | null;
    membershipEnd: string | null;
    membershipType: string | null;
    ptPackage: {
      name: string | null;
      expiryDate: string | null;
      remainingSessions: number;
    } | null;
  } | null;
  locker: {
    lockerNumber: string;
    type: string;
    endDate: string | null;
  } | null;
} | null;

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const day = days[d.getDay()];
  const hms = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  return `${ymd}(${day}) ${hms}`;
}

function formatPhone(digits: string) {
  // digits: e.g. "01012345678"
  if (digits.length === 11)
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

export default function KioskCheckin() {
  const [input, setInput] = useState(""); // digits after 010
  const [result, setResult] = useState<CheckResult>(null);
  const [now, setNow] = useState(new Date().toISOString());
  const [countdown, setCountdown] = useState(0);
  const [tab, setTab] = useState<"phone" | "number">("phone");

  const checkIn = trpc.access.checkIn.useMutation({
    onSuccess: (data) => {
      setResult(data as CheckResult);
      setCountdown(7);
    },
  });

  // 현재 시간 갱신
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, []);

  // 결과 팝업 자동 닫기 카운트다운
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setResult(null);
          setInput("");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleKey = useCallback(
    (key: string) => {
      if (result) return;
      if (key === "del") {
        setInput((v) => v.slice(0, -1));
        return;
      }
      if (input.length >= 8) return;
      setInput((v) => v + key);
    },
    [input, result]
  );

  const handleSubmit = useCallback(() => {
    if (tab === "phone") {
      if (input.length !== 8) return;
      checkIn.mutate({ phone: "010" + input });
    }
  }, [input, tab, checkIn]);

  // 키보드 지원
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result) {
        if (e.key === "Escape" || e.key === "Enter") {
          setResult(null);
          setInput("");
          setCountdown(0);
        }
        return;
      }
      if (e.key >= "0" && e.key <= "9") handleKey(e.key);
      else if (e.key === "Backspace") handleKey("del");
      else if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleKey, handleSubmit, result]);

  const displayPhone = "010-" + (input.slice(0, 4) || "____") + "-" + (input.slice(4, 8) || "____");

  return (
    <div className="min-h-screen bg-black flex flex-col select-none overflow-hidden">
      {/* 헤더 */}
      <div className="relative h-48 overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url('/gym-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black" />
        <h1 className="relative z-10 text-3xl font-bold text-white tracking-wider text-center">
          맞춤운동센터 자이언트짐
        </h1>
      </div>

      {/* 입력 영역 */}
      <div className="flex-1 flex flex-col items-center justify-start px-6 py-4 gap-4">
        {/* 탭 */}
        <div className="flex gap-0 rounded-lg overflow-hidden border border-gray-700 w-full max-w-xs">
          {(["phone", "number"] as const).map((t, i) => (
            <button
              key={t}
              onClick={() => { setTab(t); setInput(""); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-orange-500 text-white"
                  : "bg-gray-900 text-gray-400 hover:bg-gray-800"
              } ${i === 0 ? "border-r border-gray-700" : ""}`}
            >
              {t === "phone" ? "휴대폰번호" : "회원번호"}
            </button>
          ))}
        </div>

        {/* 입력 표시 */}
        {tab === "phone" && (
          <div className="text-3xl font-mono font-bold text-white tracking-widest py-2">
            {displayPhone}
          </div>
        )}

        {/* 키패드 */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "취소", "0", "del"].map(
            (key) => {
              const isAction = key === "취소" || key === "del";
              return (
                <button
                  key={key}
                  onClick={() => {
                    if (key === "취소") {
                      setInput("");
                      return;
                    }
                    handleKey(key);
                  }}
                  className={`h-16 rounded-xl text-xl font-semibold transition-colors active:scale-95 ${
                    isAction
                      ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      : "bg-gray-800 text-white hover:bg-gray-700"
                  }`}
                >
                  {key === "del" ? <Delete className="h-5 w-5 mx-auto" /> : key}
                </button>
              );
            }
          )}
        </div>

        {/* 출석하기 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={input.length !== 8 || checkIn.isPending}
          className="w-full max-w-xs h-14 rounded-xl text-lg font-bold transition-colors disabled:opacity-40 bg-orange-500 hover:bg-orange-400 text-white mt-2"
        >
          {checkIn.isPending ? "확인 중..." : "출석하기"}
        </button>
      </div>

      {/* 결과 팝업 */}
      {result && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 relative">
            {/* 닫기 */}
            <button
              onClick={() => { setResult(null); setInput(""); setCountdown(0); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl font-bold"
            >
              ✕
            </button>

            {result.result === "not_found" ? (
              <NotFoundResult />
            ) : result.result === "expired" ? (
              <ExpiredResult member={result.member!} now={now} />
            ) : result.result === "blocked" ? (
              <BlockedResult member={result.member!} />
            ) : (
              <AllowedResult member={result.member!} locker={result.locker} now={now} />
            )}

            {/* 자동 닫힘 카운트다운 */}
            <div className="mt-4 text-center text-xs text-gray-500">
              {countdown}초 후 자동으로 닫힙니다
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AllowedResult({
  member,
  locker,
  now,
}: {
  member: NonNullable<CheckResult>["member"];
  locker: NonNullable<CheckResult>["locker"];
  now: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle className="h-8 w-8 text-green-400 shrink-0" />
        <div>
          <p className="text-xl font-bold text-white">
            <span className="text-orange-400">{member!.name}</span>님, 환영합니다.
          </p>
          <p className="text-xs text-gray-400">{formatDateTime(now)}</p>
        </div>
      </div>

      {/* 회원권 */}
      <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm mb-3">
        <Row label="현재 회원권" value={member!.membershipType ?? "-"} />
        <Row
          label="회원권 만료일"
          value={member!.membershipEnd ?? "-"}
          highlight={member!.membershipEnd ? daysLeft(member!.membershipEnd) : undefined}
        />
        {member!.ptPackage && (
          <>
            <div className="border-t border-gray-700 my-2" />
            <Row label="수강권 만료일" value={member!.ptPackage.expiryDate ?? "-"} />
            <Row label="잔여 수강" value={`${member!.ptPackage.remainingSessions}회`} />
            <Row label="수강권 상품명" value={member!.ptPackage.name ?? "-"} />
          </>
        )}
      </div>

      {/* 락커 */}
      {locker && (
        <div className="bg-gray-800 rounded-xl p-4 text-sm">
          <Row
            label="개인락커"
            value={locker.lockerNumber}
            badge="사용중"
            badgeColor="bg-orange-500"
          />
        </div>
      )}
    </div>
  );
}

function ExpiredResult({ member, now }: { member: NonNullable<CheckResult>["member"]; now: string }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <AlertCircle className="h-8 w-8 text-yellow-400 shrink-0" />
        <div>
          <p className="text-xl font-bold text-white">
            <span className="text-orange-400">{member!.name}</span>님
          </p>
          <p className="text-xs text-gray-400">{formatDateTime(now)}</p>
        </div>
      </div>
      <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 text-center">
        <p className="text-red-300 font-bold text-lg">회원권이 만료되었습니다.</p>
        <p className="text-red-400 text-sm mt-1">관리자에게 문의해주세요.</p>
        {member!.membershipEnd && (
          <p className="text-gray-400 text-xs mt-2">만료일: {member!.membershipEnd}</p>
        )}
      </div>
    </div>
  );
}

function BlockedResult({ member }: { member: NonNullable<CheckResult>["member"] }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <XCircle className="h-8 w-8 text-red-400 shrink-0" />
        <div>
          <p className="text-xl font-bold text-white">{member!.name}님</p>
        </div>
      </div>
      <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 text-center">
        <p className="text-red-300 font-bold text-lg">출입이 제한된 회원입니다.</p>
        <p className="text-red-400 text-sm mt-1">관리자에게 문의해주세요.</p>
      </div>
    </div>
  );
}

function NotFoundResult() {
  return (
    <div className="text-center py-4">
      <XCircle className="h-12 w-12 text-gray-500 mx-auto mb-3" />
      <p className="text-gray-300 font-bold text-lg">등록된 회원을 찾을 수 없습니다.</p>
      <p className="text-gray-500 text-sm mt-1">전화번호를 다시 확인해주세요.</p>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  badge,
  badgeColor,
}: {
  label: string;
  value: string;
  highlight?: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-white">{value}</span>
        {highlight && (
          <span className="text-xs text-orange-400">{highlight}</span>
        )}
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full text-white ${badgeColor ?? "bg-gray-600"}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function daysLeft(endDate: string): string {
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "만료";
  if (diff <= 7) return `D-${diff}`;
  return "";
}
