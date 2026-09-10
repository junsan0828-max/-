import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ReportBrandingEditor() {
  const utils = trpc.useUtils();
  const { data: brand } = trpc.brand.getMyBrand.useQuery();
  const updateMutation = trpc.brand.updateMyBrand.useMutation({
    onSuccess: () => { utils.brand.getMyBrand.invalidate(); toast.success("저장되었습니다"); },
    onError: (e) => toast.error(e.message),
  });

  const [msgDraft, setMsgDraft] = useState((brand as any)?.brandMessage ?? "");
  useEffect(() => { setMsgDraft((brand as any)?.brandMessage ?? ""); }, [brand]);

  const brandColor = (brand as any)?.brandColor || "#1a80ff";
  const brandMsg = (brand as any)?.brandMessage || "";

  return (
    <div className="space-y-4">
      {/* 미리보기 */}
      <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">미리보기 · 공유 보고서 상단</p>
        <div className="rounded-lg overflow-hidden border border-border">
          <div className="h-2" style={{ background: brandColor }} />
          <div className="flex items-center gap-3 p-3 bg-background">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
              style={{ backgroundColor: brandColor }}>
              {(brand as any)?.trainerName?.[0] ?? "T"}
            </div>
            <div>
              <p className="text-sm font-semibold">{(brand as any)?.trainerName ?? "STEPER 이름"}</p>
              <p className="text-xs text-muted-foreground">STEPER · Powered by FIT STEP</p>
            </div>
          </div>
          {brandMsg && (
            <div className="px-3 pb-3">
              <p className="text-xs rounded-lg px-3 py-2 font-medium" style={{ backgroundColor: `${brandColor}18`, color: brandColor }}>
                💬 {brandMsg}
              </p>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">공유 보고서에 위 형태로 표시됩니다.</p>
      </div>

      {/* 브랜드 컬러 */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">브랜드 컬러</Label>
        <div className="flex items-center gap-3">
          <input type="color" value={brandColor}
            onChange={(e) => updateMutation.mutate({ brandColor: e.target.value } as any)}
            className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent" />
          <span className="text-sm text-muted-foreground">{brandColor}</span>
        </div>
      </div>

      {/* 인사 메시지 */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">인사 메시지</Label>
        <p className="text-[12px] text-muted-foreground">보고서 상단에 표시되는 짧은 한 마디입니다.</p>
        <div className="flex gap-2">
          <Input
            value={msgDraft}
            onChange={e => setMsgDraft(e.target.value)}
            placeholder="오늘도 수고했습니다 💪"
            maxLength={50}
            className="h-9 text-sm flex-1"
          />
          <Button size="sm" disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ brandMessage: msgDraft } as any)}>
            저장
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-right">{msgDraft.length}/50</p>
      </div>

      <p className="text-xs text-muted-foreground">이름·프로필 사진은 내 프로필 페이지에서 변경할 수 있습니다.</p>
    </div>
  );
}
