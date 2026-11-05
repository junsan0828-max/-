// 직원 호출 알림음 (Web Audio로 합성 — 음원 파일 없음)
// 브라우저 정책상 화면을 한 번이라도 터치한 뒤부터 소리가 나며, 기기의 '미디어 음량'을 따른다.
// 어떤 소리를 쓸지는 기기마다 고른다(localStorage) — 카운터 PC와 직원 폰을 다르게 둘 수 있다.

type Note = { f: number; t: number; dur?: number; wave?: OscillatorType; bright?: boolean };

export const ALERT_SOUNDS: { key: string; label: string; desc: string; notes: Note[] }[] = [
  { key: "dingdong", label: "띵동", desc: "기본 · 초인종", notes: [{ f: 659.25, t: 0 }, { f: 523.25, t: 0.45 }] },
  { key: "dingdongdang", label: "딩동댕", desc: "밝은 3음 차임",
    notes: [{ f: 523.25, t: 0 }, { f: 659.25, t: 0.28 }, { f: 783.99, t: 0.56, dur: 1.6 }] },
  { key: "school", label: "학교 종", desc: "4음 차임 (조금 길다)",
    notes: [{ f: 659.25, t: 0, dur: 0.9 }, { f: 523.25, t: 0.42, dur: 0.9 }, { f: 587.33, t: 0.84, dur: 0.9 }, { f: 392.0, t: 1.26, dur: 1.6 }] },
  { key: "marimba", label: "마림바", desc: "부드럽고 짧게",
    notes: [{ f: 1046.5, t: 0, dur: 0.45, wave: "sine" }, { f: 783.99, t: 0.16, dur: 0.45, wave: "sine" }, { f: 1046.5, t: 0.32, dur: 0.6, wave: "sine" }] },
  { key: "beep", label: "삐삐삐", desc: "짧고 날카롭게 (시끄러운 곳)",
    notes: [0, 0.22, 0.44].map(t => ({ f: 1318.5, t, dur: 0.16, wave: "square" as OscillatorType, bright: true })) },
  { key: "bell", label: "따르릉", desc: "전화벨 (가장 잘 들림)",
    notes: Array.from({ length: 12 }, (_, i) => ({ f: i % 2 ? 1568 : 1318.5, t: i * 0.06, dur: 0.07, wave: "square" as OscillatorType, bright: true }))
      .concat(Array.from({ length: 12 }, (_, i) => ({ f: i % 2 ? 1568 : 1318.5, t: 1.0 + i * 0.06, dur: 0.07, wave: "square" as OscillatorType, bright: true }))) },
];

const KEY = "staffAlertSound";
export function getAlertSound(): string {
  try { return localStorage.getItem(KEY) || "dingdong"; } catch { return "dingdong"; }
}
export function setAlertSound(k: string) {
  try { localStorage.setItem(KEY, k); } catch { /* 무시 */ }
}

// 음량 0~100 (기기별). 100 = 찌그러짐 없는 최대치
const VOL_KEY = "staffAlertVolume";
export function getAlertVolume(): number {
  try { const v = Number(localStorage.getItem(VOL_KEY)); return Number.isFinite(v) && v > 0 ? Math.min(100, v) : 100; } catch { return 100; }
}
export function setAlertVolume(v: number) {
  try { localStorage.setItem(VOL_KEY, String(Math.round(Math.min(100, Math.max(5, v))))); } catch { /* 무시 */ }
}

let audioCtx: AudioContext | null = null;
export function getAudioCtx() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch { return null; }
}

let last = 0;
/** 알림음 재생. preview=true면 연속 재생 제한 없이(미리듣기) */
export function playAlertSound(kind?: string, preview = false, volume?: number) {
  if (!preview && Date.now() - last < 3000) return; // 푸시·폴링이 겹쳐 두 번 울리지 않게
  last = Date.now();
  const ctx = getAudioCtx();
  if (!ctx) return;
  const sound = ALERT_SOUNDS.find(s => s.key === (kind ?? getAlertSound())) ?? ALERT_SOUNDS[0];

  // 컴프레서로 피크를 눌러 찌그러짐 없이 음량을 최대한 끌어올린다
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24; comp.knee.value = 10; comp.ratio.value = 8;
  comp.attack.value = 0.003; comp.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 1.7 * ((volume ?? getAlertVolume()) / 100);
  comp.connect(master).connect(ctx.destination);

  for (const n of sound.notes) {
    const dur = n.dur ?? 1.3;
    // 기본음 + 배음을 섞어 작은 폰 스피커에서도 또렷하게 (사각파는 이미 배음이 많아 단독)
    const partials: [number, number][] = n.bright ? [[1, 0.6]] : [[1, 1], [2, 0.5], [3, 0.25]];
    for (const [mult, vol] of partials) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = mult === 1 ? (n.wave ?? "triangle") : "sine";
      o.frequency.value = n.f * mult;
      const t0 = ctx.currentTime + n.t;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(comp);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
  }
  if (!preview) { try { navigator.vibrate?.([200, 100, 300]); } catch { /* 무시 */ } }
}
