# 20초 세로 홍보 영상(9:16, 1080x1920) — 실제 수업 사진 4장을 편집만 한다 (인물·자세·시설을 움직이거나 변형하지 않는다).
#  python make_promo20.py <사진폴더> <출력.mp4> [--preview <폴더>]
#  사진폴더에는 1023.jpg / 10231.jpg / 10232.jpg / 10233.jpg 가 있어야 한다 (원본 폴더 또는 모자이크 폴더).
# 장면: 부드러운 확대·이동(Ken Burns) + 0.3초 디졸브. 자막: 흰색 + 주황 강조, 한글 폰트 1종(맑은 고딕 굵게).
# 나레이션: Windows 한국어 여성 음성(Microsoft Heami)을 문장별로 합성해 장면 시작에 맞춘다. 배경음은 합성한 잔잔한 패드를 아주 낮게 깐다.
import math
import os
import shutil
import subprocess
import sys
import tempfile
import wave

import cv2
import numpy as np

W, H, FPS, TOTAL = 1080, 1920, 30, 20.0
XF = 0.3  # 장면 사이 디졸브(초)
SAFE_X = W // 2
ORANGE = "0xFF8A1F"
WHITE = "white"

# 사진 번호: 1=기구 옆 지도, 2=스쿼트 자세 지도, 3=등·어깨 지도, 4=경사 발판 하체 지도
PHOTOS = {"1": "1023.jpg", "2": "10231.jpg", "3": "10232.jpg", "4": "10233.jpg"}

# ── 장면: (시작, 길이, 사진, 시작 구도(cx, cy, hf), 끝 구도) — cx,cy = 창의 중심(원본 비율 0~1), hf = 창 높이/원본 높이 ──
SCENES = [
    (0.0, 4.0, "3", (0.50, 0.50, 1.00), (0.58, 0.46, 0.66), 1.0),  # 트레이너 손과 등·어깨 쪽으로 천천히 확대
    (4.0, 4.0, "2", (0.36, 0.56, 0.86), (0.60, 0.52, 0.86), 1.0),  # 전신과 트레이너가 함께 보이게 좌→우 이동
    # 발 → 골반 → 상체로 위로 이동. 이동을 앞 1.8초에 끝내 두고, 얼굴이 천장 쪽 빈 공간 아래에 자리 잡은 뒤 가격 자막을 띄운다.
    (8.0, 4.0, "4", (0.50, 0.69, 0.62), (0.46, 0.31, 0.62), 0.45),
    (12.0, 4.0, "1", (0.50, 0.66, 0.60), (0.50, 0.50, 1.00), 1.0),  # 센터 분위기가 보이게 천천히 축소
    (16.0, 4.0, "3", (0.58, 0.46, 0.66), (0.50, 0.50, 0.90), 1.0),  # 마무리 (어둡게 + 문구)
]
END_START = 16.0

# ── 자막: (시작, 끝, [(글자, 크기, 색)...], 첫 줄 y) — 줄 간격은 크기에 맞춰 자동 ──────────────
CAPTIONS = [
    (0.2, 3.8, [("운동, 내 몸에 맞게", 64, WHITE), ("하고 있나요?", 64, ORANGE)], 1390),
    (4.2, 7.8, [("체형·움직임 분석을 바탕으로", 54, WHITE), ("나에게 필요한 운동 설계", 60, ORANGE)], 1400),
    (9.6, 11.8, [("777 맞춤 PT", 92, ORANGE), ("17회 · 77만 7천 원", 70, WHITE)], 120),
    (12.2, 15.8, [("꾸준한 운동을 위한", 60, WHITE), ("헬스 회원권", 76, ORANGE)], 250),
]
END_TEXTS = [  # (글자, 크기, 색, y)
    ("ZIANTGYM", 100, WHITE, 620),
    ("맞춤운동센터 자이언트짐", 62, WHITE, 800),
    ("777 PT · 헬스 회원권 상담", 56, ORANGE, 930),
]

# ── 나레이션: (시작초, 문장) — 장면 길이 안에 들어오도록 속도를 자동 조절한다 ───────────────────
NARRATION = [
    (0.3, "내 몸에 맞는 운동, 찾으셨나요?"),
    (4.1, "체형과 움직임을 살펴, 필요한 운동을 설계합니다."),
    (8.1, "칠칠칠 피티, 십칠 회, 칠십칠만 칠천 원."),
    (12.1, "헬스 회원권으로 꾸준한 운동까지."),
    (16.3, "맞춤운동센터, 자이언트짐."),
]


