import { useState } from "react";
import { Check, Play, Volume1, Volume2 } from "lucide-react";
import { ALERT_SOUNDS, getAlertSound, setAlertSound, getAlertVolume, setAlertVolume, playAlertSound } from "@/lib/alertSound";

// 직원 호출 알림음 종류·음량 (이 기기에만 저장). 🔔 알림 설정 창과 관리자 설정 > 직원 호출 알림 탭에서 함께 쓴다.
export default function AlertSoundPicker() {
  const [sound, setSound] = useState(getAlertSound);
  const [volume, setVolume] = useState(getAlertVolume);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium">소리 크기 <span className="text-xs text-muted-foreground font-normal">(이 기기)</span></p>
          <span className="text-sm tabular-nums text-primary font-semibold">{volume}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Volume1 className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="range" min={5} max={100} step={5} value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            onPointerUp={() => { setAlertVolume(volume); playAlertSound(sound, true, volume); }}
            onKeyUp={() => { setAlertVolume(volume); }}
            className="flex-1 accent-primary"
          />
          <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">100%가 찌그러짐 없는 최대치입니다. 더 크게는 기기의 <b>미디어 음량</b>을 올리세요.</p>
      </div>

      <div>
        <p className="text-sm font-medium mb-1.5">알림음 종류</p>
        <div className="space-y-1.5">
          {ALERT_SOUNDS.map(snd => {
            const selected = sound === snd.key;
            return (
              <div key={snd.key}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer ${selected ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
                onClick={() => { setSound(snd.key); setAlertSound(snd.key); playAlertSound(snd.key, true, volume); }}>
                <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                  {selected && <Check className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{snd.label}</p>
                  <p className="text-xs text-muted-foreground">{snd.desc}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); playAlertSound(snd.key, true, volume); }}
                  className="text-xs text-primary bg-primary/15 px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0">
                  <Play className="h-3 w-3" /> 듣기
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
