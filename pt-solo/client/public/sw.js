// 예전엔 여기서 모든 GET 요청을 가로채 "네트워크 우선, 실패 시 캐시" 방식으로
// 응답했는데, 이게 "카톡/사파리/크롬 가리지 않고 계속 파란 빈 화면만 나온다"
// 라는 심각한 신고와 정확히 들어맞는 구조적 위험을 안고 있었다: 네트워크
// 요청이 어떤 이유로든 실패하면 caches.match()로 대체 응답을 찾는데, 그
// 요청이 캐시에 아예 없으면(방금 캐시를 비웠거나 처음 방문한 경로라면)
// undefined를 respondWith에 넘기게 되어 완전히 빈 응답 = 흰/빈 화면이 됨.
// 이 앱은 실시간 데이터가 중요한 대시보드라 오프라인 캐싱의 이득보다
// 이 실패 위험이 훨씬 크므로, 요청 가로채기 자체를 없앤다. 정적 파일 캐싱은
// 서버의 Cache-Control 헤더로 이미 올바르게 처리되고 있다(index.html/sw.js는
// 절대 캐시 안 함, 해시 붙은 JS/CSS는 안전하게 캐시). 서비스워커는 이제
// 웹 푸시 알림 수신 용도로만 사용한다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// ── 웹 푸시 알림 ─────────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  let data = { title: "FIT STEP", body: "새 알림이 있습니다.", url: "/" };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
