// 직접 촬영한 사진 저장 도구.
//  - 원본은 항상 '사진_원본' 폴더에 보관한다 (글에는 절대 쓰지 않는다).
//  - 모자이크가 끝났다고 대표가 확인한 사진(approved)만 '사진' 폴더에 photo_N 으로 넣고 library.json 에 등록한다.
//    (얼굴이 그대로 나간 사진이 자동으로 글에 쓰이지 않게 하기 위한 안전장치)
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { PHOTO_DIR } from "./blogAssets";
import { DRAFT_DIR } from "./paperBlog";

export const ORIGINAL_DIR = process.env.BLOG_PHOTO_ORIGINAL_DIR || join(DRAFT_DIR, "사진_원본");
const EXTS = new Set([".jpg", ".jpeg", ".png"]);

export interface SavePhotoResult {
  source: string;
  original?: string;
  approvedFile?: string;
  scene?: string;
  status: "saved" | "saved_original_only" | "duplicate" | "error";
  note: string;
}

const sha1 = (p: string) => createHash("sha1").update(readFileSync(p)).digest("hex");
const ymd = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");

function nextNumber(lib: Record<string, unknown>): number {
  const nums = [...Object.keys(lib), ...(existsSync(PHOTO_DIR) ? readdirSync(PHOTO_DIR) : [])]
    .map((f) => f.match(/^photo_(\d+)/)?.[1])
    .filter(Boolean)
    .map(Number);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

/** 사진 한 장을 규칙대로 저장한다. approved=true 일 때만 글에 쓰이는 폴더에 등록한다. */
export function savePhoto(src: string, opts: { scene?: string; approved?: boolean }): SavePhotoResult {
  const ext = extname(src).toLowerCase();
  if (!existsSync(src)) return { source: src, status: "error", note: "파일을 찾을 수 없습니다." };
  if (!EXTS.has(ext)) return { source: src, status: "error", note: `지원하지 않는 형식입니다 (${ext}). jpg/png만 가능합니다.` };
  if (opts.approved && !opts.scene?.trim()) return { source: src, status: "error", note: "승인 사진은 장면 설명(scene)이 필요합니다. 예: '렛풀다운 자세를 손으로 잡아주는 지도 모습'" };

  mkdirSync(ORIGINAL_DIR, { recursive: true });
  mkdirSync(PHOTO_DIR, { recursive: true });

  // 1) 원본 보관 (같은 사진이 이미 있으면 다시 저장하지 않는다)
  const hash = sha1(src);
  const dupOriginal = readdirSync(ORIGINAL_DIR).find((f) => EXTS.has(extname(f).toLowerCase()) && sha1(join(ORIGINAL_DIR, f)) === hash);
  let original: string;
  if (dupOriginal) {
    original = join(ORIGINAL_DIR, dupOriginal);
  } else {
    let n = readdirSync(ORIGINAL_DIR).filter((f) => f.startsWith(`원본_${ymd()}_`)).length + 1;
    let name = `원본_${ymd()}_${n}${ext}`;
    while (existsSync(join(ORIGINAL_DIR, name))) name = `원본_${ymd()}_${++n}${ext}`;
    original = join(ORIGINAL_DIR, name);
    copyFileSync(src, original);
  }

  if (!opts.approved) {
    return {
      source: src,
      original,
      status: dupOriginal ? "duplicate" : "saved_original_only",
      note: `${dupOriginal ? "이미 보관된 원본입니다." : "원본만 보관했습니다."} 글에 쓰려면 얼굴 모자이크를 마친 파일로 다시 등록해 주세요 (승인 + 장면 설명).`,
    };
  }

  // 2) 승인 사진 등록 (모자이크 끝난 파일)
  const libPath = join(PHOTO_DIR, "library.json");
  const lib: Record<string, { scene: string }> = existsSync(libPath) ? JSON.parse(readFileSync(libPath, "utf-8")) : {};
  const dupApproved = Object.keys(lib).find((f) => existsSync(join(PHOTO_DIR, f)) && sha1(join(PHOTO_DIR, f)) === hash);
  if (dupApproved) return { source: src, original, approvedFile: join(PHOTO_DIR, dupApproved), status: "duplicate", note: `이미 등록된 사진입니다 (${dupApproved}).` };
  const file = `photo_${nextNumber(lib)}${ext === ".jpeg" ? ".jpg" : ext}`;
  copyFileSync(src, join(PHOTO_DIR, file));
  lib[file] = { scene: opts.scene!.trim() };
  writeFileSync(libPath, JSON.stringify(lib, null, 2), "utf-8");
  return { source: src, original, approvedFile: join(PHOTO_DIR, file), scene: lib[file].scene, status: "saved", note: `승인 사진 ${file}로 등록했습니다. 다음 글부터 순환에 들어갑니다.` };
}

/** 폴더 안의 사진 전체를 같은 옵션으로 저장한다. */
export function savePhotos(paths: string[], opts: { scene?: string; approved?: boolean }): SavePhotoResult[] {
  const files = paths.flatMap((p) => {
    try {
      return existsSync(p) && !EXTS.has(extname(p).toLowerCase()) && readdirSync(p).length
        ? readdirSync(p).filter((f) => EXTS.has(extname(f).toLowerCase())).map((f) => join(p, f))
        : [p];
    } catch {
      return [p];
    }
  });
  return files.map((f) => savePhoto(f, opts));
}

export { basename };
