import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { MessageCircle, Send, X, ArrowRight, ChevronUp } from "lucide-react";

type QaMsg = { role: "user" | "bot"; text: string; link?: string; confirm?: { label: string; action: () => Promise<QaMsg> } };

const CORE_QUERY_CHIPS = ["오늘 수업", "이번달 매출", "6회이하 세션"];
const MORE_QUERY_CHIPS = ["현재 회원 수", "이번달 마감", "미수금", "만료임박"];
const QUICK_QUERY_CHIPS = [...CORE_QUERY_CHIPS, ...MORE_QUERY_CHIPS];
const QUICK_ACTION_CHIPS = ["회원 등록"];
const QUICK_SESSION_CHIPS = ["수업 완료"];

export default function QuickAskFloat({ trainerName }: { trainerName: string }) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<QaMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [chipsOpen, setChipsOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"register" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const todayStr = new Date().toISOString().split("T")[0];
  const yearMonth = todayStr.slice(0, 7);

  const createMemberMutation = trpc.members.create.useMutation();
  const attendanceUpsertMutation = trpc.attendanceChecks.upsert.useMutation();
  const useSessionMutation = trpc.pt.useSession.useMutation();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setMessages(m => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      if (pendingMode === "register") {
        setPendingMode(null);
        const result = await executeRegister(q);
        setMessages(m => [...m, result]);
      } else {
        const result = await resolveCommand(q);
        setMessages(m => [...m, result]);
      }
    } catch {
      setMessages(m => [...m, { role: "bot", text: "처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요." }]);
    } finally {
      setBusy(false);
    }
  }

  async function executeRegister(raw: string): Promise<QaMsg> {
    const parsed = parseRegisterInput(raw);
    if (!parsed.name) {
      setPendingMode("register");
      return { role: "bot", text: "이름을 인식하지 못했어요. 한글 이름을 포함해서 다시 입력해주세요.\n예: 홍길동 01012345678" };
    }
    const payload: any = { name: parsed.name, grade: "basic", status: "active" };
    if (parsed.phone) payload.phone = parsed.phone;
    if (parsed.paymentMethod) payload.paymentMethod = parsed.paymentMethod;
    if (parsed.membershipStart) payload.membershipStart = parsed.membershipStart;
    if (parsed.membershipEnd) payload.membershipEnd = parsed.membershipEnd;
    if (parsed.gender) payload.gender = parsed.gender;

    const details: string[] = [parsed.name];
    if (parsed.phone) details.push(parsed.phone);
    if (parsed.paymentMethod) details.push(parsed.paymentMethod);
    if (parsed.membershipStart) details.push(`시작: ${parsed.membershipStart}`);
    if (parsed.membershipEnd) details.push(`만료: ${parsed.membershipEnd}`);

    return {
      role: "bot",
      text: `${details.join(" / ")} → 회원 등록을 진행할까요?`,
      confirm: {
        label: "등록 진행",
        action: async () => {
          try {
            const result = await createMemberMutation.mutateAsync(payload);
            const infos: string[] = [];
            if (parsed.phone) infos.push(`연락처: ${parsed.phone}`);
            if (parsed.paymentMethod) infos.push(`결제: ${parsed.paymentMethod}`);
            if (parsed.membershipStart) infos.push(`시작: ${parsed.membershipStart}`);
            if (parsed.membershipEnd) infos.push(`만료: ${parsed.membershipEnd}`);
            const infoStr = infos.length > 0 ? `\n${infos.join(" / ")}` : "";
            return { role: "bot" as const, text: `✅ ${parsed.name} 회원이 등록되었습니다.${infoStr}`, link: `/members/${result.id}` };
          } catch (err: any) {
            return { role: "bot" as const, text: err.message || "회원 등록에 실패했어요." };
          }
        },
      },
    };
  }

  function parseRegisterInput(raw: string) {
    let rest = raw;
    const result: { name: string; phone?: string; paymentMethod?: string; membershipStart?: string; membershipEnd?: string; gender?: string } = { name: "" };

    const phoneMatch = rest.match(/\d{2,3}[-.]?\d{3,4}[-.]?\d{4}/);
    if (phoneMatch) {
      result.phone = phoneMatch[0].replace(/[-.]/g, "").replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3").replace(/^(\d{2})(\d{3,4})(\d{4})$/, "$1-$2-$3");
      rest = rest.replace(phoneMatch[0], " ");
    }

    const paymentMethods = ["카드", "현금", "계좌이체", "지역화폐"] as const;
    for (const pm of paymentMethods) {
      if (rest.includes(pm)) { result.paymentMethod = pm; rest = rest.replace(pm, " "); break; }
    }

    const dateLabels = [
      { keywords: ["시작일", "시작"], field: "membershipStart" as const },
      { keywords: ["만료일", "만료", "마감일", "마감", "종료일", "종료"], field: "membershipEnd" as const },
    ];
    for (const { keywords, field } of dateLabels) {
      for (const kw of keywords) {
        const pattern = new RegExp(`${kw}\\s*(\\d{2,4})[.\\-/](\\d{1,2})[.\\-/](\\d{1,2})`);
        const m = rest.match(pattern);
        if (m) {
          const year = m[1].length === 2 ? `20${m[1]}` : m[1];
          result[field] = `${year}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
          rest = rest.replace(m[0], " ");
          break;
        }
      }
    }

    if (rest.includes("남성") || rest.includes("남자")) { result.gender = "male"; rest = rest.replace(/남성|남자/, " "); }
    else if (rest.includes("여성") || rest.includes("여자")) { result.gender = "female"; rest = rest.replace(/여성|여자/, " "); }

    const nameMatch = rest.match(/[가-힣]{2,5}/);
    if (nameMatch) result.name = nameMatch[0];

    return result;
  }

  async function resolveCommand(q: string): Promise<QaMsg> {
    const has = (...kws: string[]) => kws.some(k => q.includes(k));

    if (has("수업 완료", "수업완료", "출석 완료", "출석완료") || (has("수업", "출석") && !has("오늘 수업", "이번달 수업", "오늘 출석"))) {
      const raw = q.replace(/수업\s*완료|출석\s*완료|수업완료|출석완료|수업|출석/g, "").trim();
      const nameMatch = raw.match(/[가-힣]{2,5}/);
      if (nameMatch) {
        const name = nameMatch[0];
        const allMembers = await utils.members.list.fetch();
        const member = allMembers.find(m => m.name === name);
        if (!member) return { role: "bot", text: `"${name}" 회원을 찾을 수 없어요.` };
        return {
          role: "bot",
          text: `${name} 회원 — 오늘(${todayStr}) 수업 완료 처리 + 세션 1회 차감할까요?`,
          confirm: {
            label: "수업 완료",
            action: async () => {
              try {
                await attendanceUpsertMutation.mutateAsync({ memberId: member.id, checkDate: todayStr, status: "attended" });
                await useSessionMutation.mutateAsync({ memberId: member.id, sessionDate: todayStr });
                return { role: "bot" as const, text: `✅ ${name} 수업 완료 · 세션 1회 차감됐어요.`, link: `/members/${member.id}` };
              } catch (err: any) {
                return { role: "bot" as const, text: err.message || "처리 중 오류가 발생했어요." };
              }
            },
          },
        };
      }
      return { role: "bot", text: "회원 이름을 포함해서 다시 입력해주세요.\n예: 홍길동 수업 완료" };
    }

    if (has("회원 등록", "회원등록", "신규 등록", "신규등록")) {
      const raw = q.replace(/회원\s*등록|신규\s*등록/g, "").trim();
      if (!raw) {
        setPendingMode("register");
        return { role: "bot", text: "회원 등록을 시작할게요.\n이름과 연락처를 입력해주세요.\n\n예: 홍길동 01012345678\n\n추가 정보:\n• 결제방법: 카드, 현금, 계좌이체, 지역화폐\n• 시작일/만료일: 시작일 26.08.10\n• 성별: 남성, 여성" };
      }
      return await executeRegister(raw);
    }

    const memberInfoKeywords = ["마감", "만료", "세션", "잔여", "연락처", "전화", "미수금", "등급", "상태", "시작일", "메모", "특이사항", "생년월일", "이메일"];
    if (memberInfoKeywords.some(k => q.includes(k))) {
      const memberResult = await findMemberByQuery(q, memberInfoKeywords);
      if (memberResult) return memberResult;
    }

    const answer = await resolveAnswer(q);
    if (!answer.startsWith("인식하지 못한")) return { role: "bot", text: answer };

    const guessed = guessIntent(q);
    if (guessed) return guessed;

    return { role: "bot", text: answer };
  }

  function guessIntent(q: string): QaMsg | null {
    const NOT_NAMES = new Set(["이번달", "이번", "오늘", "매출", "미수금", "만료", "임박", "마감", "세션", "수업", "잔여", "등록", "현재", "회원", "연락처", "전화", "등급", "상태", "시작일", "메모", "특이사항", "생년월일", "이메일", "회이하", "신규", "카드", "현금", "계좌이체", "지역화폐", "남성", "여성", "남자", "여자", "활성", "정지", "기본", "프리미엄"]);
    const koreanWords = q.match(/[가-힣]{2,5}/g) || [];
    const nameCandidate = koreanWords.find(w => !NOT_NAMES.has(w));
    const hasPhone = /\d{2,3}[-.]?\d{3,4}[-.]?\d{4}/.test(q);

    if (nameCandidate && hasPhone) {
      const parsed = parseRegisterInput(q);
      if (parsed.name) {
        const details = [parsed.name, ...(parsed.phone ? [parsed.phone] : [])];
        return {
          role: "bot",
          text: `"${details.join(" / ")}" → 회원 등록으로 판단했어요. 진행할까요?`,
          confirm: {
            label: "등록 진행",
            action: async () => {
              const payload: any = { name: parsed.name, grade: "basic", status: "active" };
              if (parsed.phone) payload.phone = parsed.phone;
              if (parsed.paymentMethod) payload.paymentMethod = parsed.paymentMethod;
              if (parsed.membershipStart) payload.membershipStart = parsed.membershipStart;
              if (parsed.membershipEnd) payload.membershipEnd = parsed.membershipEnd;
              if (parsed.gender) payload.gender = parsed.gender;
              try {
                const result = await createMemberMutation.mutateAsync(payload);
                const infos = [...(parsed.phone ? [`연락처: ${parsed.phone}`] : []), ...(parsed.paymentMethod ? [`결제: ${parsed.paymentMethod}`] : [])];
                return { role: "bot" as const, text: `✅ ${parsed.name} 회원이 등록되었습니다.${infos.length ? "\n" + infos.join(" / ") : ""}`, link: `/members/${result.id}` };
              } catch (err: any) {
                return { role: "bot" as const, text: err.message || "회원 등록에 실패했어요." };
              }
            },
          },
        };
      }
    }

    if (nameCandidate && !hasPhone) {
      return {
        role: "bot",
        text: `"${nameCandidate}" → 회원 등록으로 판단했어요. 진행할까요?\n\n연락처도 함께 입력하면 더 정확해요.\n예: ${nameCandidate} 01012345678`,
        confirm: {
          label: "이름만으로 등록",
          action: async () => {
            try {
              const result = await createMemberMutation.mutateAsync({ name: nameCandidate, grade: "basic", status: "active" });
              return { role: "bot" as const, text: `✅ ${nameCandidate} 회원이 등록되었습니다.`, link: `/members/${result.id}` };
            } catch (err: any) {
              return { role: "bot" as const, text: err.message || "회원 등록에 실패했어요." };
            }
          },
        },
      };
    }

    return null;
  }

  async function findMemberByQuery(q: string, keywords: string[]): Promise<QaMsg | null> {
    const name = keywords.reduce((s, k) => s.replace(k, ""), q).replace(/\s+/g, " ").trim();
    if (!name || name.length > 10) return null;

    const allMembers = await utils.members.list.fetch();
    const member = allMembers.find(m => m.name === name);
    if (!member) return { role: "bot", text: `"${name}" 회원을 찾을 수 없어요.` };

    const has = (...kws: string[]) => kws.some(k => q.includes(k));

    if (has("마감", "만료")) {
      if (!member.membershipEnd) return { role: "bot", text: `${name} 회원의 만료일이 설정되어 있지 않아요.`, link: `/members/${member.id}` };
      const end = new Date(member.membershipEnd);
      const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const status = diff < 0 ? `${Math.abs(diff)}일 지남` : diff === 0 ? "오늘 만료" : `${diff}일 남음`;
      return { role: "bot", text: `${name} 회원 만료일: ${member.membershipEnd} (${status})`, link: `/members/${member.id}` };
    }
    if (has("세션", "잔여")) {
      const pkgs = await utils.pt.listByMember.fetch({ memberId: member.id });
      const active = pkgs.filter((p: any) => p.status === "active");
      if (active.length === 0) return { role: "bot", text: `${name} 회원의 활성 PT 패키지가 없어요.`, link: `/members/${member.id}` };
      const lines = active.map((p: any) => `${p.packageName || "PT"}: ${p.totalSessions - p.usedSessions}회 남음 (${p.usedSessions}/${p.totalSessions})`);
      return { role: "bot", text: `${name} 회원 잔여 세션:\n${lines.join("\n")}`, link: `/members/${member.id}` };
    }
    if (has("연락처", "전화")) return { role: "bot", text: `${name} 회원 연락처: ${member.phone || "미등록"}`, link: `/members/${member.id}` };
    if (has("미수금")) {
      const unpaid = (member as any).unpaidAmount ?? 0;
      return { role: "bot", text: unpaid > 0 ? `${name} 회원 미수금: ${unpaid.toLocaleString()}원` : `${name} 회원은 미수금이 없어요.`, link: `/members/${member.id}` };
    }
    if (has("등급")) {
      const gradeMap: Record<string, string> = { basic: "기본", premium: "프리미엄", vip: "VIP" };
      return { role: "bot", text: `${name} 회원 등급: ${gradeMap[member.grade] || member.grade}`, link: `/members/${member.id}` };
    }
    if (has("상태")) return { role: "bot", text: `${name} 회원 상태: ${member.status === "active" ? "활성" : "정지"}`, link: `/members/${member.id}` };
    if (has("시작일")) return { role: "bot", text: `${name} 회원 시작일: ${member.membershipStart || "미설정"}`, link: `/members/${member.id}` };
    if (has("메모", "특이사항")) return { role: "bot", text: `${name} 회원 특이사항: ${member.profileNote || "없음"}`, link: `/members/${member.id}` };
    if (has("생년월일")) return { role: "bot", text: `${name} 회원 생년월일: ${member.birthDate || "미등록"}`, link: `/members/${member.id}` };
    if (has("이메일")) return { role: "bot", text: `${name} 회원 이메일: ${member.email || "미등록"}`, link: `/members/${member.id}` };

    return null;
  }

  async function resolveAnswer(q: string): Promise<string> {
    const has = (...kws: string[]) => kws.some(k => q.includes(k));

    if (has("회원 몇", "회원 수", "총 회원", "현재 회원", "회원수", "몇명")) {
      const all = await utils.members.list.fetch();
      const active = all.filter(m => m.status === "active");
      const paused = all.filter(m => m.status === "paused");
      return `현재 등록 회원은 총 ${all.length}명이에요. (활성 ${active.length}명, 정지 ${paused.length}명)`;
    }
    if (has("이번달 마감", "이번 달 마감", "이달 마감", "이번달 만료", "이번 달 만료")) {
      const expiring = await utils.members.getExpiring.fetch({ days: 31 });
      const now = new Date();
      const thisMonth = expiring.filter(m => { const d = new Date(m.membershipEnd!); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
      if (thisMonth.length === 0) return "이번달에 만료 예정인 회원이 없어요.";
      const names = thisMonth.slice(0, 5).map(m => `${m.name}(${m.membershipEnd})`).join(", ");
      return `이번달 만료 예정 회원은 ${thisMonth.length}명이에요.\n${names}${thisMonth.length > 5 ? ` 외 ${thisMonth.length - 5}명` : ""}`;
    }
    if (has("신규 회원", "이번달 등록", "이번 달 등록", "신규")) {
      const all = await utils.members.list.fetch();
      const newMembers = all.filter(m => m.createdAt && String(m.createdAt).startsWith(yearMonth));
      if (newMembers.length === 0) return "이번달 신규 등록 회원이 없어요.";
      const names = newMembers.slice(0, 5).map(m => m.name).join(", ");
      return `이번달 신규 등록 회원은 ${newMembers.length}명이에요. (${names}${newMembers.length > 5 ? ` 외 ${newMembers.length - 5}명` : ""})`;
    }
    if (has("매출")) {
      if (has("오늘", "일일")) {
        const daily = await utils.trainers.getMonthlySettlement.fetch({ yearMonth, dateFilter: todayStr });
        return `오늘 매출은 ${daily.revenue.toLocaleString()}원이에요 (수업 ${daily.sessionCount}회, 세후 정산액 ${daily.afterTax.toLocaleString()}원).`;
      }
      const monthly = await utils.trainers.getMonthlySettlement.fetch({ yearMonth });
      return `이번달(${yearMonth.replace("-", "년 ")}월) 총 매출은 ${monthly.revenue.toLocaleString()}원, 세후 정산액은 ${monthly.afterTax.toLocaleString()}원이에요. (수업 ${monthly.sessionCount}회)`;
    }
    if (has("지출")) {
      const exp = await utils.expenses.list.fetch({ yearMonth });
      if (exp.count === 0) return "이번달 등록된 지출 내역이 없어요.";
      return `이번달 총 지출은 ${exp.total.toLocaleString()}원이에요 (${exp.count}건).`;
    }
    if (has("순수익", "정산")) {
      const [monthly, exp] = await Promise.all([utils.trainers.getMonthlySettlement.fetch({ yearMonth }), utils.expenses.list.fetch({ yearMonth })]);
      const net = monthly.afterTax - exp.total;
      return `이번달 순수익은 ${net.toLocaleString()}원이에요. (세후 정산액 ${monthly.afterTax.toLocaleString()}원 − 지출 ${exp.total.toLocaleString()}원)`;
    }
    if (has("미수금", "미납")) {
      const unpaid = await utils.members.getWithUnpaid.fetch();
      if (unpaid.length === 0) return "미수금이 있는 회원이 없어요. 깔끔합니다 👍";
      const total = unpaid.reduce((s, m) => s + (m.unpaidAmount ?? 0), 0);
      const names = unpaid.slice(0, 3).map(m => m.name).join(", ");
      return `미수금 회원은 ${unpaid.length}명, 총 ${total.toLocaleString()}원이에요. (${names}${unpaid.length > 3 ? ` 외 ${unpaid.length - 3}명` : ""})`;
    }
    if (has("만료", "만료임박")) {
      const expiring = await utils.members.getExpiring.fetch({ days: 7 });
      if (expiring.length === 0) return "7일 이내 만료 예정인 회원이 없어요.";
      const names = expiring.slice(0, 3).map(m => m.name).join(", ");
      return `7일 이내 만료 예정 회원은 ${expiring.length}명이에요. (${names}${expiring.length > 3 ? ` 외 ${expiring.length - 3}명` : ""})`;
    }
    if (has("6회", "재등록", "세션")) {
      const low = await utils.members.getLowSessions.fetch({ threshold: 6 });
      if (low.length === 0) return "잔여 세션이 적은(6회 이하) 회원이 없어요.";
      const names = low.slice(0, 3).map(m => m.name).join(", ");
      return `잔여 세션 6회 이하 회원은 ${low.length}명이에요. (${names}${low.length > 3 ? ` 외 ${low.length - 3}명` : ""}) 재등록 안내가 필요해 보여요.`;
    }
    if (has("PAR-Q", "PARQ", "파크", "건강검사")) {
      const missing = await utils.parQ.listMissing.fetch();
      if (missing.length === 0) return "모든 활성 회원이 PAR-Q를 작성했어요.";
      const names = missing.slice(0, 3).map(m => m.name).join(", ");
      return `PAR-Q 미기록 회원은 ${missing.length}명이에요. (${names}${missing.length > 3 ? ` 외 ${missing.length - 3}명` : ""})`;
    }
    if (has("오늘 수업", "오늘 출석", "오늘")) {
      const list = await utils.attendanceChecks.listByDate.fetch({ date: todayStr });
      const done = list.filter(m => m.check?.status === "attended").length;
      const total = list.filter(m => m.check).length;
      if (total === 0) return "오늘 기록된 수업이 아직 없어요.";
      return `오늘은 ${total}건 중 ${done}건 출석 처리됐어요.`;
    }
    if (has("이번달 수업", "이번 달 수업")) {
      const stats = await utils.pt.memberSessionStatsMonthly.fetch({ yearMonth });
      const total = stats.reduce((s, m) => s + Number(m.totalSessions), 0);
      return `이번달 총 수업 수는 ${total}회예요.`;
    }

    return "인식하지 못한 요청이에요. 이런 질문이 가능해요:\n" + QUICK_QUERY_CHIPS.map(c => `• ${c}`).join("\n") + "\n\n업무 명령:\n" + [...QUICK_SESSION_CHIPS, ...QUICK_ACTION_CHIPS].map(c => `• ${c}`).join("\n") + "\n• 이름+번호 입력 시 회원 등록 제안";
  }

  return (
    <>
      {/* 패널 */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "min(520px, calc(100dvh - 120px))" }}>
          {/* 헤더 */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
            <div className="w-5 h-5 rounded-md bg-teal-500/15 flex items-center justify-center">
              <MessageCircle className="h-3 w-3 text-teal-500" />
            </div>
            <span className="text-sm font-semibold flex-1">빠른 작업</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 칩 */}
          <div className="px-3 pt-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
            {QUICK_SESSION_CHIPS.map(c => (
              <button key={c} onClick={() => { setInput(c + " "); inputRef.current?.focus(); }} disabled={busy}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition-colors disabled:opacity-50">
                {c}
              </button>
            ))}
            {(chipsOpen ? QUICK_QUERY_CHIPS : CORE_QUERY_CHIPS).map(c => (
              <button key={c} onClick={() => ask(c)} disabled={busy}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 transition-colors disabled:opacity-50">
                {c}
              </button>
            ))}
            {QUICK_ACTION_CHIPS.map(c => (
              <button key={c} onClick={() => ask(c)} disabled={busy}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 transition-colors disabled:opacity-50">
                {c}
              </button>
            ))}
            <button onClick={() => setChipsOpen(v => !v)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:bg-accent/50 transition-colors flex items-center gap-0.5">
              {chipsOpen ? "접기" : "더보기"}
              <ChevronUp className={`h-3 w-3 transition-transform ${chipsOpen ? "" : "rotate-180"}`} />
            </button>
          </div>

          {/* 메시지 */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
            {messages.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-6">
                질문하거나 업무를 시켜보세요.<br />
                예: "홍길동 수업 완료", "이번달 매출"
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                  m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-accent/60 text-foreground rounded-bl-sm"
                }`}>
                  {m.text}
                  {m.confirm && (
                    <div className="mt-2 flex gap-2">
                      <button onClick={async () => {
                        setBusy(true);
                        try {
                          const result = await m.confirm!.action();
                          setMessages(msgs => {
                            const updated = [...msgs];
                            const idx = updated.indexOf(m);
                            if (idx >= 0) updated[idx] = { ...m, confirm: undefined };
                            return [...updated, result];
                          });
                        } catch { setMessages(msgs => [...msgs, { role: "bot", text: "처리 중 오류가 발생했어요." }]); }
                        finally { setBusy(false); }
                      }} disabled={busy}
                        className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 disabled:opacity-50">
                        {m.confirm.label}
                      </button>
                      <button onClick={() => setMessages(msgs => [...msgs, { role: "bot", text: "취소했어요." }])}
                        className="px-3 py-1 rounded-lg border border-border text-[11px] text-muted-foreground hover:bg-accent/50">
                        취소
                      </button>
                    </div>
                  )}
                  {m.link && (
                    <button onClick={() => { navigate(m.link!); setOpen(false); }}
                      className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                      상세 정보 보기 <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-accent/60 rounded-2xl rounded-bl-sm px-3 py-2 text-xs text-muted-foreground">확인 중...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력창 */}
          <div className="px-3 pb-3 pt-2 shrink-0 border-t border-border">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") ask(input); }}
                placeholder={pendingMode === "register" ? "이름 연락처를 입력하세요" : `${trainerName}님, 질문하거나 업무 명령`}
                className="flex-1 min-w-0 px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
              />
              <button onClick={() => ask(input)} disabled={busy || !input.trim()}
                className="w-9 h-9 rounded-xl bg-teal-500 text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-teal-600 transition-colors">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-5 right-4 z-50 w-13 h-13 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white shadow-lg transition-all active:scale-95 flex items-center justify-center"
        style={{ width: "52px", height: "52px" }}
        aria-label="빠른 작업"
      >
        {open
          ? <X className="h-5 w-5" />
          : <MessageCircle className="h-5 w-5" />
        }
      </button>
    </>
  );
}
