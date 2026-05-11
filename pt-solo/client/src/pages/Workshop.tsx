import { Card, CardContent } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import TabBanner from "@/components/TabBanner";

export default function Workshop() {
  return (
    <div className="space-y-4">
      <TabBanner tabKey="workshop" />
      <div>
        <h1 className="text-xl font-bold">작업실</h1>
        <p className="text-sm text-muted-foreground mt-0.5">트레이너 전용 작업 공간</p>
      </div>
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Wrench className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">준비 중입니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
