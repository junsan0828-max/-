import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import GymPlusAdminSection from "./gym-plus/GymPlusAdmin";

export default function GymPlusAdminPage() {
  const [, navigate] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">접근 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate("/admin")}
          className="text-muted-foreground text-sm hover:text-foreground transition-colors"
        >
          ← 뒤로
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-black text-sm">G</span>
          </div>
          <div>
            <span className="font-black text-sm text-foreground">ZIANT GYM</span>
            <span className="text-primary font-bold text-xs ml-1">+ 관리</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <GymPlusAdminSection />
      </main>
    </div>
  );
}
