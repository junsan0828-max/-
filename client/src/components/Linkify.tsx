const URL_RE = /(https?:\/\/[^\s]+)/;
// 공지 기본 문구의 "▶ 전체 업무: https://..." 줄
const LINK_LINE_RE = /^\s*▶\s*(.+?)\s*:\s*(https?:\/\/\S+)\s*$/;

const btn = "inline-flex items-center justify-center gap-1 px-3 py-2 my-1 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 no-underline";

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={btn}>
      {label}
    </a>
  );
}

/** 공지 본문: 주소는 글자 대신 버튼으로 보여준다 */
export function Linkify({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <>
      {text.split("\n").map((line, li, arr) => {
        const m = line.match(LINK_LINE_RE);
        if (m) return <div key={li}><LinkButton href={m[2]} label={`📌 ${m[1]} 보기`} /></div>;
        return (
          <span key={li}>
            {line.split(URL_RE).map((part, i) =>
              URL_RE.test(part) ? <LinkButton key={i} href={part} label="🔗 링크 열기" /> : <span key={i}>{part}</span>,
            )}
            {li < arr.length - 1 && "\n"}
          </span>
        );
      })}
    </>
  );
}

/** 목록 미리보기용: 주소를 뺀 글 + 작은 링크 버튼 */
export function NoticePreview({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const buttons: { href: string; label: string }[] = [];
  const body = text.split("\n").map(line => {
    const m = line.match(LINK_LINE_RE);
    if (m) { buttons.push({ href: m[2], label: `📌 ${m[1]} 보기` }); return ""; }
    return line.replace(/https?:\/\/\S+/g, url => { buttons.push({ href: url, label: "🔗 링크 열기" }); return ""; });
  }).join(" ").replace(/\s+/g, " ").trim();
  return (
    <>
      {body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{body}</p>}
      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {buttons.map((b, i) => (
            <a key={i} href={b.href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary/15 border border-primary/40 text-primary text-xs font-medium hover:bg-primary/25">
              {b.label}
            </a>
          ))}
        </div>
      )}
    </>
  );
}
