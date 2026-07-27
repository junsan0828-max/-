// 회원 등급 코드 → 표시용 한글 라벨.
// 화면마다 따로 정의하다 보니 일부 화면에서 코드값("general")이 그대로 노출되는 문제가 있어 한 곳으로 모음.
export const membershipTypeLabel: Record<string, string> = {
  general: "일반회원",
  premium: "프리미엄",
  vip: "VIP",
};

export function formatMembershipType(type: string | null | undefined): string {
  if (!type) return membershipTypeLabel.general;
  return membershipTypeLabel[type] ?? type;
}
