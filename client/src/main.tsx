import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { Toaster, toast } from "sonner";
import App from "./App";
import { trpc } from "./lib/trpc";
import "./index.css";

// 홈 화면 바로가기(standalone)로 열었을 때 옛날 "/" 링크 → /gym-plus 자동 이동
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as any).standalone === true;
if (isStandalone && window.location.pathname === "/") {
  window.location.replace("/gym-plus");
}

function handleUnauthorized() {
  // 짐플러스 페이지에서는 관리시스템 리다이렉트 안 함
  if (window.location.pathname.startsWith("/gym-plus")) return;
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
