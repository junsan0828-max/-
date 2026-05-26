self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "새 메시지", body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "ZIANTGYM+", {
      body: data.body || "",
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      data: { url: data.url || "/gym-plus/messages" },
      vibrate: [200, 100, 200],
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