def imread(p):
    im = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    if im is None:
        raise FileNotFoundError(p)
    return im


def smooth(p):
    p = min(max(p, 0.0), 1.0)
    return p * p * (3 - 2 * p)


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def cover_frame(img, cx, cy, hf):
    ih, iw = img.shape[:2]
    h = hf * ih
    w = h * W / H
    x0 = min(max(cx * iw - w / 2, 0), iw - w)
    y0 = min(max(cy * ih - h / 2, 0), ih - h)
    k = H / h
    M = np.array([[k, 0, -k * x0], [0, k, -k * y0]], np.float32)
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


class Renderer:
    def __init__(self, folder):
        self.imgs = {k: imread(os.path.join(folder, v)) for k, v in PHOTOS.items()}

    def scene_frame(self, i, T):
        s, d, key, a, b, pf = SCENES[i]
        return cover_frame(self.imgs[key], *lerp(a, b, smooth((T - s) / (d * pf))))

    def frame(self, T):
        n = len(SCENES)
        for i in range(n):
            s, d = SCENES[i][0], SCENES[i][1]
            end = s + d
            if T < end - XF or i == n - 1:
                return self.scene_frame(i, T)
            if T < end:
                al = (T - (end - XF)) / XF
                return cv2.addWeighted(self.scene_frame(i, T), 1 - al, self.scene_frame(i + 1, T), al, 0)
        return self.scene_frame(n - 1, T)


def drawtext(work, idx, text, size, color, y, start, end, box=True):
    tf = f"t{idx}.txt"
    open(os.path.join(work, tf), "w", encoding="utf-8", newline="").write(text)
    b = ":box=1:boxcolor=black@0.45:boxborderw=22" if box else ""
    return (
        f"drawtext=textfile='{tf}':fontfile='fb.ttf':fontsize={size}:fontcolor={color}"
        f":shadowcolor=black@0.7:shadowx=3:shadowy=3{b}:x={SAFE_X}-text_w/2:y={y}:enable='between(t,{start},{end})'"
    )


def build_filters(work):
    filters, i = [], 0
    for (s, e, lines, y0) in CAPTIONS:
        y = y0
        for (text, size, color) in lines:
            filters.append(drawtext(work, i, text, size, color, y, s, e)); i += 1
            y += int(size * 1.55)
    filters.append(f"drawbox=x=0:y=0:w=iw:h=ih:color=black@0.74:t=fill:enable='between(t,{END_START},{TOTAL})'")
    filters.append(f"drawbox=x={SAFE_X - 60}:y=770:w=120:h=7:color={ORANGE}@1:t=fill:enable='between(t,{END_START},{TOTAL})'")
    for (text, size, color, y) in END_TEXTS:
        filters.append(drawtext(work, i, text, size, color, y, END_START, TOTAL, box=False)); i += 1
    return ",".join(filters)


# ── 오디오 ───────────────────────────────────────────────────────────────────────
def probe_len(p):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], text=True)
    return float(out.strip())


def tts(text, wav, rate):
    txt = wav + ".txt"
    open(txt, "w", encoding="utf-8").write(text)
    ps = (
        "Add-Type -AssemblyName System.Speech;"
        "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;$s.SelectVoice('Microsoft Heami Desktop');"
        f"$s.Rate={rate};$s.Volume=100;$s.SetOutputToWaveFile('{wav}');"
        f"$s.Speak((Get-Content -Raw -Encoding UTF8 '{txt}'));$s.Dispose()"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)


def make_narration(work):
    """문장별로 합성하고, 다음 문장 시작 전에 끝나도록(최대 길이 안에 들어오도록) 속도를 올린다."""
    parts = []
    for idx, (start, text) in enumerate(NARRATION):
        limit = (NARRATION[idx + 1][0] if idx + 1 < len(NARRATION) else TOTAL) - start - 0.2
        wav = os.path.join(work, f"n{idx}.wav")
        for rate in (0, 1, 2, 3, 4):
            tts(text, wav, rate)
            if probe_len(wav) <= limit:
                break
        parts.append((start, wav, probe_len(wav)))
        print(f"  나레이션 {idx + 1}: {probe_len(wav):.1f}초 (허용 {limit:.1f}초, 속도 {rate})")
    return parts


