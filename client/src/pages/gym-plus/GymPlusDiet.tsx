export default function GymPlusDiet() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="font-bold text-lg">맞춤 식단</h1>
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
        <span className="text-4xl">🥗</span>
        <p className="font-semibold text-base">맞춤 식단 준비 중</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          회원님의 운동 목표와 신체정보를 바탕으로<br />맞춤 식단 서비스를 준비하고 있습니다.
        </p>
      </div>
    </div>
  );
}
