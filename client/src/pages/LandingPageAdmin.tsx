import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Save, Globe, ExternalLink } from "lucide-react";

type SettingsMap = Record<string, string>;

const DEFAULTS: SettingsMap = {
  naver_place_url: "https://booking.naver.com/booking/13/bizes/YOUR_ID",
  kakao_channel_url: "https://pf.kakao.com/_YOUR_ID",
  phone_number: "010-0000-0000",
  address: "경기도 시흥시 정왕동",
  map_url: "https://map.naver.com/v5/search/자이언트짐",
  hours_weekday: "평일 08:00 ~ 23:00",
  hours_saturday: "토요일 10:00 ~ 17:00",
  gym_price_1m: "80,000원",
  gym_price_3m: "159,000원",
  gym_price_6m: "216,000원",
  gym_price_12m: "312,000원",
  pt_price_10: "500,000원",
  pt_price_20: "960,000원",
};

export default function LandingPageAdmin() {
  const { data: savedSettings, refetch } = trpc.landing.getSettings.useQuery();
  const saveMutation = trpc.landing.saveSettings.useMutation({
    onSuccess: () => {
      toast.success("저장되었습니다.");
      refetch();
    },
    onError: () => toast.error("저장 실패"),
  });

  const [form, setForm] = useState<SettingsMap>(DEFAULTS);

  useEffect(() => {
    if (savedSettings) {
      setForm({ ...DEFAULTS, ...savedSettings });
    }
  }, [savedSettings]);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => saveMutation.mutate(form);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">랜딩페이지 관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/landing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            랜딩페이지 보기
          </a>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* 연락처 & URL */}
      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="text-base font-bold border-b border-border pb-3">연락처 & 예약 링크</h2>
        <Field label="전화번호" value={form.phone_number} onChange={(v) => set("phone_number", v)} placeholder="010-0000-0000" />
        <Field label="네이버 플레이스 예약 URL" value={form.naver_place_url} onChange={(v) => set("naver_place_url", v)} placeholder="https://booking.naver.com/..." />
        <Field label="카카오 채널 URL" value={form.kakao_channel_url} onChange={(v) => set("kakao_channel_url", v)} placeholder="https://pf.kakao.com/..." />
      </section>

      {/* 위치 정보 */}
      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="text-base font-bold border-b border-border pb-3">위치 & 운영시간</h2>
        <Field label="주소" value={form.address} onChange={(v) => set("address", v)} placeholder="경기도 시흥시 정왕동" />
        <Field label="지도 URL" value={form.map_url} onChange={(v) => set("map_url", v)} placeholder="https://map.naver.com/..." />
        <Field label="운영시간 (평일)" value={form.hours_weekday} onChange={(v) => set("hours_weekday", v)} placeholder="평일 08:00 ~ 23:00" />
        <Field label="운영시간 (토요일)" value={form.hours_saturday} onChange={(v) => set("hours_saturday", v)} placeholder="토요일 10:00 ~ 17:00" />
      </section>

      {/* 헬스 이용권 가격 */}
      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="text-base font-bold border-b border-border pb-3">헬스 이용권 가격</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="1개월" value={form.gym_price_1m} onChange={(v) => set("gym_price_1m", v)} placeholder="80,000원" />
          <Field label="3개월" value={form.gym_price_3m} onChange={(v) => set("gym_price_3m", v)} placeholder="159,000원" />
          <Field label="6개월" value={form.gym_price_6m} onChange={(v) => set("gym_price_6m", v)} placeholder="216,000원" />
          <Field label="12개월" value={form.gym_price_12m} onChange={(v) => set("gym_price_12m", v)} placeholder="312,000원" />
        </div>
      </section>

      {/* PT 가격 */}
      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="text-base font-bold border-b border-border pb-3">개인 맞춤 PT 가격</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="10회" value={form.pt_price_10} onChange={(v) => set("pt_price_10", v)} placeholder="500,000원" />
          <Field label="20회" value={form.pt_price_20} onChange={(v) => set("pt_price_20", v)} placeholder="960,000원" />
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? "저장 중..." : "변경사항 저장"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
