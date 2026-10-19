const URL_RE = /(https?:\/\/[^\s]+)/;

/** 글 속 http(s) 주소를 새 탭 링크로 바꿔 보여준다 */
export function Linkify({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        URL_RE.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-primary underline underline-offset-2 break-all hover:opacity-80">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
