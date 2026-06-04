import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ClipboardList, ChevronLeft, ChevronRight, Save,
  Megaphone, Building2, CheckSquare, Square,
} from "lucide-react";

const CHURN_REASONS = ["가격", "시간 부족", "이사/이직", "건강 문제", "목표 달성", "서비스 불만", "기타"];

type RecordForm = {
  blogPosts: number;
  instagramPosts: number;
  youtubeVideos: number;
  offlineEvents: number;
  referralCount: number;
  snsFollowers: string;
  adSpend: number;
  churnCount: number;
  churnReasons: string[];
  memo: string;
};

const EMPTY: RecordForm = {
  blogPosts: 0, instagramPosts: 0, youtubeVideos: 0,
  offlineEvents: 0, referralCount: 0, snsFollowers: "",
  adSpend: 0, churnCount: 0, churnReasons: [], memo: "",
};

export default function ConsultantDataRecordPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [section, setSection] = useState<"marketing" | "operations">("marketing");
  const [form, setForm] = useState<RecordForm>(EMPTY);
  const [dirty, setDirty] = useState(false);

  const { data: existing, isLoading } = trpc.consultantRecords.get.useQuery({ year, month });
  const utils = trpc.useUtils();
  const saveMutation = trpc.consultantRecords.save.useMutation({
    onSuccess: () => {
      toast.success("기록이 저장됐습니다");
      setDirty(false);
      utils.consultantRecords.get.invalidate();
    },
    onError: () => toast.error("저장 실패"),
  });

  useEffect(() => {
    if (existing) {
      setForm({
        blogPosts: existing.blogPosts ?? 0,
        instagramPosts: existing.instagramPosts ?? 0,
        youtubeVideos: existing.youtubeVideos ?? 0,
        offlineEvents: existing.offlineEvents ?? 0,
        referralCount: existing.referralCount ?? 0,
        snsFollowers: existing.snsFollowers != null ? String(existing.snsFollowers) : "",
        adSpend: existing.adSpend ?? 0,
        churnCount: existing.churnCount ?? 0,
        churnReasons: (() => { try { return JSON.parse(existing.churnReasons ?? "[]"); } catch { return []; } })(),
        memo: existing.memo ?? "",
      });
    } else {
      setForm(EMPTY);
    }
    setDirty(false);
  }, [existing]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  function set<K extends keyof RecordForm>(key: K, value: RecordForm[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setDirty(true);
  }

  function toggleReason(r: string) {
    const next = form.churnReasons.includes(r)
      ? form.churnReasons.filter(x => x !== r)
      : [...form.churnReasons, r];
    set("churnReasons", next);
  }

  function handleSave() {
    saveMutation.mutate({
      year, month,
      blogPosts: form.blogPosts,
      instagramPosts: form.instagramPosts,
      youtubeVideos: form.youtubeVideos,
      offlineEvents: form.offlineEvents,
      referralCount: form.referralCount,
      snsFollowers: form.snsFollowers !== "" ? Number(form.snsFollowers) : null,
      adSpend: form.adSpend,
      churnCount: form.churnCount,
      churnReasons: form.churnReasons,
      memo: form.memo,
    });
  }

  function NumField({ label, field, unit = "건" }: { label: string; field: keyof RecordForm; unit?: string }) {
    const val = form[field] as number;
    return (
      <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-sm text-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => val > 0 && set(field, (val - 1) as any)}
            className="w-7 h-7 rounded-lg bg-muted text-foreground text-lg font-bold flex items-center justify-center hover:bg-accent transition-colors">−</button>
          <span className="w-10 text-center text-sm font-semibold tabular-nums">{val}<span className="text-xs text-muted-foreground ml-0.5">{unit}</span></span>
          <button onClick={() => set(field, (val + 1) as any)}
            className="w-7 h-7 rounded-lg bg-muted text-foreground text-lg font-bold flex items-center justify-center hover:bg-accent transition-colors">+</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          데이터 기록
        </h1>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "저장 중..." : "저장"}
          </button>
        )}
      </div>

      {/* 월 선택 */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 w-fit">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-semibold w-20 text-center">{year}년 {month}월</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
      </div>

      {existing && (
        <p className="text-xs text-muted-foreground">
          마지막 저장: {existing.updatedAt?.substring(0, 16).replace("T", " ")}
        </p>
      )}

      {/* 섹션 탭 */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { key: "marketing" as const, label: "마케팅", icon: Megaphone, color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
          { key: "operations" as const, label: "센터 운영", icon: Building2, color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
        ].map(t => {
          const Icon = t.icon;
          const isActive = section === t.key;
          return (
            <button key={t.key} onClick={() => setSection(t.key)}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-colors ${isActive ? t.color : "bg-card border-border text-muted-foreground hover:bg-accent"}`}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">불러오는 중...</div>
      ) : (
        <>
          {/* 마케팅 섹션 */}
          {section === "marketing" && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">콘텐츠 실적</h2>
              <NumField label="블로그 포스팅" field="blogPosts" />
              <NumField label="인스타그램 게시물" field="instagramPosts" />
              <NumField label="유튜브 영상" field="youtubeVideos" />
              <NumField label="오프라인 이벤트/행사" field="offlineEvents" />

              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-1">유입 & 광고</h2>
              <NumField label="지인 추천 건" field="referralCount" />
              <NumField label="광고 집행 금액" field="adSpend" unit="원" />

              {/* SNS 팔로워 (텍스트 입력) */}
              <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-sm text-foreground">SNS 팔로워 수</p>
                <input
                  type="number"
                  value={form.snsFollowers}
                  onChange={e => { setForm(f => ({ ...f, snsFollowers: e.target.value })); setDirty(true); }}
                  placeholder="숫자 입력"
                  className="w-28 text-right text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none border-b border-border focus:border-primary"
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-400">입력한 데이터는 어드민 데이터 관리 → 마케팅 탭에 반영됩니다.</p>
              </div>
            </div>
          )}

          {/* 센터 운영 섹션 */}
          {section === "operations" && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">해지 현황</h2>
              <NumField label="해지 상담 건수" field="churnCount" />

              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">해지 사유 (복수 선택)</p>
                <div className="grid grid-cols-2 gap-2">
                  {CHURN_REASONS.map(r => {
                    const selected = form.churnReasons.includes(r);
                    return (
                      <button key={r} onClick={() => toggleReason(r)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${selected ? "bg-red-500/15 text-red-400 border-red-500/30" : "border-border text-muted-foreground hover:bg-accent"}`}>
                        {selected ? <CheckSquare className="h-4 w-4 shrink-0" /> : <Square className="h-4 w-4 shrink-0" />}
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-1">메모</h2>
              <textarea
                value={form.memo}
                onChange={e => { setForm(f => ({ ...f, memo: e.target.value })); setDirty(true); }}
                placeholder="이번 달 특이사항, 이벤트 진행 내용 등을 자유롭게 입력하세요"
                rows={4}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
              />

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-400">입력한 데이터는 어드민 데이터 관리 → 센터 운영 탭에 반영됩니다.</p>
              </div>
            </div>
          )}

          {/* 하단 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || !dirty}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 inline mr-1.5" />
            {saveMutation.isPending ? "저장 중..." : dirty ? "저장하기" : "저장됨"}
          </button>
        </>
      )}
    </div>
  );
}
