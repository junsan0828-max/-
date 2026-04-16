import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { Toaster } from "sonner";
import App from "./App";
import { trpc } from "./lib/trpc";
import "./index.css";

// 전역 에러 캐치 - 검은 화면 대신 에러 메시지 표시
window.onerror = (msg, src, line, col, err) => {
  document.body.innerHTML = `<div style="color:#ff6b6b;background:#1a1a2e;padding:20px;font-family:monospace;white-space:pre-wrap;word-break:break-all">
<b>앱 오류 발생</b>\n${msg}\n${src}:${line}:${col}\n${err?.stack ?? ""}
</div>`;
};
window.onunhandledrejection = (e) => {
  document.body.innerHTML = `<div style="color:#ff6b6b;background:#1a1a2e;padding:20px;font-family:monospace;white-space:pre-wrap;word-break:break-all">
<b>Promise 오류</b>\n${e.reason}
</div>`;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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

const root = document.getElementById("root");
if (!root) {
  document.body.innerHTML = '<div style="color:red;padding:20px">root 엘리먼트를 찾을 수 없습니다</div>';
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster position="top-center" richColors />
        </QueryClientProvider>
      </trpc.Provider>
    </React.StrictMode>
  );
}
