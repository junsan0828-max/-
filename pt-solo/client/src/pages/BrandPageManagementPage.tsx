import { Layers } from "lucide-react";
import TabBanner from "@/components/TabBanner";
import { BrandPageEditor } from "@/pages/Workshop";

export default function BrandPageManagementPage() {
  return (
    <div className="space-y-5 pb-8">
      <TabBanner tabKey="brand_page" />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Layers className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">브랜드 페이지</h1>
          <p className="text-xs text-muted-foreground">공개 프로필 구성 · 링크 관리</p>
        </div>
      </div>
      <BrandPageEditor />
    </div>
  );
}
