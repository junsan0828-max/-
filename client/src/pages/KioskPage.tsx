import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LockerInfo {
  lockerNumber?: string | null;
  lockerType: string;
  status: string;
  expiryType?: string | null;
  expiryDate?: string | null;
}

interface MemberPayload {
  id: number;
  name: string;
  phone?: string | null;
  photoBase64?: string | null;
  mileagePoints: number;
  membership: {
    productName: string;
    status: "active" | "expired" | "none";
    startDate?: string | null;
    endDate?: string | null;
    unlimitedEntry: number;
    remainingSessions?: number | null;
  };
  classMembership?: {
    productName?: string | null;
    endDate?: string | null;
    remainingSessions?: number | null;
  } | null;
  lockers: LockerInfo[];
}

type InputTab = "출석번호" | "휴대폰번호" | "통합번호";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatKoreanDateTime(): string {
  const now = new Date();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}(${days[now.getDay()]}) ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

// ─── Member Info Modal ────────────────────────────────────────────────────────

function MemberModal({
  member,
  onClose,
}: {
  member: MemberPayload;
  onClose: () => void;
}) {
  const isExpired = member.membership.status === "expired";
  const mainLocker = member.lockers.find((l) => l.lockerType === "개인락커");
  const clothesLocker = member.lockers.find((l) => l.lockerType === "운동복");

  useEffect(() => {
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
        style={{ background: "#1a1a1a", border: "1px solid #333" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white"
          style={{ background: "#2a2a2a" }}
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: "#2a2a2a" }}
          >
            {member.photoBase64 ? (
              <img
                src={`data:image/jpeg;base64,${member.photoBase64}`}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl text-gray-500">👤</span>
            )}
          </div>
          <div>
            <div className="text-lg font-bold">
              <span style={{ color: "#ff6b00" }}>{member.name}</span>
              <span className="text-white">님, 환영합니다.</span>
            </div>
            <div className="text-xs text-gray-400">
              <LiveTime />
            </div>
            <div className="text-xs text-gray-400">
              보유 마일리지{" "}
              <span className="text-white font-medium">
                {member.mileagePoints.toLocaleString()}점
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* 헬스 회원권 */}
          <div
            className="rounded-xl p-3"
            style={{ background: "#252525" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎟</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">현재 회원권</span>
                  <span className="text-xs text-white font-medium">
                    {member.membership.productName}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-400">회원권 만료일</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: isExpired ? "#ff4444" : "#aaa" }}
                  >
                    {formatDate(member.membership.endDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-400">남은입장횟수</span>
                  <span className="text-xs text-white font-medium">
                    {member.membership.unlimitedEntry
                      ? "무제한"
                      : member.membership.remainingSessions ?? "-"}
                  </span>
                </div>
              </div>
            </div>
            {isExpired && (
              <div
                className="rounded-lg p-2 text-center"
                style={{ background: "rgba(255,68,68,0.15)", border: "1px solid rgba(255,68,68,0.3)" }}
              >
                <p className="text-sm font-bold" style={{ color: "#ff4444" }}>
                  회원권이 만료되었습니다.
                </p>
                <p className="text-xs text-gray-400">관리자에게 문의해주세요.</p>
              </div>
            )}
          </div>

          {/* 수강권 */}
          <div
            className="rounded-xl p-3"
            style={{ background: "#252525" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">수강권 만료일</span>
                  <span className="text-xs text-white">
                    {formatDate(member.classMembership?.endDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-400">잔여 수강</span>
                  <span className="text-xs text-white">
                    {member.classMembership?.remainingSessions != null
                      ? `${member.classMembership.remainingSessions}회`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-400">수강권 상품명</span>
                  <span className="text-xs text-white">
                    {member.classMembership?.productName ?? "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 락커 */}
          <div
            className="rounded-xl p-3"
            style={{ background: "#252525" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🔒</span>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">개인락커</span>
                  <div className="flex items-center gap-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: mainLocker?.status === "사용중" ? "#ff6b00" : "#444",
                        color: "white",
                      }}
                    >
                      {mainLocker?.status ?? "미사용"}
                    </span>
                    {mainLocker?.status === "사용중" && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "#1a6b3a", color: "#4cff8f" }}
                      >
                        {mainLocker.expiryType ?? "무제한"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">운동복</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: clothesLocker?.status === "사용중" ? "#ff6b00" : "#444",
                      color: "white",
                    }}
                  >
                    {clothesLocker?.status ?? "미사용"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveTime() {
  const [time, setTime] = useState(formatKoreanDateTime());
  useEffect(() => {
    const t = setInterval(() => setTime(formatKoreanDateTime()), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{time}</>;
}

// ─── Number Pad ───────────────────────────────────────────────────────────────

function NumberPad({
  onMemberFound,
}: {
  onMemberFound: (m: MemberPayload) => void;
}) {
  const [activeTab, setActiveTab] = useState<InputTab>("휴대폰번호");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tabs: InputTab[] = ["출석번호", "휴대폰번호", "통합번호"];

  const prefix = activeTab === "휴대폰번호" ? "010" : "";
  const displayValue = prefix + input;
  const maxLen = activeTab === "휴대폰번호" ? 8 : 10;

  const handleKey = (key: string) => {
    setError(null);
    if (key === "backspace") {
      setInput((p) => p.slice(0, -1));
    } else if (input.length < maxLen) {
      setInput((p) => p + key);
    }
  };

  const handleSubmit = async () => {
    if (!input) return;
    setLoading(true);
    setError(null);
    try {
      let url = "";
      let body: Record<string, string> = {};
      if (activeTab === "출석번호") {
        url = "/api/kiosk/lookup/number";
        body = { number: input };
      } else if (activeTab === "휴대폰번호") {
        url = "/api/kiosk/lookup/phone";
        body = { phone: "010" + input };
      } else {
        url = "/api/kiosk/lookup/phone";
        body = { phone: input };
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "오류가 발생했습니다");
        return;
      }
      const member: MemberPayload = await res.json();
      // Record attendance
      await fetch("/api/kiosk/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      onMemberFound(member);
      setInput("");
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Tabs */}
      <div className="flex rounded-lg overflow-hidden" style={{ background: "#1a1a1a" }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setInput(""); setError(null); }}
            className="flex-1 py-2 text-xs font-medium transition-colors"
            style={{
              background: activeTab === tab ? "#ff6b00" : "transparent",
              color: activeTab === tab ? "white" : "#888",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Display */}
      <div
        className="rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest text-white"
        style={{ background: "#111", minHeight: "56px", letterSpacing: "0.15em" }}
      >
        {displayValue || (
          <span className="text-gray-600 text-base font-normal">
            {activeTab === "휴대폰번호" ? "010-XXXX-XXXX" : "번호를 입력하세요"}
          </span>
        )}
      </div>

      {error && (
        <p className="text-center text-sm" style={{ color: "#ff4444" }}>
          {error}
        </p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "취소", "0", "⌫"].map((k) => (
          <button
            key={k}
            onClick={() => {
              if (k === "취소") { setInput(""); setError(null); }
              else if (k === "⌫") handleKey("backspace");
              else handleKey(k);
            }}
            className="rounded-xl py-3 text-lg font-semibold text-white transition-all active:scale-95"
            style={{
              background: k === "취소" ? "#2a2a2a" : k === "⌫" ? "#2a2a2a" : "#1e1e1e",
              border: "1px solid #333",
            }}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={loading || !input}
        className="w-full py-4 rounded-xl text-white font-bold text-lg transition-all active:scale-98"
        style={{
          background: !input || loading ? "#444" : "#ff6b00",
          cursor: !input || loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "확인 중..." : "출석하기"}
      </button>
    </div>
  );
}

// ─── Face Camera ──────────────────────────────────────────────────────────────

interface FaceCameraProps {
  faceDescriptors: Array<{ memberId: number; name: string; faceDescriptor: number[] }>;
  onMemberFound: (memberId: number) => void;
  modelsLoaded: boolean;
}

function FaceCamera({ faceDescriptors, onMemberFound, modelsLoaded }: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"starting" | "searching" | "detected" | "nomatch" | "matched" | "nocam">("starting");
  const matcherRef = useRef<faceapi.FaceMatcher | null>(null);
  const lastMatchRef = useRef<number | null>(null);
  const cooldownRef = useRef(false);
  const animFrameRef = useRef<number>(0);

  // Build FaceMatcher when descriptors change
  useEffect(() => {
    if (!modelsLoaded || faceDescriptors.length === 0) {
      matcherRef.current = null;
      return;
    }
    const labeled = faceDescriptors.map(
      (fd) =>
        new faceapi.LabeledFaceDescriptors(String(fd.memberId), [
          new Float32Array(fd.faceDescriptor),
        ])
    );
    matcherRef.current = new faceapi.FaceMatcher(labeled, 0.55);
  }, [faceDescriptors, modelsLoaded]);

  // Start webcam
  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus("searching");
        }
      } catch {
        setStatus("nocam");
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Detection loop
  useEffect(() => {
    if (!modelsLoaded || status === "starting" || status === "nocam") return;

    let running = true;
    const detect = async () => {
      if (!running) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.paused || video.ended) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
          .withFaceLandmarks(true)
          .withFaceDescriptors();

        const dims = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, dims);
        const resized = faceapi.resizeResults(detections, dims);
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (resized.length === 0) {
          setStatus("searching");
          animFrameRef.current = requestAnimationFrame(detect);
          return;
        }

        setStatus("detected");

        // Draw orange bounding box
        resized.forEach((d) => {
          const box = d.detection.box;
          ctx.strokeStyle = "#ff6b00";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(box.x, box.y, box.width, box.height, 8);
          ctx.stroke();
        });

        // Try to match
        if (matcherRef.current && !cooldownRef.current) {
          const best = resized[0];
          const match = matcherRef.current.findBestMatch(best.descriptor);
          if (match.label !== "unknown") {
            const memberId = Number(match.label);
            if (memberId !== lastMatchRef.current) {
              lastMatchRef.current = memberId;
              cooldownRef.current = true;
              setStatus("matched");
              onMemberFound(memberId);
              setTimeout(() => {
                cooldownRef.current = false;
                lastMatchRef.current = null;
                setStatus("searching");
              }, 5000);
            }
          }
        }
      } catch {
        // Silently ignore frame errors
      }

      if (running) {
        animFrameRef.current = setTimeout(() => {
          animFrameRef.current = requestAnimationFrame(detect);
        }, 400) as unknown as number;
      }
    };

    animFrameRef.current = requestAnimationFrame(detect);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [modelsLoaded, status, onMemberFound]);

  const statusIcon: Record<typeof status, string> = {
    starting: "⏳",
    searching: "🔍",
    detected: "👤",
    nomatch: "❓",
    matched: "✅",
    nocam: "📷",
  };
  const statusText: Record<typeof status, string> = {
    starting: "카메라 시작 중...",
    searching: "Searching...",
    detected: "얼굴 감지됨",
    nomatch: "미등록 회원",
    matched: "인식 완료!",
    nocam: "카메라 없음",
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ background: "#111", aspectRatio: "4/3", width: "100%" }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Overlay status */}
      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between"
        style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }}>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{
              background: status === "matched" ? "#00aa55" : status === "detected" ? "#ff6b00" : "#222",
              border: `2px solid ${status === "matched" ? "#00ff88" : status === "detected" ? "#ff6b00" : "#444"}`,
            }}
          >
            {statusIcon[status]}
          </div>
          <span className="text-xs text-white font-medium">{statusText[status]}</span>
        </div>
        {!modelsLoaded && (
          <span className="text-xs" style={{ color: "#ff8800" }}>모델 로딩 중</span>
        )}
      </div>

      {/* Face circle overlay when searching */}
      {(status === "searching" || status === "starting") && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="rounded-full flex flex-col items-center justify-center gap-1"
            style={{
              width: "120px",
              height: "140px",
              border: "2px solid rgba(255,107,0,0.5)",
              background: "rgba(255,107,0,0.05)",
            }}
          >
            <span className="text-3xl">😊</span>
            <span className="text-xs text-gray-400">
              {status === "starting" ? "..." : "Searching..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Kiosk Page ──────────────────────────────────────────────────────────

const GYM_NAME = (import.meta as { env?: { VITE_GYM_NAME?: string } }).env?.VITE_GYM_NAME ?? "맞춤운동센터 자이언트짐";

export default function KioskPage() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDescriptors, setFaceDescriptors] = useState<
    Array<{ memberId: number; name: string; faceDescriptor: number[] }>
  >([]);
  const [activeMember, setActiveMember] = useState<MemberPayload | null>(null);
  const [currentTime, setCurrentTime] = useState(formatKoreanDateTime());

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(formatKoreanDateTime()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load face-api.js models
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models").catch(() => {}),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.warn("[kiosk] face-api models not fully loaded:", err);
        // Still mark as loaded so face detection works even without recognition
        setModelsLoaded(true);
      }
    })();
  }, []);

  // Fetch face descriptors
  const loadFaceDescriptors = useCallback(async () => {
    try {
      const res = await fetch("/api/kiosk/faces");
      if (res.ok) setFaceDescriptors(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadFaceDescriptors();
    const t = setInterval(loadFaceDescriptors, 60_000);
    return () => clearInterval(t);
  }, [loadFaceDescriptors]);

  const handleFaceMatch = useCallback(async (memberId: number) => {
    try {
      const res = await fetch("/api/kiosk/lookup/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) return;
      const member: MemberPayload = await res.json();
      await fetch("/api/kiosk/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      setActiveMember(member);
    } catch {}
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col select-none overflow-hidden"
      style={{
        background: "#0a0a0a",
        fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
      }}
    >
      {/* Background gym image */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 70% 40%, rgba(255,107,0,0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 30% 80%, rgba(255,107,0,0.05) 0%, transparent 50%)
          `,
        }}
      />

      {/* Header */}
      <header
        className="relative z-10 flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg"
            style={{ background: "#ff6b00" }}
          >
            G
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">{GYM_NAME}</h1>
            <p className="text-gray-500 text-xs">얼굴인식 입장 시스템</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white text-sm font-mono">{currentTime}</p>
        </div>
      </header>

      {/* Main body */}
      <main className="relative z-10 flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left: Face camera */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex-1">
            <FaceCamera
              faceDescriptors={faceDescriptors}
              onMemberFound={handleFaceMatch}
              modelsLoaded={modelsLoaded}
            />
          </div>

          {/* Branding strip */}
          <div
            className="rounded-xl p-4 text-center"
            style={{ background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)" }}
          >
            <p className="text-gray-400 text-xs mb-1">여러분의 형제,</p>
            <p
              className="text-2xl font-black"
              style={{ color: "#ff6b00", letterSpacing: "0.05em" }}
            >
              브로제이
            </p>
          </div>
        </div>

        {/* Right: Number pad */}
        <div className="w-72 flex-shrink-0 flex flex-col">
          <NumberPad onMemberFound={(m) => setActiveMember(m)} />
        </div>
      </main>

      {/* Member info modal */}
      {activeMember && (
        <MemberModal member={activeMember} onClose={() => setActiveMember(null)} />
      )}

      {/* Loading overlay */}
      {!modelsLoaded && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl"
            style={{ background: "#ff6b00" }}
          >
            G
          </div>
          <p className="text-white font-bold text-lg">{GYM_NAME}</p>
          <p className="text-gray-400 text-sm">시스템 초기화 중...</p>
          <div className="flex gap-1 mt-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  background: "#ff6b00",
                  animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