def make_bgm(path):
    sr = 44100
    n = int(TOTAL * sr)
    t = np.arange(n) / sr
    chords = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (261.63, 329.63, 392.0), (196.0, 246.94, 293.66)]  # Am F C G
    sig = np.zeros(n)
    seg = TOTAL / len(chords)
    for ci, ch in enumerate(chords):
        m = (t >= ci * seg) & (t < (ci + 1) * seg)
        tt = t[m]
        env = np.minimum(1, np.minimum((tt - ci * seg) / 0.8, ((ci + 1) * seg - tt) / 0.8))
        for f in ch:
            sig[m] += np.sin(2 * math.pi * f * tt) * env * 0.33
            sig[m] += np.sin(2 * math.pi * f * 2 * tt) * env * 0.08
    sig *= 0.6 + 0.4 * np.sin(2 * math.pi * 0.25 * t)  # 천천히 숨 쉬듯
    sig *= np.minimum(1, np.minimum(t / 1.5, (TOTAL - t) / 1.5))
    sig = sig / np.max(np.abs(sig)) * 0.30
    pcm = (np.stack([sig, sig], 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(sr); f.writeframes(pcm.tobytes())


def mix_audio(work, parts):
    bgm = os.path.join(work, "bgm.wav")
    make_bgm(bgm)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", bgm]
    for _, wav, _ in parts:
        cmd += ["-i", wav]
    fc = ["[0:a]volume=0.22[bg]"]
    labels = ["[bg]"]
    for k, (start, _, _) in enumerate(parts):
        ms = int(start * 1000)
        fc.append(f"[{k + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=1.6,adelay={ms}|{ms}[v{k}]")
        labels.append(f"[v{k}]")
    fc.append("".join(labels) + f"amix=inputs={len(labels)}:duration=longest:normalize=0,alimiter=limit=0.95,atrim=0:{TOTAL}[a]")
    out = os.path.join(work, "audio.wav")
    cmd += ["-filter_complex", ";".join(fc), "-map", "[a]", out]
    subprocess.run(cmd, check=True)
    return out


def main(folder, out, preview=None):
    work = tempfile.mkdtemp(prefix="promo20_")
    shutil.copy(r"C:\Windows\Fonts\malgunbd.ttf", os.path.join(work, "fb.ttf"))
    open(os.path.join(work, "vf.txt"), "w", encoding="utf-8").write(build_filters(work))
    r = Renderer(folder)

    if preview:  # 미리보기: 장면별 대표 프레임(자막 포함)만 PNG로
        os.makedirs(preview, exist_ok=True)
        for T in (1.8, 3.5, 5.6, 7.5, 9.2, 10.4, 11.6, 13.6, 15.5, 18.0):
            frame = os.path.join(work, "f.png")
            cv2.imencode(".png", r.frame(T))[1].tofile(frame)
            vf = f"setpts=PTS+{T}/TB," + open(os.path.join(work, "vf.txt"), encoding="utf-8").read()
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", "f.png", "-vf", vf, "-frames:v", "1",
                 os.path.join(os.path.abspath(preview), f"t{int(T * 10):03d}.png")],
                cwd=work, check=True)
        print("미리보기 저장:", preview)
        return

    parts = make_narration(work)
    audio = mix_audio(work, parts)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", audio,
        "-/vf", "vf.txt",
        "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "160k", "-t", str(TOTAL), "-movflags", "+faststart", os.path.abspath(out),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, cwd=work)
    for fi in range(int(TOTAL * FPS)):
        proc.stdin.write(np.ascontiguousarray(r.frame(fi / FPS)).tobytes())
    proc.stdin.close()
    rc = proc.wait()
    if rc != 0:
        raise SystemExit(f"ffmpeg 실패 (code {rc}), 작업 폴더: {work}")
    shutil.rmtree(work, ignore_errors=True)
    print("완료:", out)


if __name__ == "__main__":
    args = sys.argv[1:]
    prev = None
    if "--preview" in args:
        k = args.index("--preview"); prev = args[k + 1]; del args[k:k + 2]
    main(args[0], args[1] if len(args) > 1 else "promo20.mp4", prev)
