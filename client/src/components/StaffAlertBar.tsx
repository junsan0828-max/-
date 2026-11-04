import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, BellRing, X } from "lucide-react";

// 키오스크 직원 호출 배너 + 이 기기 알림 받기(웹푸시 구독)
// 서버: server/staffAlerts.ts

const STAFF_ROLES = ["admin", "sub_admin", "consultant", "trainer"];
const DISMISS_KEY = "staffPushPromptDismissedAt";

const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// 띵동 (Web Audio로 합성 — 파일 없음). 브라우저 정책상 화면을 한 번이라도 터치한 뒤부터 소리가 난다.
let audioCtx: AudioContext | null = null;
function getCtx() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch { return null; }
}
export function playDingDong() {
  const ctx = getCtx();
  if (!ctx) return;
  const tone = (freq: number, start: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 1.1);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + 1.2);
  };
  tone(659.25, 0);    // 띵 (미)
  tone(523.25, 0.45); // 동 (도)
  try { navigator.vibrate?.([200, 100, 300]); } catch { /* 무시 */ }
}

function safeGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* 무시 */ } }

export default function StaffAlertBar() {
  const { data: me } = trpc.auth.me.useQuery();
  const isStaff = !!me && STAFF_ROLES.includes(me.role);
  const utils = trpc.useUtils();

  const { data: calls } = trpc.staffAlerts.pendingCalls.useQuery(undefined, {
    enabled: isStaff, refetchInterval: 10_000, refetchIntervalInBackground: false,
  });
  const ack = trpc.staffAlerts.acknowledge.useMutation({ onSuccess: () => utils.staffAlerts.pendingCalls.invalidate() });
  const { data: vapidKey } = trpc.staffAlerts.vapidKey.useQuery(undefined, { enabled: isStaff, staleTime: Infinity });
  const subscribeMut = trpc.staffAlerts.subscribe.useMutation();
  const testMut = trpc.staffAlerts.test.useMutation();

  // none = 아직 안 켬 / on = 이 기기 수신 중 / denied = 브라우저에서 차단 / unsupported
  const [pushState, setPushState] = useState<"checking" | "none" | "on" | "denied" | "unsupported" | "ios-install">("checking");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    const at = Number(safeGet(DISMISS_KEY) ?? 0);
    return Date.now() - at < 7 * 86400_000; // 닫으면 7일간 다시 묻지 않음
  });

  // 이미 켠 기기는 접속할 때마다 서버에 다시 알려준다 (서버 쪽 구독이 지워졌거나 계정이 바뀐 경우 복구, 멱등)
  useEffect(() => {
    if (!isStaff || !vapidKey) return;
    if (!pushSupported()) { setPushState(isIos() && !isStandalone() ? "ios-install" : "unsupported"); return; }
    if (Notification.permission === "denied") { setPushState("denied"); return; }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (sub && Notification.permission === "granted") {
          const j = sub.toJSON() as any;
          subscribeMut.mutate({ endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, userAgent: navigator.userAgent });
          setPushState("on");
        } else setPushState("none");
      } catch { setPushState("none"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, vapidKey]);

  const enablePush = async () => {
    if (busy || !vapidKey) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPushState(perm === "denied" ? "denied" : "none"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      // 다른 키(예전 회원앱 등)로 구독돼 있으면 새로 받는다
      const want = urlB64ToUint8Array(vapidKey);
      const have = sub?.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey as ArrayBuffer) : null;
      if (sub && have && (have.length !== want.length || have.some((b, i) => b !== want[i]))) { await sub.unsubscribe(); sub = null; }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
      const j = sub.toJSON() as any;
      await subscribeMut.mutateAsync({ endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, userAgent: navigator.userAgent });
      setPushState("on");
      testMut.mutate();
    } catch (e: any) {
      alert("알림 설정에 실패했습니다: " + (e?.message ?? e));
    } finally { setBusy(false); }
  };

  // 새 호출이 들어오면 띵동. 확인 전까지 30초마다 다시 울림(최대 5분).
  const seenRef = useRef<Set<number> | null>(null);
  useEffect(() => {
    // 첫 터치에서 오디오 잠금 해제
    const unlock = () => { getCtx(); window.removeEventListener("pointerdown", unlock); };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  useEffect(() => {
    if (!calls) return;
    const ids = calls.map(c => c.id);
    if (seenRef.current === null) { seenRef.current = new Set(ids); if (calls.some(c => c.minutesAgo <= 1)) playDingDong(); return; }
    const fresh = ids.filter(id => !seenRef.current!.has(id));
    ids.forEach(id => seenRef.current!.add(id));
    if (fresh.length) playDingDong();
  }, [calls]);
  const ringing = !!calls?.some(c => c.minutesAgo < 5);
  useEffect(() => {
    if (!ringing) return;
    const t = setInterval(playDingDong, 30_000);
    return () => clearInterval(t);
  }, [ringing]);

  if (!isStaff) return null;

  const dismiss = () => { safeSet(DISMISS_KEY, String(Date.now())); setDismissed(true); };
  const showPrompt = !dismissed && (pushState === "none" || pushState === "ios-install");

  return (
    <>
      {(calls ?? []).map(c => (
        <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 bg-red-600 text-white">
          <BellRing className="h-5 w-5 shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{c.message}</p>
            <p className="text-xs opacity-80">{c.minutesAgo === 0 ? "방금" : `${c.minutesAgo}분 전`} · 키오스크로 가 주세요</p>
          </div>
          <button
            disabled={ack.isPending}
            onClick={() => ack.mutate({ id: c.id })}
            className="text-sm font-bold bg-white text-red-600 px-3 py-1.5 rounded-md shrink-0 disabled:opacity-50"
          >
            제가 갈게요
          </button>
        </div>
      ))}

      {showPrompt && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-b border-primary/20">
          <Bell className="h-4 w-4 text-primary shrink-0" />
          <p className="flex-1 text-xs text-foreground">
            {pushState === "ios-install"
              ? "아이폰은 공유 → '홈 화면에 추가'한 앱에서 열어야 키오스크 호출 알림을 받을 수 있어요."
              : "키오스크 직원 호출·상담 접수 알림을 이 기기에서 받으세요."}
          </p>
          {pushState === "none" && (
            <button
              disabled={busy}
              onClick={enablePush}
              className="text-xs font-medium text-primary bg-primary/20 px-2.5 py-1 rounded-md shrink-0 disabled:opacity-50"
            >
              {busy ? "설정 중…" : "알림 켜기"}
            </button>
          )}
          <button onClick={dismiss} className="text-muted-foreground" aria-label="닫기">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
