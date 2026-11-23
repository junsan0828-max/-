const SB_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const SB_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

export type Rank = { name: string; reps: number; at: number };

const headers = () => ({
  "Content-Type": "application/json",
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
});

/** 이번 달 순위 3위까지. 서버를 못 쓰면 null (호출한 쪽에서 기기 저장으로 대체) */
export async function fetchTop(ex: string, dur: number): Promise<Rank[] | null> {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/mc_rank_top`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ p_ex: ex, p_dur: dur }),
    });
    if (!r.ok) return null;
    const rows: unknown = await r.json();
    if (!Array.isArray(rows)) return null;
    return rows
      .filter((x): x is { name: string; reps: number; created_at: string } =>
        !!x && typeof x.name === "string" && typeof x.reps === "number")
      .map((x) => ({ name: x.name, reps: x.reps, at: Date.parse(x.created_at) || Date.now() }));
  } catch { return null; }
}

/** 기록 올리기. 성공하면 true */
export async function addRank(ex: string, dur: number, name: string, reps: number): Promise<boolean> {
  if (!SB_URL || !SB_KEY) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/mc_rank_add`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ p_ex: ex, p_dur: dur, p_name: name, p_reps: reps }),
    });
    return r.ok;
  } catch { return false; }
}
