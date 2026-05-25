import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { GraduationCap, Plus, Edit2, Trash2, Play, CheckCircle, Coins, Clock, Eye, EyeOff, X, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TabBanner from "@/components/TabBanner";

type Course = {
  id: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: string | null;
  pointReward: number;
  isPublished: number;
  completed: boolean;
};

const EMPTY_FORM = {
  title: "",
  description: "",
  videoUrl: "",
  thumbnailUrl: "",
  duration: "",
  pointReward: 0,
  isPublished: 1,
};

function CourseForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: typeof EMPTY_FORM;
  onSave: (v: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof EMPTY_FORM, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4 bg-card border border-border rounded-2xl p-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">제목 *</Label>
        <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="강의 제목" className="text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">설명</Label>
        <textarea
          value={form.description}
          onChange={e => set("description", e.target.value)}
          rows={3}
          placeholder="강의 내용을 간략히 설명하세요..."
          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">영상 URL</Label>
          <Input value={form.videoUrl} onChange={e => set("videoUrl", e.target.value)} placeholder="https://youtube.com/..." className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">썸네일 URL</Label>
          <Input value={form.thumbnailUrl} onChange={e => set("thumbnailUrl", e.target.value)} placeholder="https://..." className="text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">강의 시간</Label>
          <Input value={form.duration} onChange={e => set("duration", e.target.value)} placeholder="예: 20분" className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">참여 포인트 지급 (P)</Label>
          <Input
            type="number"
            min={0}
            value={form.pointReward}
            onChange={e => set("pointReward", parseInt(e.target.value) || 0)}
            placeholder="0"
            className="text-sm"
          />
        </div>
      </div>
      <div className="flex items-center justify-between p-3 bg-accent/30 rounded-xl">
        <div>
          <p className="text-sm font-medium">게시 여부</p>
          <p className="text-xs text-muted-foreground">{form.isPublished ? "트레이너에게 공개됩니다" : "임시저장 (비공개)"}</p>
        </div>
        <button
          type="button"
          onClick={() => set("isPublished", form.isPublished ? 0 : 1)}
          className={`w-12 h-6 rounded-full transition-colors relative ${form.isPublished ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.isPublished ? "left-6" : "left-0.5"}`} />
        </button>
      </div>
      <div className="flex gap-3 pt-1">
        <Button variant="outline" className="flex-1" onClick={onCancel}>취소</Button>
        <Button className="flex-1" disabled={saving || !form.title.trim()} onClick={() => onSave(form)}>
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}

export default function Academy() {
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";

  const { data: courses = [], isLoading } = trpc.academy.list.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const createMutation = trpc.academy.create.useMutation({
    onSuccess: () => { utils.academy.list.invalidate(); setShowCreate(false); toast.success("강의가 등록되었습니다"); },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.academy.update.useMutation({
    onSuccess: () => { utils.academy.list.invalidate(); setEditId(null); toast.success("수정되었습니다"); },
    onError: e => toast.error(e.message),
  });
  const deleteMutation = trpc.academy.delete.useMutation({
    onSuccess: () => { utils.academy.list.invalidate(); setConfirmDeleteId(null); toast.success("삭제되었습니다"); },
    onError: e => toast.error(e.message),
  });
  const completeMutation = trpc.academy.complete.useMutation({
    onSuccess: (data) => {
      utils.academy.list.invalidate();
      utils.fitPoints.getBalance.invalidate();
      if (data.pointReward > 0) {
        toast.success(`강의 완료! ${data.pointReward.toLocaleString()}P 지급되었습니다`);
      } else {
        toast.success("강의 완료 처리되었습니다");
      }
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <TabBanner tabKey="academy" />

      {/* 헤더 */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 text-white space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            <span className="font-bold text-lg">성장 아카데미</span>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setShowCreate(v => !v); setEditId(null); }}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
            >
              {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showCreate ? "취소" : "강의 추가"}
            </button>
          )}
        </div>
        <p className="text-sm text-white/80 leading-relaxed">
          매출을 늘리고 싶은 트레이너를 위한 실전 강의. 상담·브랜딩·PT 프로그래밍까지 배우고 포인트도 받으세요.
        </p>
        <div className="flex items-center gap-4 pt-1">
          <div className="text-center">
            <p className="font-bold text-xl">{(courses as Course[]).filter(c => c.isPublished).length}</p>
            <p className="text-xs text-white/70">강의</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="font-bold text-xl">{(courses as Course[]).filter(c => c.completed).length}</p>
            <p className="text-xs text-white/70">완료</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="font-bold text-xl">
              {(courses as Course[]).reduce((sum, c) => c.completed ? sum + c.pointReward : sum, 0).toLocaleString()}P
            </p>
            <p className="text-xs text-white/70">획득 포인트</p>
          </div>
        </div>
      </div>

      {/* 어드민 강의 생성 폼 */}
      {isAdmin && showCreate && (
        <CourseForm
          initial={EMPTY_FORM}
          saving={createMutation.isPending}
          onCancel={() => setShowCreate(false)}
          onSave={v => createMutation.mutate({
            title: v.title,
            description: v.description || undefined,
            videoUrl: v.videoUrl || undefined,
            thumbnailUrl: v.thumbnailUrl || undefined,
            duration: v.duration || undefined,
            pointReward: v.pointReward,
            isPublished: v.isPublished,
          })}
        />
      )}

      {/* 강의 목록 */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">로딩 중...</p>
      ) : (courses as Course[]).length === 0 ? (
        <div className="text-center py-14 space-y-2">
          <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
          <p className="text-sm text-muted-foreground">등록된 강의가 없습니다</p>
          {isAdmin && <p className="text-xs text-muted-foreground">상단 "강의 추가" 버튼으로 첫 강의를 등록하세요</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {(courses as Course[]).map(course => (
            <div key={course.id}>
              {editId === course.id ? (
                <CourseForm
                  initial={{
                    title: course.title,
                    description: course.description ?? "",
                    videoUrl: course.videoUrl ?? "",
                    thumbnailUrl: course.thumbnailUrl ?? "",
                    duration: course.duration ?? "",
                    pointReward: course.pointReward,
                    isPublished: course.isPublished,
                  }}
                  saving={updateMutation.isPending}
                  onCancel={() => setEditId(null)}
                  onSave={v => updateMutation.mutate({
                    id: course.id,
                    title: v.title,
                    description: v.description || undefined,
                    videoUrl: v.videoUrl || undefined,
                    thumbnailUrl: v.thumbnailUrl || undefined,
                    duration: v.duration || undefined,
                    pointReward: v.pointReward,
                    isPublished: v.isPublished,
                  })}
                />
              ) : (
                <Card className={`bg-card border-border overflow-hidden ${!course.isPublished ? "opacity-60" : ""}`}>
                  {/* 썸네일 */}
                  {course.thumbnailUrl ? (
                    <div className="w-full h-44 overflow-hidden bg-muted">
                      <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-28 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      <GraduationCap className="h-10 w-10 text-primary/30" />
                    </div>
                  )}

                  <CardContent className="p-4 space-y-3">
                    {/* 상태 배지 (어드민) */}
                    {isAdmin && (
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${course.isPublished ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {course.isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {course.isPublished ? "게시됨" : "비공개"}
                      </span>
                    )}

                    <div className="space-y-1">
                      <p className="font-bold text-base leading-tight">{course.title}</p>
                      {course.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{course.description}</p>
                      )}
                    </div>

                    {/* 메타 정보 */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {course.duration && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {course.duration}
                        </div>
                      )}
                      {course.pointReward > 0 && (
                        <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <Coins className="h-3.5 w-3.5" />
                          완료 시 {course.pointReward.toLocaleString()}P 지급
                        </div>
                      )}
                      {course.completed && (
                        <div className="flex items-center gap-1 text-xs font-semibold text-green-600">
                          <CheckCircle className="h-3.5 w-3.5" />
                          완료
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    {isAdmin ? (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => { setEditId(course.id); setShowCreate(false); }}>
                          <Edit2 className="h-3.5 w-3.5" />수정
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-red-500 border-red-200 hover:bg-red-50"
                          onClick={() => setConfirmDeleteId(course.id)}>
                          <Trash2 className="h-3.5 w-3.5" />삭제
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        {course.videoUrl && (
                          <a href={course.videoUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                            <Button size="sm" className="w-full gap-1.5">
                              <Play className="h-3.5 w-3.5" />강의 보기
                            </Button>
                          </a>
                        )}
                        {!course.completed ? (
                          <Button
                            size="sm"
                            variant={course.videoUrl ? "outline" : "default"}
                            className={`gap-1.5 ${course.videoUrl ? "flex-none" : "flex-1"}`}
                            disabled={completeMutation.isPending}
                            onClick={() => completeMutation.mutate({ courseId: course.id })}
                          >
                            <Check className="h-3.5 w-3.5" />
                            {course.pointReward > 0 ? `완료 +${course.pointReward.toLocaleString()}P` : "완료"}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
                            <CheckCircle className="h-4 w-4" />완료됨
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-card rounded-2xl w-full max-w-xs mx-4 p-6 space-y-4 shadow-2xl">
            <p className="font-bold text-base">강의를 삭제하시겠습니까?</p>
            <p className="text-sm text-muted-foreground">삭제된 강의와 완료 기록은 복구되지 않습니다.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteId(null)}>취소</Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: confirmDeleteId })}
              >
                {deleteMutation.isPending ? "삭제 중..." : "삭제"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
