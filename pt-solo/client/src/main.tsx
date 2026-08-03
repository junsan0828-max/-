import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { Toaster, toast } from "sonner";
import App from "./App";
import { trpc } from "./lib/trpc";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // 새 배포가 있는지 즉시 확인 + 이후 주기적으로 재확인.
      // (지금까지는 한 번 등록하고 끝이라, 새 버전을 배포해도 이미 앱을 설치/실행
      //  중인 사용자 화면은 완전히 종료 후 재실행하기 전까진 예전 버전에 계속 머물렀음 —
      //  "분명 고쳤는데 왜 그대로냐"의 실제 원인 중 하나)
      reg.update();
      setInterval(() => reg.update(), 30 * 60 * 1000);
    }).catch(() => {});
  });

  // 새 서비스워커가 활성화되면(= 새 배포가 반영되면) 자동으로 새로고침해서
  // 사용자가 수동으로 앱을 껐다 켜지 않아도 최신 화면을 보게 한다.
  let swRefreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });
}

function handleUnauthorized() {
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
