// API 키가 없을 때 채팅창에서 정해진 패턴의 질문에는 AI 호출 없이 실제 데이터로 바로 답한다.
// 자유로운 대화는 흉내낼 수 없지만, 매출/회원/미수금/정산처럼 정형화된 조회는 규칙만으로 충분하다.
import { GymContext } from "./data";

export interface RuleAnswer {
  matched: boolean;
  reply?: string;
}

function won(n: number): string {
  return `${n.toLocaleString()}원`;
}

/** 채팅에서 규칙 기반으로 답할 수 있는 질문 종류 (사람이 읽을 안내 문구용). */
export const RULE_BASED_TOPICS = ["매출", "미수금", "회원 수", "만료 예정", "이탈위험", "전환율"];

export function answerFromData(instruction: string, context: GymContext, payrollContext?: string | null): RuleAnswer {
  const q = instruction.replace(/\s+/g, "");

  if (/매출/.test(q)) {
    return {
      matched: true,
      reply: `이번 달 매출은 ${won(context.money.monthRevenue)}이에요 (신규 ${context.money.newCount}건, 재등록 ${context.money.reRegisterCount}건).`,
    };
  }

  if (/미수금/.test(q)) {
    const list = context.money.unpaidMembers.slice(0, 10).map((m) => `- ${m.name}: ${won(m.unpaid)}`).join("\n");
    return {
      matched: true,
      reply: `현재 미수금은 총 ${won(context.money.unpaidTotal)}이에요 (${context.money.unpaidMembers.length}명).\n${list || "대상 없음"}`,
    };
  }

  if (/회원.*(수|몇명)|전체회원|활성회원/.test(q)) {
    return {
      matched: true,
      reply: `전체 회원 ${context.members.total}명 중 활성 회원은 ${context.members.active}명이에요.`,
    };
  }

  if (/만료(예정|임박)|재등록대상/.test(q)) {
    const list = context.members.expiringSoon.slice(0, 10).map((m) => `- ${m.name} (${m.membershipEnd})`).join("\n");
    return {
      matched: true,
      reply: `30일 내 만료 예정 회원은 ${context.members.expiringSoon.length}명이에요.\n${list || "대상 없음"}`,
    };
  }

  if (/이탈위험|최근.*만료/.test(q)) {
    return {
      matched: true,
      reply: `최근 14일 내 만료(이탈위험) 회원은 ${context.members.recentlyExpired.length}명이에요.`,
    };
  }

  if (/전환율|퍼널/.test(q)) {
    const sorted = [...context.channels].sort((a, b) => b.rate - a.rate);
    const best = sorted[0];
    return {
      matched: true,
      reply:
        `상담 전환율 ${context.funnel.consultRate}%, 상담→등록 전환율 ${context.funnel.registerRate}%예요.` +
        (best ? ` 가장 효율 좋은 채널은 ${best.channel}(${best.rate}%)이에요.` : ""),
    };
  }

  if (/정산|급여/.test(q) && payrollContext) {
    return {
      matched: true,
      reply: `AI 키가 없어서 자연스러운 설명은 못 드리지만, 운영시스템/구글드라이브에서 조회한 원본 데이터는 그대로 보여드릴게요.\n\n${payrollContext}`,
    };
  }

  return { matched: false };
}
