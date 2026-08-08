self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Focus the first available window
      let matchingClient = windowClients.length > 0 ? windowClients[0] : null;

      if (matchingClient) {
        matchingClient.focus();
        // Send a postMessage to navigate to the specific channel/DM
        matchingClient.postMessage({
          type: 'NAVIGATE',
          payload: event.notification.data
        });
      } else {
        // If no window is open, open a new one (less common if they just minimized)
        self.clients.openWindow('/');
      }
    })
  );
});

// Setup for future push events
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, data.options)
    );
  }
});
