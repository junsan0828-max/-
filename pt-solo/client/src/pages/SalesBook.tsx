import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen, Plus, Trash2, Copy, Check, Eye, RefreshCw, Save,
  ChevronDown, ChevronUp, Share2, Phone,
} from "lucide-react";

// ── 데이터 모델 ───────────────────────────────────────────────────────────────
export interface SalesBookData {
  theme: { color: string };
  cover: { title: string; subtitle: string; trainerName: string; photo?: string; area?: string };
  about: { headline: string; body: string; careers: string[]; certs: string[] };
  target: { items: string[] };
  process: { steps: { title: string; desc: string }[] };
  programs: { name: string; sessions: number; price: number; note: string }[];
  results: { items: { title: string; desc: string }[] };
  faq: { q: string; a: string }[];
  cta: { message: string; link: string; phone: string };
}

const won = (n: number) => (n > 0 ? `${Number(n).toLocaleString()}원` : "가격 문의");

// ── 공용 소형 입력 ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      {multiline ? (
        <textarea
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed min-h-[72px]"
          value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="text-[13px]" />
      )}
    </div>
  );
}

function ListEditor({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      {items.map((it, i) => (
        <div key={i} className="flex gap-1.5">
          <Input
            value={it} placeholder={placeholder} className="text-[13px]"
            onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <Button variant="ghost" size="icon" className="shrink-0"
            onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full text-[12px]" onClick={() => onChange([...items, ""])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> 항목 추가
      </Button>
    </div>
  );
}

function Section({ title, desc, children, defaultOpen }: {
  title: string; desc?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3.5 py-3 text-left">
        <div>
          <p className="font-semibold text-[14px]">{title}</p>
          {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-3.5 pb-3.5 space-y-3 border-t border-border/60 pt-3">{children}</div>}
    </div>
  );
}

// ── 트레이너용 에디터 (작업실 안에서 열림) ──────────────────────────────────────
export function SalesBookEditor() {
  const { data: book, isLoading } = trpc.salesBook.getMine.useQuery();
  const utils = trpc.useUtils();
  const [d, setD] = useState<SalesBookData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (book?.data && !d) setD(book.data as SalesBookData); }, [book]);

  const saveMutation = trpc.salesBook.save.useMutation({
    onSuccess: () => { toast.success("저장되었습니다"); setDirty(false); utils.salesBook.getMine.invalidate(); },
    onError: () => toast.error("저장에 실패했습니다"),
  });
  const regenMutation = trpc.salesBook.regenerate.useMutation({
    onSuccess: (draft) => { setD(draft as SalesBookData); setDirty(true); toast.success("현재 프로필·패키지로 초안을 다시 만들었습니다"); },
    onError: () => toast.error("초안 생성에 실패했습니다"),
  });

  if (isLoading || !d) return <p className="text-[13px] text-muted-foreground py-6 text-center">불러오는 중...</p>;

  const up = (patch: Partial<SalesBookData>) => { setD({ ...d, ...patch }); setDirty(true); };
  const shareUrl = book?.shareToken ? `${window.location.origin}/sb/${book.shareToken}` : "";
  const isPublic = !!book?.isPublic;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
    toast.success("링크가 복사되었습니다");
  };

  return (
    <div className="space-y-3">
      {/* 공유 바 */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary shrink-0" />
          <p className="text-[13px] font-semibold">상담 링크</p>
          <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full ${isPublic ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
            {isPublic ? "공개 중" : "비공개"}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground break-all">{shareUrl || "저장 후 링크가 생성됩니다"}</p>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="flex-1 text-[12px]" onClick={copyLink} disabled={!shareUrl || !isPublic}>
            {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />} 링크 복사
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-[12px]"
            onClick={() => window.open(shareUrl, "_blank")} disabled={!shareUrl || !isPublic}>
            <Eye className="h-3.5 w-3.5 mr-1" /> 미리보기
          </Button>
          <Button size="sm" className="flex-1 text-[12px]"
            onClick={() => saveMutation.mutate({ dataJson: JSON.stringify(d), isPublic: !isPublic })}>
            {isPublic ? "비공개로" : "공개하기"}
          </Button>
        </div>
      </div>

      <Section title="표지" desc="상담 시 첫 화면" defaultOpen>
        <Field label="제목" value={d.cover.title} onChange={(v) => up({ cover: { ...d.cover, title: v } })} />
        <Field label="한 줄 소개" value={d.cover.subtitle} multiline onChange={(v) => up({ cover: { ...d.cover, subtitle: v } })} />
        <Field label="활동 지역" value={d.cover.area || ""} onChange={(v) => up({ cover: { ...d.cover, area: v } })} />
      </Section>

      <Section title="전문가 소개" desc="경력 · 전문 분야">
        <Field label="제목" value={d.about.headline} onChange={(v) => up({ about: { ...d.about, headline: v } })} />
        <Field label="소개글" value={d.about.body} multiline onChange={(v) => up({ about: { ...d.about, body: v } })} />
        <ListEditor label="경력 · 실적" items={d.about.careers} placeholder="예: 경력 5년"
          onChange={(v) => up({ about: { ...d.about, careers: v } })} />
        <ListEditor label="전문 분야 · 자격" items={d.about.certs} placeholder="예: 체형교정"
          onChange={(v) => up({ about: { ...d.about, certs: v } })} />
      </Section>

      <Section title="이런 분께 추천" desc="타겟 고객 정의">
        <ListEditor label="추천 대상" items={d.target.items} onChange={(v) => up({ target: { items: v } })} />
      </Section>

      <Section title="진행 방식" desc="4단계 프로세스">
        {d.process.steps.map((s, i) => (
          <div key={i} className="space-y-1.5 border-b border-border/40 pb-3 last:border-0">
            <div className="flex gap-1.5">
              <Input value={s.title} className="text-[13px]"
                onChange={(e) => up({ process: { steps: d.process.steps.map((x, j) => j === i ? { ...x, title: e.target.value } : x) } })} />
              <Button variant="ghost" size="icon" className="shrink-0"
                onClick={() => up({ process: { steps: d.process.steps.filter((_, j) => j !== i) } })}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <Input value={s.desc} placeholder="설명" className="text-[13px]"
              onChange={(e) => up({ process: { steps: d.process.steps.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) } })} />
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full text-[12px]"
          onClick={() => up({ process: { steps: [...d.process.steps, { title: "", desc: "" }] } })}>
          <Plus className="h-3.5 w-3.5 mr-1" /> 단계 추가
        </Button>
      </Section>

      <Section title="프로그램 & 가격" desc="등록된 PT 패키지에서 자동 반영">
        {d.programs.map((p, i) => (
          <div key={i} className="space-y-1.5 border-b border-border/40 pb-3 last:border-0">
            <div className="flex gap-1.5">
              <Input value={p.name} placeholder="프로그램명" className="text-[13px]"
                onChange={(e) => up({ programs: d.programs.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
              <Button variant="ghost" size="icon" className="shrink-0"
                onClick={() => up({ programs: d.programs.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="flex gap-1.5">
              <Input type="number" value={p.price || ""} placeholder="총 금액" className="text-[13px]"
                onChange={(e) => up({ programs: d.programs.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x) })} />
              <Input value={p.note} placeholder="설명" className="text-[13px]"
                onChange={(e) => up({ programs: d.programs.map((x, j) => j === i ? { ...x, note: e.target.value } : x) })} />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full text-[12px]"
          onClick={() => up({ programs: [...d.programs, { name: "", sessions: 0, price: 0, note: "" }] })}>
          <Plus className="h-3.5 w-3.5 mr-1" /> 프로그램 추가
        </Button>
      </Section>

      <Section title="자주 묻는 질문">
        {d.faq.map((f, i) => (
          <div key={i} className="space-y-1.5 border-b border-border/40 pb-3 last:border-0">
            <div className="flex gap-1.5">
              <Input value={f.q} placeholder="질문" className="text-[13px]"
                onChange={(e) => up({ faq: d.faq.map((x, j) => j === i ? { ...x, q: e.target.value } : x) })} />
              <Button variant="ghost" size="icon" className="shrink-0"
                onClick={() => up({ faq: d.faq.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] min-h-[60px]"
              value={f.a} placeholder="답변"
              onChange={(e) => up({ faq: d.faq.map((x, j) => j === i ? { ...x, a: e.target.value } : x) })} />
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full text-[12px]"
          onClick={() => up({ faq: [...d.faq, { q: "", a: "" }] })}>
          <Plus className="h-3.5 w-3.5 mr-1" /> 질문 추가
        </Button>
      </Section>

      <Section title="마지막 안내 (CTA)" desc="상담 예약 · 연락처">
        <Field label="메시지" value={d.cta.message} onChange={(v) => up({ cta: { ...d.cta, message: v } })} />
        <Field label="예약 링크" value={d.cta.link} placeholder="/c/트레이너ID" onChange={(v) => up({ cta: { ...d.cta, link: v } })} />
        <Field label="연락처" value={d.cta.phone} onChange={(v) => up({ cta: { ...d.cta, phone: v } })} />
      </Section>

      <div className="flex gap-1.5 sticky bottom-2">
        <Button variant="outline" className="flex-1 text-[13px]"
          onClick={() => { if (confirm("현재 프로필과 PT 패키지로 초안을 다시 만듭니다. 작성한 내용은 사라집니다.")) regenMutation.mutate(); }}
          disabled={regenMutation.isPending}>
          <RefreshCw className="h-4 w-4 mr-1" /> 초안 재생성
        </Button>
        <Button className="flex-[2] text-[13px]"
          onClick={() => saveMutation.mutate({ dataJson: JSON.stringify(d) })}
          disabled={saveMutation.isPending || !dirty}>
          <Save className="h-4 w-4 mr-1" /> {dirty ? "저장하기" : "저장됨"}
        </Button>
      </div>
    </div>
  );
}

// ── 공개 세일즈북 (회원이 보는 화면) ──────────────────────────────────────────
export default function SalesBookPublic({ token }: { token: string }) {
  const { data, isLoading, error } = trpc.salesBook.getPublic.useQuery({ token });

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-neutral-400">불러오는 중...</p></div>;
  if (error || !data) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-2 px-6 text-center">
      <BookOpen className="h-8 w-8 text-neutral-300" />
      <p className="text-sm text-neutral-500">공개된 세일즈북을 찾을 수 없습니다.</p>
    </div>
  );

  const d = data.data as SalesBookData;
  const color = d.theme?.color || "#1a00ff";

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* 표지 */}
      <div className="px-6 pt-14 pb-12 text-white" style={{ backgroundColor: color }}>
        {(d.cover.photo || data.profileImage) && (
          <img src={d.cover.photo || data.profileImage} alt=""
            className="w-20 h-20 rounded-full object-cover mb-4 ring-4 ring-white/20" />
        )}
        <p className="text-[13px] opacity-80">{d.cover.area}</p>
        <h1 className="text-[26px] font-bold leading-tight mt-1">{d.cover.title}</h1>
        <p className="text-[14px] opacity-90 mt-3 leading-relaxed whitespace-pre-line">{d.cover.subtitle}</p>
        <p className="text-[13px] opacity-70 mt-5">{d.cover.trainerName || data.trainerName} 트레이너</p>
      </div>

      {/* 전문가 소개 */}
      <section className="px-6 py-10 border-b border-neutral-100">
        <h2 className="text-[19px] font-bold">{d.about.headline}</h2>
        <p className="text-[14px] text-neutral-600 leading-relaxed mt-3 whitespace-pre-line">{d.about.body}</p>
        {d.about.careers?.filter(Boolean).length > 0 && (
          <ul className="mt-5 space-y-2">
            {d.about.careers.filter(Boolean).map((c, i) => (
              <li key={i} className="flex gap-2 text-[14px] text-neutral-700">
                <span style={{ color }}>·</span>{c}
              </li>
            ))}
          </ul>
        )}
        {d.about.certs?.filter(Boolean).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-5">
            {d.about.certs.filter(Boolean).map((c, i) => (
              <span key={i} className="text-[12px] px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${color}12`, color }}>{c}</span>
            ))}
          </div>
        )}
      </section>

      {/* 추천 대상 */}
      {d.target?.items?.filter(Boolean).length > 0 && (
        <section className="px-6 py-10 bg-neutral-50 border-b border-neutral-100">
          <h2 className="text-[19px] font-bold">이런 분께 추천합니다</h2>
          <ul className="mt-4 space-y-2.5">
            {d.target.items.filter(Boolean).map((it, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] text-neutral-700 leading-relaxed">
                <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color }} />{it}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 진행 방식 */}
      {d.process?.steps?.length > 0 && (
        <section className="px-6 py-10 border-b border-neutral-100">
          <h2 className="text-[19px] font-bold">진행 방식</h2>
          <div className="mt-5 space-y-4">
            {d.process.steps.map((s, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[12px] font-bold text-white"
                  style={{ backgroundColor: color }}>{i + 1}</div>
                <div>
                  <p className="font-semibold text-[14px]">{s.title}</p>
                  <p className="text-[13px] text-neutral-600 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 프로그램 */}
      {d.programs?.length > 0 && (
        <section className="px-6 py-10 bg-neutral-50 border-b border-neutral-100">
          <h2 className="text-[19px] font-bold">프로그램 안내</h2>
          <div className="mt-4 space-y-2.5">
            {d.programs.map((p, i) => (
              <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-[15px]">{p.name}</p>
                  <p className="font-bold text-[15px]" style={{ color }}>{won(p.price)}</p>
                </div>
                {p.note && <p className="text-[12px] text-neutral-500 mt-1">{p.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      {d.faq?.length > 0 && (
        <section className="px-6 py-10 border-b border-neutral-100">
          <h2 className="text-[19px] font-bold">자주 묻는 질문</h2>
          <div className="mt-4 space-y-4">
            {d.faq.map((f, i) => (
              <div key={i}>
                <p className="font-semibold text-[14px]">Q. {f.q}</p>
                <p className="text-[13px] text-neutral-600 mt-1 leading-relaxed whitespace-pre-line">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="px-6 py-12 text-center">
        <p className="text-[16px] font-semibold">{d.cta?.message}</p>
        <div className="mt-5 flex flex-col gap-2">
          {d.cta?.link && (
            <a href={d.cta.link} className="w-full py-3.5 rounded-xl text-white font-semibold text-[15px]"
              style={{ backgroundColor: color }}>상담 예약하기</a>
          )}
          {d.cta?.phone && (
            <a href={`tel:${d.cta.phone}`}
              className="w-full py-3.5 rounded-xl border border-neutral-200 font-semibold text-[15px] flex items-center justify-center gap-2">
              <Phone className="h-4 w-4" /> {d.cta.phone}
            </a>
          )}
        </div>
        <p className="text-[11px] text-neutral-400 mt-8">Powered by FIT STEP</p>
      </section>
    </div>
  );
}
