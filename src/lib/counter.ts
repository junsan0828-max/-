const SB_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const SB_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

export async function incCounter(key: string): Promise<void> {
  if (!SB_URL || !SB_KEY) return;
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/dp_inc_counter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({ p_key: key }),
    });
  } catch { /* ignore */ }
}

// total + daily counter pair, e.g. track("sq", "u") -> sq_uc, sq_ud_YYYYMMDD
export function track(prefix: string, kind: "v" | "u" | "s"): void {
  const daily = kind === "v" ? "vt" : kind === "u" ? "ud" : "st";
  incCounter(`${prefix}_${kind}c`);
  incCounter(`${prefix}_${daily}_${todayKey()}`);
}
