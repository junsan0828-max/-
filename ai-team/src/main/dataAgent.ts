// 퍼널분석 AI "데이터" — 고객 생애 흐름(유입→예약→상담→등록→재등록→소개)의 병목과
// 채널별 효율을 깊게 분석한다. 제이보다 한 단계 더 자세한 진단을 담당.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GymContext } from "./data";
import { buildDataSummary } from "./orchestrator";

const MODEL = process.env.AI_TEAM_MODEL || "claude-sonnet-4-6";

function loadTeam() {
  return JSON.parse(readFileSync(join(__dirname, "..", "..", "config", "team.json"), "utf-8"));
}

export interface FunnelResult {
  isAI: boolean;
  insight: string; // 마크다운 짧은 진단
  bestChannel: string | null;
  worstChannel: string | null;
}

function fallbackFunnel(c: GymContext): FunnelResult {
  const sorted = [...c.channels].sort((a, b) => b.rate - a.rate);
  const best = sorted[0] ?? null;
  const worst = sorted[sorted.length - 1] ?? null;
  const lines = [
    `상담 전환율 ${c.funnel.consultRate}%, 상담→등록 전환율 ${c.funnel.registerRate}%.`,
    best ? `가장 효율 좋은 채널: ${best.channel} (전환율 ${best.rate}%)` : null,
    worst && worst !== best ? `가장 아쉬운 채널: ${worst.channel} (전환율 ${worst.rate}%) — 리드 품질 또는 상담 스크립트 점검 필요` : null,
    c.funnel.pending > 0 ? `미상담 리드 ${c.funnel.pending}건이 대기 중 — 빠른 연락이 전환율을 좌우함.` : null,
  ].filter(Boolean);
  return {
    isAI: false,
    insight: lines.join("\n"),
    bestChannel: best?.channel ?? null,
    worstChannel: worst && worst !== best ? worst.channel : null,
  };
}

export async function analyzeFunnel(context: GymContext): Promise<FunnelResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackFunnel(context);

  const team = loadTeam();
  const persona = team.team.find((t: any) => t.id === "data")?.persona ?? "너는 자이언트짐 퍼널분석 담당 AI 데이터다.";

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: `${persona} 고객 생애 흐름(유입→예약→상담→등록→재등록→소개)의 병목 지점과 채널별 효율을 짧고 날카롭게 진단한다.
반드시 다른 설명 없이 JSON 객체 하나만 출력한다.`,
      messages: [
        {
          role: "user",
          content: `${buildDataSummary(context)}

이 데이터로 퍼널 병목과 채널 효율을 진단해줘. 아래 JSON 형식으로만 답해:
{ "insight": "3~5줄 진단, 마크다운 가능", "bestChannel": "가장 효율 좋은 채널명 또는 null", "worstChannel": "가장 개선 필요한 채널명 또는 null" }`,
        },
      ],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : text;
    const s = body.indexOf("{");
    const e = body.lastIndexOf("}");
    if (s === -1 || e === -1) throw new Error("JSON 파싱 실패");
    const parsed = JSON.parse(body.slice(s, e + 1));
    return {
      isAI: true,
      insight: String(parsed.insight ?? ""),
      bestChannel: parsed.bestChannel ?? null,
      worstChannel: parsed.worstChannel ?? null,
    };
  } catch (err) {
    console.error("[데이터] 퍼널 분석 실패, 규칙 기반으로 전환:", err instanceof Error ? err.message : err);
    return fallbackFunnel(context);
  }
}
