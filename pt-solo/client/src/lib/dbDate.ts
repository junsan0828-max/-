// Postgres now()::text 형식("2026-07-17 05:23:45.123456+00")은 iOS Safari의
// new Date()가 파싱하지 못한다 → ISO 형식으로 정규화 후 파싱 (MemberDetail의 parseDate와 동일 접근)
export function parseDbDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const normalized = s
    .replace(" ", "T")
    .replace(/\.(\d{3})\d+/, ".$1")
    .replace(/\+(\d{2})$/, "+$1:00");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDbDate(s: string | null | undefined): string {
  const d = parseDbDate(s);
  return d ? d.toLocaleDateString("ko-KR") : "-";
}

export function fmtDbDateTime(s: string | null | undefined): string {
  const d = parseDbDate(s);
  return d ? d.toLocaleString("ko-KR") : "-";
}
