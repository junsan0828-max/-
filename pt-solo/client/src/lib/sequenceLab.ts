// 시퀀스 랩 공용 상수 — 메이커/라이브러리/내 시퀀스가 동일 정의를 공유
// (문자열 완전일치로 필터링되므로 반드시 한 곳에서만 관리)

export const SEQ_CATEGORY_OPTIONS = ["웨이트 트레이닝", "필라테스", "요가", "크로스핏/기능성", "재활운동", "체형교정", "유산소", "기타"];
export const SEQ_DIFFICULTY_OPTIONS = ["입문", "초급", "중급", "고급"];
export const SEQ_AUDIENCE_OPTIONS = ["일반", "시니어", "산전산후", "재활", "선수/경기력", "체중감량", "근력강화"];

export const SEQ_STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "작성 중", cls: "bg-muted text-muted-foreground" },
  SUBMITTED: { label: "검토 중", cls: "bg-blue-500/15 text-blue-600" },
  CHANGES_REQUESTED: { label: "수정 요청", cls: "bg-amber-500/15 text-amber-600" },
  PUBLISHED: { label: "승인·공개", cls: "bg-emerald-500/15 text-emerald-600" },
  REJECTED: { label: "거절", cls: "bg-red-500/15 text-red-600" },
  ARCHIVED: { label: "보관", cls: "bg-muted text-muted-foreground" },
};
