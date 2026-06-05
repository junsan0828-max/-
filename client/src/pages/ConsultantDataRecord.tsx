import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ClipboardList, ChevronLeft, ChevronRight, Save,
  Megaphone, Building2, CheckSquare, Square, Camera, X, ImageIcon,
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
  images: string[];
  memo: string;
};

const EMPTY: RecordForm = {
  blogPosts: 0, instagramPosts: 0, youtubeVideos: 0,
  offlineEvents: 0, referralCount: 0, snsFollowers: "",
  adSpend: 0, churnCount: 0, churnReasons: [], images: [], memo: "",
};

function toDateStr(d: Date) { return d.toISOString().substring(0, 10); }

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_LABELS[d.getDay()]})`;
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_W = 1200;
      let { width, height } = img;
      if (width > MAX_W) { height = Math.round(height * MAX_W / width); width = MAX_W; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지 로드 실패")); };
    img.src = url;
  });
}

export default function ConsultantDataRecordPage() {
  const today = toDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [section, setSection] = useState<"marketing" | "operations">("marketing");
  const [form, setForm] = useState<RecordForm>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [viewImg, setViewImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const year = parseInt(selectedDate.split("-")[0]);
  const month = parseInt(selectedDate.split("-")[1]);

  const { data: existing, isLoading } = trpc.consultantRecords.getByDate.useQuery({ date: selectedDate });
  const { data: monthRecords } = trpc.consultantRecords.listByMonth.useQuery({ year, month });
  const utils = trpc.useUtils();

  const saveMutation = trpc.consultantRecords.saveByDate.useMutation({
    onSuccess: () => {
      toast.success("저장됐습니다");
      setDirty(false);
      utils.consultantRecords.invalidate();
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
        churnReasons: Array.isArray(existing.churnReasons) ? existing.churnReasons : [],
        images: Array.isArray(existing.images) ? existing.images : [],
        memo: existing.memo ?? "",
      });
    } else {
      setForm(EMPTY);
    }
    setDirty(false);
  }, [existing]);

  function prevDay() {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(toDateStr(d));
  }
  function nextDay() {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    if (toDateStr(d) <= today) setSelectedDate(toDateStr(d));
  }

  function setField<K extends keyof RecordForm>(key: K, value: RecordForm[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setDirty(true);
  }

  function toggleReason(r: string) {
    const next = form.churnReasons.includes(r)
      ? form.churnReasons.filter(x => x !== r)
      : [...form.churnReasons, r];
    setField("churnReasons", next);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (form.images.length + files.length > 5) {
      toast.error("최대 5장까지 첨부 가능합니다");
      return;
    }
    try {
      toast.loading("이미지 처리 중...", { id: "img-compress" });
      const compressed = await Promise.all(files.map(compressImage));
      setField("images", [...form.images, ...compressed]);
      toast.dismiss("img-compress");
    } catch {
      toast.dismiss("img-compress");
      toast.error("이미지 처리 실패");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSave() {
    saveMutation.mutate({
      date: selectedDate,
      blogPosts: form.blogPosts,
      instagramPosts: form.instagramPosts,
      youtubeVideos: form.youtubeVideos,
      offlineEvents: form.offlineEvents,
      referralCount: form.referralCount,
      snsFollowers: form.snsFollowers !== "" ? Number(form.snsFollowers) : null,
      adSpend: form.adSpend,
      churnCount: form.churnCount,
      churnReasons: form.churnReasons,
      images: form.images,
      memo: form.memo,
    });
  }

  const recordDates = new Set((monthRecords ?? []).map((r: any) => r.date));
  const daysInMonth = new Date(year, month, 0).getDate();

  function NumField({ label, field, unit = "건" }: { label: string; field: keyof RecordForm; unit?: string }) {
    const val = form[field] as number;
    return (
      <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-sm text-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => val > 0 && setField(field, (val - 1) as any)}
            className="w-7 h-7 rounded-lg bg-muted text-foreground text-lg font-bold flex items-center justify-center hover:bg-accent transition-colors">−</button>
          <span className="w-10 text-center text-sm font-semibold tabular-nums">
            {val}<span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
          </span>
          <button onClick={() => setField(field, (val + 1) as any)}
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
          <button onClick={handleSave} disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "저장 중..." : "저장"}
          </button>
        )}
      </div>

      {/* 날짜 선택 + 이달 현황 dots */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <button onClick={prevDay} className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <label className="relative text-sm font-semibold text-foreground cursor-pointer select-none text-center">
            {formatDateLabel(selectedDate)}
            <input
              type="date" value={selectedDate} max={today}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>
          <button onClick={nextDay} disabled={selectedDate >= today}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* 이달 날짜 dots */}
        <div className="px-2 py-2 flex gap-0.5 overflow-x-auto">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
            const hasRecord = recordDates.has(d);
            const isSelected = d === selectedDate;
            const isFuture = d > today;
            return (
              <button
                key={d}
                onClick={() => !isFuture && setSelectedDate(d)}
                disabled={isFuture}
                className={`flex flex-col items-center shrink-0 w-8 rounded-lg py-1 text-xs transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isFuture
                    ? "text-muted-foreground/30 cursor-not-allowed"
                    : "hover:bg-accent text-muted-foreground"
                }`}
              >
                <span>{i + 1}</span>
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                  hasRecord && !isSelected ? "bg-emerald-400" : "bg-transparent"
                }`} />
              </button>
            );
          })}
        </div>
      </div>

      {existing && (
        <p className="text-xs text-muted-foreground">
          마지막 저장: {existing.updatedAt?.substring(0, 16).replace("T", " ")}
        </p>
      )}

      {/* 사진 첨부 */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-blue-400" />
            사진 첨부
          </p>
          <span className="text-xs text-muted-foreground">{form.images.length}/5</span>
        </div>

        {form.images.length === 0 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border hover:border-primary/50 rounded-xl py-6 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ImageIcon className="h-8 w-8 opacity-40" />
            <span className="text-sm">사진을 추가하세요</span>
            <span className="text-xs opacity-70">광고 데이터 스크린샷 등</span>
          </button>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {form.images.map((img, idx) => (
              <div key={idx} className="relative">
                <img
                  src={img} alt={`첨부 ${idx + 1}`}
                  onClick={() => setViewImg(img)}
                  className="w-20 h-20 object-cover rounded-lg border border-border cursor-pointer"
                />
                <button
                  onClick={() => setField("images", form.images.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {form.images.length < 5 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 border-2 border-dashed border-border hover:border-primary/50 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <Camera className="h-6 w-6" />
              </button>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* 섹션 탭 */}
      <div className="grid grid-cols-2 gap-2">
        {([
          { key: "marketing" as const, label: "마케팅", icon: Megaphone, color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
          { key: "operations" as const, label: "센터 운영", icon: Building2, color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
        ] as const).map(tab => {
          const Icon = tab.icon;
          const isActive = section === tab.key;
          return (
            <button key={tab.key} onClick={() => setSection(tab.key)}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-colors ${isActive ? tab.color : "bg-card border-border text-muted-foreground hover:bg-accent"}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">불러오는 중...</div>
      ) : (
        <>
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
            </div>
          )}

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
                placeholder="오늘 특이사항, 이벤트 진행 내용 등을 자유롭게 입력하세요"
                rows={4}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
              />
            </div>
          )}

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

      {/* 이미지 전체화면 보기 */}
      {viewImg && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewImg(null)}
        >
          <button
            onClick={() => setViewImg(null)}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
          >
            <X className="h-5 w-5" />
          </button>
          <img src={viewImg} alt="첨부 이미지" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
