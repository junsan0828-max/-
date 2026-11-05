import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { playAlertSound, getAudioCtx } from "@/lib/alertSound";
import AlertSoundPicker from "./AlertSoundPicker";
import { Bell, BellRing, Check, Play, X } from "lucide-react";

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

const playDingDong = () => playAlertSound();

// 헤더·사이드바의 🔔 버튼이 이 이벤트로 알림 설정 창을 연다
export const OPEN_ALERT_SETTINGS = "open-alert-settings";
export const openAlertSettings = () => window.dispatchEvent(new Event(OPEN_ALERT_SETTINGS));

function sameKey(sub: PushSubscription, vapidKey: string) {
  const have = sub.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey as ArrayBuffer) : null;
  if (!have) return false;
  const want = urlB64ToUint8Array(vapidKey);
  return have.length === want.length && have.every((b, i) => b === want[i]);
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
  const { data: myStatus } = trpc.staffAlerts.myStatus.useQuery(undefined, { enabled: isStaff, staleTime: 5 * 60_000 });
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
        let sub = await reg.pushManager.getSubscription();
        // 서버 키가 바뀌었으면(예: 2026-11-04 키 교체) 권한은 그대로 두고 조용히 다시 구독
        if (sub && Notification.permission === "granted" && !sameKey(sub, vapidKey)) {
          await sub.unsubscribe().catch(() => {});
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapidKey) });
        }
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
      if (sub && !sameKey(sub, vapidKey)) { await sub.unsubscribe(); sub = null; }
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
    const unlock = () => { getAudioCtx(); window.removeEventListener("pointerdown", unlock); };
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
  // 서비스워커가 푸시를 받으면 즉시 띵동 + 목록 갱신
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "staff-call") { playDingDong(); utils.staffAlerts.pendingCalls.invalidate(); }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [utils]);

  const ringing = !!calls?.some(c => c.minutesAgo < 5);
  useEffect(() => {
    if (!ringing) return;
    const t = setInterval(playDingDong, 30_000);
    return () => clearInterval(t);
  }, [ringing]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener(OPEN_ALERT_SETTINGS, open);
    return () => window.removeEventListener(OPEN_ALERT_SETTINGS, open);
  }, []);

  if (!isStaff) return null;

  const dismiss = () => { safeSet(DISMISS_KEY, String(Date.now())); setDismissed(true); };
  // 알림 대상 직원은 이 기기에서 알림 켜기가 필수 (대표 결정 2026-11-05). 켜기 전에는 화면을 쓸 수 없다.
  // 받는 시간은 관리자가 정한 근무시간으로 서버가 자동 판단한다.
  const mustEnable = !!myStatus?.required && (pushState === "none" || pushState === "denied");
  const showPrompt = !mustEnable && !dismissed && pushState === "ios-install";

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
      {mustEnable && (
        <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 text-center space-y-4">
            <BellRing className="h-10 w-10 text-primary mx-auto" />
            <h2 className="text-lg font-bold">알림 켜기가 필요합니다</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              키오스크 직원 호출·상담 접수 알림은 <b className="text-foreground">필수</b>입니다.
              관리자가 정한 근무시간에만 자동으로 울리고, 근무시간 외에는 오지 않습니다.
            </p>
            {pushState === "denied" ? (
              <div className="text-left text-xs bg-red-500/10 text-red-400 rounded-lg p-3 space-y-1">
                <p className="font-semibold">이 기기에서 알림이 차단돼 있습니다.</p>
                <p>크롬 주소창 왼쪽 아이콘(🔒 또는 ⚙) → <b>권한</b> → <b>알림</b> → <b>허용</b>으로 바꾼 뒤 아래 버튼을 누르세요.</p>
                <p>앱으로 설치했다면: 휴대폰 설정 → 애플리케이션 → 이 앱(또는 Chrome) → 알림 → 허용.</p>
              </div>
            ) : null}
            <button
              disabled={busy}
              onClick={() => (pushState === "denied" && Notification.permission === "denied") ? window.location.reload() : enablePush()}
              className="w-full text-base font-bold bg-primary text-primary-foreground py-3 rounded-xl disabled:opacity-50"
            >
              {busy ? "설정 중…" : pushState === "denied" ? "허용했어요 · 다시 확인" : "알림 켜기"}
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setSettingsOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">키오스크 호출 알림 설정</h2>
              <button onClick={() => setSettingsOpen(false)} className="text-muted-foreground p-1" aria-label="닫기"><X className="h-5 w-5" /></button>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">운영시스템 화면이 켜져 있을 때 울리는 소리입니다.</p>
              <AlertSoundPicker />
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium mb-1">휴대폰 알림창 알림</p>
              <p className="text-xs text-muted-foreground mb-2">
                {pushState === "on" ? "이 기기에서 받는 중입니다. 알림창 소리는 휴대폰 알림음·알림 음량을 따릅니다(무음 모드면 진동만)."
                  : pushState === "denied" ? "브라우저에서 알림이 차단돼 있습니다. 주소창 왼쪽 아이콘 → 권한 → 알림 → 허용으로 바꿔 주세요."
                  : pushState === "ios-install" ? "아이폰은 Safari 공유 → '홈 화면에 추가'한 앱에서 열어야 받을 수 있습니다."
                  : pushState === "unsupported" ? "이 브라우저는 알림을 지원하지 않습니다."
                  : "아직 이 기기에서 받지 않습니다."}
              </p>
              <div className="flex gap-2">
                {pushState === "none" && (
                  <button disabled={busy} onClick={enablePush} className="text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50">
                    {busy ? "설정 중…" : "알림 켜기"}
                  </button>
                )}
                {pushState === "on" && (
                  <button disabled={testMut.isPending} onClick={() => testMut.mutate()} className="text-sm font-medium bg-primary/15 text-primary px-3 py-1.5 rounded-md disabled:opacity-50">
                    {testMut.isPending ? "보내는 중…" : testMut.data ? `테스트 알림 보냄 (${testMut.data.sent}대)` : "테스트 알림 보내기"}
                  </button>
                )}
              </div>
            </div>

            {me?.role === "admin" && (
              <a href="/admin?tab=alert" className="block text-center text-sm font-medium text-primary border border-primary/30 rounded-md py-2">
                받는 직원·지점·근무시간 설정 →
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
