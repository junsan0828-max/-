# 25초 세로 숏폼(네이버 클립) 제작 — 원본 사진을 편집만 한다 (인물을 움직이거나 변형하지 않는다).
#  python make_shortform.py <출력.mp4>
# 사진 장면: 부드러운 확대 + 화면 이동(Ken Burns), 장면 사이는 0.4초 디졸브.
# 자막: ffmpeg drawtext (한글 고딕 1종: 맑은 고딕, 굵기로 강조). 자막 문구·시간은 아래 CAPTIONS 에서 고친다.
# 음악: 이 스크립트가 직접 합성한 자체 제작 배경음 (저작권 문제 없음). 바꾸려면 MUSIC 경로에 파일을 지정한다.
import math
import os
import shutil
import subprocess
import sys
import tempfile
import wave

import cv2
import numpy as np

ROOT = r"C:\Users\junsa\OneDrive\바탕 화면\트레이닝 이미지"
PHOTOS = {
    "B": "KakaoTalk_20260810_222241491_01.jpg",  # 흰/회색 상의 트레이너가 여성 회원의 덤벨 자세 지도
    "D": "KakaoTalk_20260731_225857378_01.jpg",  # 회색 상의 트레이너가 벤치 덤벨 보조
    "C": "KakaoTalk_20260326_213824374_04.jpg",  # 검은 상의 트레이너가 다리를 벌린 회원의 몸통 지도
    "A": "KakaoTalk_20260707_224650170_08.jpg",  # 회색 상의 트레이너가 벤치에서 옆으로 기운 회원의 어깨 지도
}
BEFORE_AFTER = os.path.join(ROOT, "비포에프터", "14.png")
MUSIC = None  # 외부 음악 파일 경로를 주면 그것을 쓴다 (None 이면 자체 합성)

W, H, FPS, TOTAL = 1080, 1920, 30, 25.0
XF = 0.4  # 장면 사이 디졸브(초)
SAFE_X = 480  # 자막 가운데 x (오른쪽 플랫폼 버튼 영역을 피해 왼쪽으로 20px 이동)
BLUE = "0x0B2C7A"  # 진한 블루 포인트

# ── 장면: (시작, 길이, 종류, 사진, 시작 구도, 끝 구도) ────────────────────────────
#  cover  : 화면 가득 (cx, cy, h) = 원본에서 잘라낼 창의 중심과 높이 (폭은 9:16 으로 자동)
#  boxed  : 사진 전체 구도를 가로폭에 맞춰 넣고 위아래는 같은 사진을 흐리게 채움 (x, y, w, h) = 창, cy = 화면 중심 y
SCENES = [
    (0.0, 4.0, "cover", "B", (520, 700, 1400), (520, 600, 1000)),
    (4.0, 4.0, "cover", "D", (560, 700, 1400), (590, 700, 800)),
    (8.0, 4.0, "boxed", "C", (20, 130, 1010, 828), (70, 150, 920, 754), 860),
    (12.0, 4.0, "cover", "A", (520, 700, 1400), (680, 780, 1000)),
]
EA_START = 16.0  # 비포·애프터 장면 (끝 장면 오버레이 포함 25초까지)

# ── 자막: (시작, 끝, 글자, 크기, 굵게, y) — 모두 편집 가능한 텍스트 ───────────────────
CAPTIONS = [
    (0, 4, "운동할 때,\n내 자세가 맞는지 모르겠다면?", 58, True, 1230),
    (4, 8, "팔의 위치를 살피고", 62, True, 1300),
    (8, 12, "몸의 균형을 확인하고", 62, True, 1380),
    (12, 16, "내 몸에 맞춰\n동작을 조절합니다", 62, True, 1260),
    (16, 22, "실제 회원의 운동 전후 비교", 56, True, 1385),
    (16, 22, "개인별 변화는 다를 수 있습니다", 32, False, 1470),
]
END_TEXTS = [  # 22~25초 마무리 (글자, 크기, 굵게, y, 파란 박스)
    ("내 몸에 맞는 운동", 88, True, 690, False),
    ("맞춤운동센터 자이언트짐", 62, True, 840, True),
    ("네이버에서 자이언트짐 검색", 50, False, 990, False),
]
END_START = 22.0


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


