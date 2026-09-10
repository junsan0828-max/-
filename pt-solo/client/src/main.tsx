import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { Toaster, toast } from "sonner";
import App from "./App";
import { trpc } from "./lib/trpc";
import "./index.css";

// 카카오톡 인앱 브라우저는 별도의 WebView라 서비스워커·캐시 동작이
// 사파리/크롬과 다르게 굴 때가 있다 (배포해도 계속 예전 화면이 보이는
// 문제의 실제 원인이었음 — "웹에서는 되는데 카톡으로 들어가면 안 된다").
// 안드로이드는 intent 스킴으로 기본 브라우저(크롬)로 안전하게 자동 전환된다.
if (/KAKAOTALK/i.test(navigator.userAgent) && /Android/i.test(navigator.userAgent)) {
  const target = window.location.href.replace(/^https?:\/\//, "");
  window.location.href = `intent://${target}#Intent;scheme=https;package=com.android.chrome;end`;
} else if (/KAKAOTALK/i.test(navigator.userAgent)) {
  // iOS 카카오톡 인앱 브라우저는 안드로이드처럼 자동으로 빠져나갈 방법이 없어서
  // (intent 스킴이 없음), 배너로 안내한다. React 렌더링과 무관하게 항상 뜨도록
  // React 트리 밖에서 순수 DOM으로 직접 삽입.
  window.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:#fee500;color:#191919;padding:10px 14px;font-size:13px;text-align:center;line-height:1.4;box-shadow:0 2px 6px rgba(0,0,0,.15);";
    bar.innerHTML = `카카오톡 브라우저에서는 일부 화면이 깨질 수 있어요. 우측 상단 <b>⋯</b> 메뉴 → <b>"Safari로 열기"</b>를 눌러주세요. <span style="margin-left:8px;text-decoration:underline;cursor:pointer;" id="kakao-banner-close">닫기</span>`;
    document.body.prepend(bar);
    document.getElementById("kakao-banner-close")?.addEventListener("click", () => bar.remove());
  });
}

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
