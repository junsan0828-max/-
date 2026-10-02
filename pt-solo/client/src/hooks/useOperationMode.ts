import { trpc } from "@/lib/trpc";

export type OperationMode = "membership" | "sessions" | "both";

export function useOperationMode(): OperationMode {
  const { data: me } = trpc.auth.me.useQuery();
  return ((me as any)?.operationMode as OperationMode) ?? "both";
}

export function useHasMembership(): boolean {
  const mode = useOperationMode();
  return mode === "membership" || mode === "both";
}

export function useHasSessions(): boolean {
  const mode = useOperationMode();
  return mode === "sessions" || mode === "both";
}
