import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, CheckCircle, RefreshCw, Trash2 } from "lucide-react";

interface EnrolledFace {
  photoBase64: string;
  updatedAt: string;
}

interface FaceEnrollPanelProps {
  memberId: number;
  memberName: string;
}

// Load tiny models needed for capture-time face detection (not recognition)
let tinyModelsPromise: Promise<void> | null = null;
function loadTinyModels() {
  if (!tinyModelsPromise) {
    tinyModelsPromise = faceapi.nets.tinyFaceDetector
      .loadFromUri("/models")
      .catch(() => {});
  }
  return tinyModelsPromise;
}

// ─── Camera capture dialog ────────────────────────────────────────────────────

function CameraDialog({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (photoBase64: string, descriptor: number[] | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const detectionLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start camera when dialog opens
  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    setCaptured(null);
    setFaceDetected(false);

    (async () => {
      await loadTinyModels();
      setModelsReady(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        toast.error("카메라를 열 수 없습니다");
        onClose();
      }
    })();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (detectionLoopRef.current) clearTimeout(detectionLoopRef.current);
    };
  }, [open, onClose]);

  // Face detection overlay loop
  useEffect(() => {
    if (!cameraReady || !modelsReady || captured) return;

    let running = true;
    const detect = async () => {
      if (!running) return;
      const video = videoRef.current;
      const canvas = overlayCanvasRef.current;
      if (!video || !canvas || video.paused) {
        detectionLoopRef.current = setTimeout(detect, 400);
        return;
      }
      try {
        const det = await faceapi.detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 })
        );
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (det) {
          setFaceDetected(true);
          const scaleX = canvas.width / video.videoWidth;
          const scaleY = canvas.height / video.videoHeight;
          const box = det.box;
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(box.x * scaleX, box.y * scaleY, box.width * scaleX, box.height * scaleY, 8);
          ctx.stroke();
          // Draw "얼굴 감지됨" label
          ctx.fillStyle = "rgba(34,197,94,0.85)";
          ctx.fillRect(box.x * scaleX, box.y * scaleY - 24, 80, 20);
          ctx.fillStyle = "#fff";
          ctx.font = "11px sans-serif";
          ctx.fillText("얼굴 감지됨", box.x * scaleX + 4, box.y * scaleY - 8);
        } else {
          setFaceDetected(false);
        }
      } catch {}
      if (running) detectionLoopRef.current = setTimeout(detect, 400);
    };
    detect();
    return () => { running = false; };
  }, [cameraReady, modelsReady, captured]);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Draw current frame to canvas
    const ctx = canvas.getContext("2d")!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.save();
    ctx.scale(-1, 1); // mirror
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    const photoBase64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    setCaptured(photoBase64);

    // Try to extract face descriptor (needs face_recognition_net)
    let descriptor: number[] | null = null;
    try {
      if (faceapi.nets.faceRecognitionNet.isLoaded) {
        const det = await faceapi
          .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true)
          .withFaceDescriptor();
        if (det) descriptor = Array.from(det.descriptor);
      }
    } catch {}

    onCapture(photoBase64, descriptor);
  }, [onCapture]);

  const handleRetake = () => {
    setCaptured(null);
    setFaceDetected(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>얼굴 촬영</DialogTitle>
        </DialogHeader>

        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          {!captured ? (
            <>
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              {/* overlay canvas (for detection boxes) */}
              <canvas
                ref={overlayCanvasRef}
                width={640}
                height={480}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              {/* Hidden capture canvas */}
              <canvas ref={canvasRef} className="hidden" />

              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <p className="text-white text-sm">카메라 시작 중...</p>
                </div>
              )}

              {/* Face guide circle */}
              {cameraReady && !faceDetected && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="rounded-full"
                    style={{
                      width: 180, height: 220,
                      border: "2px dashed rgba(255,255,255,0.4)",
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <img
              src={`data:image/jpeg;base64,${captured}`}
              alt="captured"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="p-4 flex gap-2">
          {!captured ? (
            <>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                취소
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleCapture}
                disabled={!cameraReady}
                style={{ background: faceDetected ? "#16a34a" : undefined }}
              >
                <Camera className="h-4 w-4" />
                {faceDetected ? "촬영 (얼굴 감지됨)" : "촬영"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="flex-1 gap-2" onClick={handleRetake}>
                <RefreshCw className="h-4 w-4" />
                다시 촬영
              </Button>
              <Button
                className="flex-1 gap-2"
                style={{ background: "#ff6b00" }}
                onClick={onClose}
              >
                <CheckCircle className="h-4 w-4" />
                등록 완료
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function FaceEnrollPanel({ memberId, memberName }: FaceEnrollPanelProps) {
  const [enrolled, setEnrolled] = useState<EnrolledFace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const fetchEnrolled = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/kiosk/faces`);
      if (!res.ok) return;
      const faces: Array<{ memberId: number; name: string }> = await res.json();
      // Check if this member has a face enrolled
      const found = faces.find((f) => f.memberId === memberId);
      if (found) {
        // Fetch full face data including photo
        const detailRes = await fetch(`/api/kiosk/admin/face/${memberId}`);
        if (detailRes.ok) {
          const data = await detailRes.json();
          setEnrolled(data);
        } else {
          setEnrolled({ photoBase64: "", updatedAt: "" });
        }
      } else {
        setEnrolled(null);
      }
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { fetchEnrolled(); }, [fetchEnrolled]);

  const handleCapture = async (photoBase64: string, descriptor: number[] | null) => {
    setSaving(true);
    try {
      const res = await fetch("/api/kiosk/admin/enroll-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          faceDescriptor: descriptor ?? [],
          photoBase64,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      toast.success(`${memberName} 회원 얼굴 등록 완료`);
      setCameraOpen(false);
      await fetchEnrolled();
    } catch {
      toast.error("얼굴 등록 중 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`${memberName} 회원의 얼굴 정보를 삭제할까요?`)) return;
    try {
      await fetch(`/api/kiosk/admin/face/${memberId}`, { method: "DELETE" });
      setEnrolled(null);
      toast.success("얼굴 정보가 삭제되었습니다");
    } catch {
      toast.error("삭제 중 오류가 발생했습니다");
    }
  };

  return (
    <>
      <div
        className="rounded-xl p-4 border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🔐</span>
            <span className="text-sm font-semibold">얼굴인식 입장 등록</span>
          </div>
          {enrolled && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "rgba(34,197,94,0.15)", color: "#16a34a" }}
            >
              등록됨
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground py-2">확인 중...</p>
        ) : enrolled ? (
          <div className="flex items-center gap-3">
            {enrolled.photoBase64 ? (
              <div
                className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border"
                style={{ borderColor: "var(--border)" }}
              >
                <img
                  src={`data:image/jpeg;base64,${enrolled.photoBase64}`}
                  alt={memberName}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                style={{ background: "var(--accent)" }}
              >
                👤
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">얼굴 등록 완료</p>
              {enrolled.updatedAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  등록일: {enrolled.updatedAt.slice(0, 10)}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                키오스크 자동 입장 활성화
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs"
                onClick={() => setCameraOpen(true)}
              >
                <RefreshCw className="h-3 w-3" />
                재촬영
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs text-destructive border-destructive/30"
                onClick={handleDelete}
              >
                <Trash2 className="h-3 w-3" />
                삭제
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
              style={{ background: "var(--accent)", border: "2px dashed var(--border)" }}
            >
              📷
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">얼굴 정보 미등록</p>
              <p className="text-xs text-muted-foreground mt-1">
                현장에서 촬영하여 키오스크 자동 입장을 활성화하세요
              </p>
            </div>
            <Button
              size="sm"
              className="gap-2 flex-shrink-0"
              style={{ background: "#ff6b00" }}
              onClick={() => setCameraOpen(true)}
              disabled={saving}
            >
              <Camera className="h-4 w-4" />
              촬영 등록
            </Button>
          </div>
        )}
      </div>

      <CameraDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
      />
    </>
  );
}
