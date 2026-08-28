// Minimal service worker: exists only to receive push events and route
// notification taps. No caching/offline support -- this site is dynamic
// (RSVPs, photos, live data), so pretending to work offline would just risk
// showing stale content instead of actually helping anyone.

self.addEventListener('install', (event) => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
	let data = { title: 'SOL', body: '' };
	try {
		data = event.data.json();
	} catch {
		// Non-JSON payload (shouldn't happen given how we send these) -- fall
		// back to the default above rather than throwing.
	}

	event.waitUntil(
		self.registration.showNotification(data.title || 'SOL', {
			body: data.body || '',
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			data: { url: data.url || '/' },
		}),
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = event.notification.data?.url || '/';
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			for (const client of clients) {
				if (client.url === url && 'focus' in client) return client.focus();
			}
			return self.clients.openWindow(url);
		}),
	);
});
