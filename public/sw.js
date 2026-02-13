self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'QRLABEL';
  const body = data.body || '';
  const url = data.url || '/owner';

  const options = {
    body,
    data: { url },
    icon: '/favicon.ico',
    badge: '/favicon.ico',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/owner';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url && new URL(client.url).origin === self.location.origin) {
          try {
            await client.navigate(url);
          } catch {}
          if ('focus' in client) return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
