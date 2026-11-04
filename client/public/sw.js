self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "새 메시지", body: event.data.text() }; }
  // 운영시스템 화면이 열려 있으면 바로 알려 띵동을 울리게 한다 (10초 폴링을 기다리지 않음)
  if (data.tag && String(data.tag).startsWith("staff-call")) {
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => list.forEach((c) => c.postMessage({ type: "staff-call" })));
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "ZIANTGYM+", {
      body: data.body || "",
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      data: { url: data.url || "/gym-plus/messages" },
      vibrate: [200, 100, 200],
      ...(data.tag ? { tag: data.tag, renotify: true } : {}),
      ...(data.requireInteraction ? { requireInteraction: true } : {}),
    })
  );
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
