import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 전화번호 표준화: 010-0000-0000 형식
export function fmtPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone; // 형식 불명 시 원본 그대로
}

export const SKIP_REASON_LABEL: Record<string, string> = {
  no_member: "회원이 연결되지 않았습니다 (이름만 입력됨) — 회원을 검색해 선택하세요",
  no_package: "잔여 횟수가 있는 활성 PT 패키지가 없습니다",
  duplicate: "같은 날짜에 이미 수업일지가 있습니다",
};