def warp(img, k, tx, ty, size=(W, H)):
    M = np.array([[k, 0, tx], [0, k, ty]], np.float32)
    return cv2.warpAffine(img, M, size, flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


def cover_frame(img, cx, cy, h):
    ih, iw = img.shape[:2]
    w = h * W / H
    x0 = min(max(cx - w / 2, 0), iw - w)
    y0 = min(max(cy - h / 2, 0), ih - h)
    k = H / h
    return warp(img, k, -k * x0, -k * y0)


def blurred_bg(img):
    bg = cover_frame(img, img.shape[1] / 2, img.shape[0] / 2, img.shape[0])
    bg = cv2.GaussianBlur(cv2.resize(bg, (W // 4, H // 4)), (0, 0), 9)
    return (cv2.resize(bg, (W, H), interpolation=cv2.INTER_CUBIC) * 0.5).astype(np.uint8)


def boxed_frame(img, bg, win, cy):
    x, y, w, h = win
    k = W / w
    hf = k * h
    oy = cy - hf / 2
    fg = warp(img, k, -k * x, oy - k * y)
    out = bg.copy()
    y1, y2 = int(round(oy)), int(round(oy + hf))
    out[y1:y2] = fg[y1:y2]
    return out


def build_before_after():
    im = imread(BEFORE_AFTER)
    before = im[264:523, 35:501]  # 원본 BEFORE 사진 (빨간 표시 포함, 자르지 않음)
    after = im[264:543, 765:1237]  # 원본 AFTER 사진
    s = 1.9  # 두 사진 동일 배율
    b = cv2.resize(before, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
    a = cv2.resize(after, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
    canvas = np.full((H, W, 3), (22, 14, 10), np.uint8)  # 아주 어두운 남색(BGR)
    def put(p, y):
        x = (W - p.shape[1]) // 2 - 20  # 오른쪽 플랫폼 버튼 영역을 피해 살짝 왼쪽
        canvas[y:y + p.shape[0], x:x + p.shape[1]] = p
    put(b, 190)
    put(a, 810)
    return canvas


class Renderer:
    def __init__(self):
        self.imgs = {k: imread(os.path.join(ROOT, v)) for k, v in PHOTOS.items()}
        self.bgs = {"C": blurred_bg(self.imgs["C"])}
        self.ea = build_before_after()

    def scene_frame(self, i, T):
        s, d, kind, key, a, b, *rest = SCENES[i]
        p = smooth((T - s) / d)
        img = self.imgs[key]
        v = lerp(a, b, p)
        if kind == "cover":
            return cover_frame(img, *v)
        return boxed_frame(img, self.bgs[key], v, rest[0])

    def frame(self, T):
        n = len(SCENES)
        for i in range(n):
            s, d = SCENES[i][0], SCENES[i][1]
            end = s + d
            if T < end - XF:
                return self.scene_frame(i, T)
            if T < end:
                nxt = self.scene_frame(i + 1, T) if i + 1 < n else self.ea
                al = (T - (end - XF)) / XF
                return cv2.addWeighted(self.scene_frame(i, T), 1 - al, nxt, al, 0)
        return self.ea


def synth_music(path, dur=TOTAL, sr=44100):
    """차분하면서 리듬감 있는 자체 제작 배경음 (코드 진행 Am–F–C–G, 패드 + 아르페지오 + 가벼운 킥/하이햇)."""
    rng = np.random.default_rng(7)
    n = int(dur * sr)
    t = np.arange(n) / sr
    bpm = 96.0
    beat = 60.0 / bpm
    mix = np.zeros(n)
    f = lambda m: 440.0 * 2 ** ((m - 69) / 12)
    chords = [(57, 60, 64), (53, 57, 60), (48, 52, 55), (55, 59, 62)]  # Am F C G (낮은 옥타브)
    bar = beat * 4
    def add(sig, start):
        i = int(start * sr)
        j = min(n, i + len(sig))
        if i < n:
            mix[i:j] += sig[: j - i]
    for bi in range(int(dur / bar) + 2):
        ch = chords[bi % 4]
        st = bi * bar
        ln = int(bar * sr)
        tt = np.arange(ln) / sr
        env = np.minimum(tt / 0.6, 1) * np.minimum((bar - tt) / 0.5, 1).clip(0, 1)
        pad = sum(np.sin(2 * math.pi * f(m + 12) * tt) + 0.4 * np.sin(2 * math.pi * f(m + 24) * tt) for m in ch)
        add(0.045 * pad * env, st)
        add(0.05 * np.sin(2 * math.pi * f(ch[0] - 12) * tt) * env, st)  # 베이스
        # 아르페지오: 8분음표
        arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12, ch[0] + 12]
        for k, m in enumerate(arp):
            tt2 = np.arange(int(0.45 * sr)) / sr
            pl = np.sin(2 * math.pi * f(m) * tt2) * np.exp(-tt2 * 7.5)
            pl += 0.3 * np.sin(2 * math.pi * 2 * f(m) * tt2) * np.exp(-tt2 * 11)
            add(0.07 * pl, st + k * beat / 2)
        for q in range(4):  # 킥(1,3박) / 하이햇(엇박)
            if q in (0, 2):
                tk = np.arange(int(0.25 * sr)) / sr
                kick = np.sin(2 * math.pi * (50 + 90 * np.exp(-tk * 30)) * tk) * np.exp(-tk * 12)
                add(0.22 * kick, st + q * beat)
            th = np.arange(int(0.05 * sr)) / sr
            hat = rng.standard_normal(len(th)) * np.exp(-th * 90)
            hat = np.diff(hat, prepend=0)
            add(0.05 * hat, st + q * beat + beat / 2)
    mix *= np.minimum(t / 0.6, 1) * np.minimum((dur - t) / 2.0, 1).clip(0, 1)  # 페이드 인/아웃
    mix = np.tanh(mix * 1.6) * 0.55
    st_ = np.stack([mix, np.roll(mix, 180) * 0.97], 1)  # 아주 약한 스테레오 폭
    pcm = (st_ * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def drawtext(work, idx, text, size, bold, y, start, end, box=True, color="white"):
    tf = f"t{idx}.txt"
    open(os.path.join(work, tf), "w", encoding="utf-8", newline="").write(text)
    font = "fb.ttf" if bold else "fr.ttf"
    b = f":box=1:boxcolor={BLUE}@0.78:boxborderw=26" if box else ""
    return (
        f"drawtext=textfile='{tf}':fontfile='{font}':fontsize={size}:fontcolor={color}:text_align=center:line_spacing=16"
        f"{b}:x={SAFE_X}-text_w/2:y={y}:enable='between(t,{start},{end})'"
    )


def main(out):
    work = tempfile.mkdtemp(prefix="shortform_")
    shutil.copy(r"C:\Windows\Fonts\malgunbd.ttf", os.path.join(work, "fb.ttf"))
    shutil.copy(r"C:\Windows\Fonts\malgun.ttf", os.path.join(work, "fr.ttf"))
    music = MUSIC or os.path.join(work, "bgm.wav")
    if not MUSIC:
        synth_music(music)

    filters = []
    i = 0
    for (s, e, text, size, bold, y) in CAPTIONS:
        small = size < 40
        filters.append(drawtext(work, i, text, size, bold, y, s, e, box=not small))
        i += 1
    # BEFORE / AFTER 라벨 (비포·애프터 장면)
    filters.append(drawtext(work, i, "BEFORE", 50, True, 100, EA_START, END_START)); i += 1
    filters.append(drawtext(work, i, "AFTER", 50, True, 720, EA_START, END_START)); i += 1
    # 마무리: 어두운 반투명 배경 + 문구
    filters.append(f"drawbox=x=0:y=0:w=iw:h=ih:color=black@0.74:t=fill:enable='between(t,{END_START},{TOTAL})'")
    filters.append(f"drawbox=x={SAFE_X - 60}:y=640:w=120:h=8:color=0x2F7BFF@1:t=fill:enable='between(t,{END_START},{TOTAL})'")
    for (text, size, bold, y, box) in END_TEXTS:
        filters.append(drawtext(work, i, text, size, bold, y, END_START, TOTAL, box=box)); i += 1
    script = os.path.join(work, "vf.txt")
    open(script, "w", encoding="utf-8").write(",".join(filters))

    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", music,
        "-/vf", "vf.txt",
        "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-t", str(TOTAL), "-movflags", "+faststart", os.path.abspath(out),
    ]
    r = Renderer()
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, cwd=work)
    nframes = int(TOTAL * FPS)
    for fi in range(nframes):
        proc.stdin.write(np.ascontiguousarray(r.frame(fi / FPS)).tobytes())
    proc.stdin.close()
    rc = proc.wait()
    if rc != 0:
        raise SystemExit(f"ffmpeg 실패 (code {rc}), 작업 폴더: {work}")
    shutil.rmtree(work, ignore_errors=True)
    print("완료:", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "shortform.mp4")
