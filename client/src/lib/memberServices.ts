// ─── 공통 서비스 타입 / 뱃지 시스템 ─────────────────────────────────────────
// 이 파일의 상수를 모든 페이지에서 import해서 통일합니다.

export type ServiceType = "PT" | "헬스" | "필라테스" | "락커" | "운동복" | "기타";
export type ServiceStatus = "active" | "expiring" | "expired" | "paused" | "waiting" | "completed";
export type MemberStatus = "active" | "paused";

// ─── 서비스 타입별 색상 ────────────────────────────────────────────────────
export const SERVICE_COLORS: Record<ServiceType, { bg: string; text: string; border: string; faint: string }> = {
  PT:    { bg: "bg-primary/20",         text: "text-primary",         border: "border-primary/30",      faint: "bg-primary/5"      },
  헬스:  { bg: "bg-emerald-500/20",     text: "text-emerald-400",     border: "border-emerald-500/30",  faint: "bg-emerald-500/5"  },
  필라테스: { bg: "bg-teal-500/20",     text: "text-teal-400",        border: "border-teal-500/30",     faint: "bg-teal-500/5"     },
  락커:  { bg: "bg-amber-500/20",       text: "text-amber-400",       border: "border-amber-500/30",    faint: "bg-amber-500/5"    },
  운동복: { bg: "bg-purple-500/20",     text: "text-purple-400",      border: "border-purple-500/30",   faint: "bg-purple-500/5"   },
  기타:  { bg: "bg-gray-500/20",        text: "text-gray-400",        border: "border-gray-500/30",     faint: "bg-gray-500/5"     },
};

// ─── 서비스 상태별 색상 ────────────────────────────────────────────────────
export const STATUS_COLORS: Record<ServiceStatus, { bg: string; text: string; border: string; label: string }> = {
  active:    { bg: "bg-green-500/20",  text: "text-green-400",  border: "border-green-500/30",  label: "이용중"   },
  expiring:  { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30", label: "만료예정" },
  expired:   { bg: "bg-red-500/20",    text: "text-red-400",    border: "border-red-500/30",    label: "만료"     },
  paused:    { bg: "bg-gray-500/20",   text: "text-gray-400",   border: "border-gray-500/30",   label: "정지"     },
  waiting:   { bg: "bg-blue-500/20",   text: "text-blue-400",   border: "border-blue-500/30",   label: "대기"     },
  completed: { bg: "bg-gray-500/20",   text: "text-gray-400",   border: "border-gray-500/30",   label: "완료"     },
};

// ─── 회원 상태 ───────────────────────────────────────────────────────────
export const MEMBER_STATUS: Record<MemberStatus, { bg: string; text: string; border: string; label: string }> = {
  active: { bg: "bg-green-500/20",  text: "text-green-400",  border: "border-green-500/30", label: "활성" },
  paused: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30", label: "정지" },
};

// ─── PT 패키지 상태 ──────────────────────────────────────────────────────
export const PT_STATUS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  active:    { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30", label: "진행중" },
  completed: { bg: "bg-gray-500/20",  text: "text-gray-400",  border: "border-gray-500/30",  label: "완료"   },
  expired:   { bg: "bg-red-500/20",   text: "text-red-400",   border: "border-red-500/30",   label: "만료"   },
  paused:    { bg: "bg-yellow-500/20",text: "text-yellow-400",border: "border-yellow-500/30",label: "정지"   },
};

// ─── 출석 상태 ───────────────────────────────────────────────────────────
export const ATTENDANCE_STATUS = {
  attended:  { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30", label: "출석" },
  noshow:    { bg: "bg-red-500/20",     text: "text-red-400",     border: "border-red-500/30",     label: "노쇼" },
  cancelled: { bg: "bg-yellow-500/20",  text: "text-yellow-400",  border: "border-yellow-500/30",  label: "취소" },
} as const;

// ─── 담당자 용어 통일 ────────────────────────────────────────────────────
export const STAFF_LABELS = {
  trainer:    "담당 트레이너",
  consultant: "담당 관리자",
  assistant:  "보조 트레이너",
} as const;

// ─── serviceItems 문자열 파서 (단일 정의) ────────────────────────────────
export interface ParsedServiceItem {
  type: ServiceType;
  raw: string;       // 원본 토큰 (e.g. "헬스(3개월)")
  label: string;     // 표시용 (e.g. "헬스 3개월")
  months?: number;   // 헬스/필라테스
  lockerNum?: string;
  ptCount?: number;
}

export function parseServiceItems(serviceItems: string | null | undefined): ParsedServiceItem[] {
  if (!serviceItems) return [];
  return serviceItems.split(",").map(s => s.trim()).filter(Boolean).map(raw => {
    if (raw.startsWith("PT(")) {
      const m = raw.match(/PT\((\d+)회\)/);
      const count = m ? parseInt(m[1]) : undefined;
      return { type: "PT" as ServiceType, raw, label: count ? `PT ${count}회` : "PT", ptCount: count };
    }
    if (raw.startsWith("헬스(")) {
      const m = raw.match(/헬스\((\d+)개월\)/);
      const mo = m ? parseInt(m[1]) : undefined;
      return { type: "헬스" as ServiceType, raw, label: mo ? `헬스 ${mo}개월` : "헬스", months: mo };
    }
    if (raw.startsWith("헬스")) {
      return { type: "헬스" as ServiceType, raw, label: "헬스" };
    }
    if (raw.startsWith("필라테스")) {
      return { type: "필라테스" as ServiceType, raw, label: "필라테스" };
    }
    if (raw.startsWith("락커(")) {
      const m = raw.match(/락커\(([^)]+)\)/);
      const num = m?.[1];
      return { type: "락커" as ServiceType, raw, label: num ? `락커 ${num}번` : "락커", lockerNum: num };
    }
    if (raw.startsWith("락커")) {
      return { type: "락커" as ServiceType, raw, label: "락커" };
    }
    if (raw.startsWith("운동복")) {
      return { type: "운동복" as ServiceType, raw, label: "운동복" };
    }
    return { type: "기타" as ServiceType, raw, label: raw };
  });
}

// ─── CSS 헬퍼 ────────────────────────────────────────────────────────────
export function serviceBadgeClass(type: ServiceType): string {
  const c = SERVICE_COLORS[type];
  return `${c.bg} ${c.text} border ${c.border}`;
}

export function statusBadgeClass(status: ServiceStatus): string {
  const c = STATUS_COLORS[status];
  return `${c.bg} ${c.text} border ${c.border}`;
}

export function ptStatusBadgeClass(status: string): string {
  const c = PT_STATUS[status] ?? PT_STATUS.expired;
  return `${c.bg} ${c.text} border ${c.border}`;
}
