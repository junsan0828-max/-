import { trpc } from "../lib/trpc";

/** 활성화된 자동 포인트 규칙 금액을 반환. 비활성이면 undefined. */
export function useAutoPoints() {
  const { data } = trpc.fitPoints.getAutoRules.useQuery();
  return (event: string): number | undefined => data?.[event];
}

/** "+10P" 형식 문자열 반환. 비활성이면 null. */
export function pointLabel(amount: number | undefined): string | null {
  if (!amount) return null;
  return `+${amount}P`;
}
