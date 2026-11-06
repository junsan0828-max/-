self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "새 메시지", body: event.data.text() }; }
  // 운영시스템 화면이 열려 있으면 바로 알려 띵동을 울리게 한다 (10초 폴링을 기다리지 않음)
  // 테스트 알림도 화면이 열려 있으면 같은 띵동을 울려 소리까지 확인할 수 있게 한다
  const tag = String(data.tag || "");
  if (tag.startsWith("staff-call") || tag.startsWith("test")) {
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => list.forEach((c) => c.postMessage({ type: tag.startsWith("test") ? "test-alert" : "staff-call" })));
  }
  // 같은 앱 알림이 알림창에 쌓이면 안드로이드가 묶음 처리하면서 새 알림을 무음으로 띄우거나
  // (알림 쿨다운) 연속 알림의 소리를 줄인다. 지난 테스트 알림은 새 알림 전에 지운다.
  const clearOld = tag.startsWith("test")
    ? self.registration.getNotifications().then((list) => list.forEach((n) => { if (String(n.tag || "").startsWith("test")) n.close(); }))
    : Promise.resolve();
  event.waitUntil(clearOld.then(() =>
    self.registration.showNotification(data.title || "ZIANTGYM+", {
      body: data.body || "",
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      data: { url: data.url || "/gym-plus/messages" },
      vibrate: [200, 100, 200],
      ...(data.tag ? { tag: data.tag, renotify: true } : {}),
      ...(data.requireInteraction ? { requireInteraction: true } : {}),
      silent: false,
    })
  ));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/gym-plus/messages";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
