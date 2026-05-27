import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BasicInfoModal({ currentName, onClose }: { currentName: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState("");

  const updateProfile = trpc.trainers.updateMyProfile.useMutation({
    onSuccess: () => {
      utils.trainers.getMyProfile.invalidate();
      toast.success("프로필이 저장되었습니다.");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    if (!name.trim()) { toast.error("이름을 입력해주세요."); return; }
    updateProfile.mutate({ trainerName: name.trim(), phone: phone.trim() || undefined });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-primary to-primary/70 px-6 py-6 text-white text-center space-y-1">
          <p className="text-lg font-bold">기본 정보를 입력해주세요</p>
          <p className="text-sm text-white/80">실명과 연락처를 등록하면 회원 관리가 편해집니다.</p>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              이름 <span className="text-red-400">*</span>
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="실명을 입력하세요"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              연락처
            </Label>
            <Input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="h-11"
            />
          </div>

          <Button
            className="w-full h-11 mt-2"
            disabled={updateProfile.isPending}
            onClick={handleSubmit}
          >
            {updateProfile.isPending ? "저장 중..." : "저장하고 시작하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
