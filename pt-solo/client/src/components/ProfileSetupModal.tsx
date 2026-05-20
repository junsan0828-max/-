import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, Briefcase, MapPin, Clock3, Camera, X, ChevronRight } from "lucide-react";

const BEBAS = { fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif", letterSpacing: "0.12em" };
const SESSION_KEY = "profile-modal-dismissed";

const STEPS = [
  { icon: Camera,   label: "프로필 사진", desc: "나를 소개하는 사진" },
  { icon: Briefcase, label: "직무 선택",  desc: "퍼스널트레이너, 필라테스강사 등" },
  { icon: Clock3,    label: "경력 선택",  desc: "준비중, 1년미만, 1~3년 등" },
  { icon: MapPin,    label: "활동지역",   desc: "주로 활동하는 지역" },
];

export default function ProfileSetupModal() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { data: profile, isSuccess } = trpc.trainers.getMyProfile.useQuery();

  useEffect(() => {
    if (!isSuccess) return;
    if (!profile) return;
    if (profile.profileBonusGranted) return;          // 이미 완성
    if (sessionStorage.getItem(SESSION_KEY)) return;  // 이번 세션 이미 봄
    // 약간 딜레이 후 표시 (화면 로드 후)
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [isSuccess, profile]);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(false);
  };

  const goProfile = () => {
    dismiss();
    setLocation("/profile");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-border bg-card gap-0 [&>button]:hidden">
        {/* 헤더 배경 */}
        <div className="relative bg-gradient-to-br from-primary/30 via-primary/10 to-background px-6 pt-8 pb-6 text-center">
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>

          {/* 포인트 뱃지 */}
          <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/40 rounded-full px-4 py-1.5 mb-4">
            <Coins className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">+200 FIT POINT 증정</span>
          </div>

          <h2 className="text-xl font-bold mb-1">나의 프로필을 완성하세요!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            트레이너 정보를 입력하면<br />
            <span className="text-primary font-semibold">FIT POINT 200P</span>를 즉시 드립니다
          </p>
        </div>

        {/* 항목 리스트 */}
        <div className="px-6 py-4 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground mb-3">입력할 정보 (총 4가지)</p>
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-accent/30 border border-border">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 버튼 */}
        <div className="px-6 pb-6 space-y-2">
          <Button className="w-full gap-2 h-11 text-base" onClick={goProfile}>
            <span style={BEBAS} className="text-lg tracking-wider">프로필 설정하고 200P 받기</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <button
            onClick={dismiss}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5"
          >
            나중에 할게요
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
