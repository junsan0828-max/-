import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { Toaster, toast } from "sonner";
import App from "./App";
import { trpc } from "./lib/trpc";
import "./index.css";


// 새 버전 배포 감지: 열어 둔 창이 옛 화면에 머물지 않도록 index.html의 번들 이름을 주기적으로 비교한다
const bundleOf = (html: string) => html.match(/\/assets\/index-[\w-]+\.js/)?.[0] ?? null;
const currentBundle = bundleOf(document.documentElement.innerHTML);
let updateNotified = false;
async function checkForUpdate() {
  if (updateNotified || !currentBundle || document.visibilityState !== "visible") return;
  try {
    const latest = bundleOf(await (await fetch("/", { cache: "no-store" })).text());
    if (latest && latest !== currentBundle) {
      updateNotified = true;
      toast("새 버전이 있습니다", {
        description: "새로고침하면 최신 화면으로 바뀝니다.",
        duration: Infinity,
        action: { label: "새로고침", onClick: () => window.location.reload() },
      });
    }
  } catch {}
}
setInterval(checkForUpdate, 3 * 60 * 1000);
document.addEventListener("visibilitychange", checkForUpdate);
window.addEventListener("focus", checkForUpdate);

function handleUnauthorized() {
  // 세션 만료 시 로그인 페이지로 이동
  toast.error("세션이 만료되었습니다. 다시 로그인해주세요.");
  setTimeout(() => { window.location.href = "/"; }, 1200);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.data?.code === "UNAUTHORIZED") return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

// 전역 UNAUTHORIZED 핸들러
queryClient.getQueryCache().config.onError = (error: any) => {
  if (error?.data?.code === "UNAUTHORIZED") handleUnauthorized();
};
queryClient.getMutationCache().config.onError = (error: any) => {
  if (error?.data?.code === "UNAUTHORIZED") handleUnauthorized();
};

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/trpc",
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);
