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
	// event.notification.data.url is relative ('/feed'); client.url is always
	// absolute ('https://soldelco.com/feed') -- comparing them directly never
	// matches, so the "focus the matching tab" branch never ran, for any
	// notification. Resolve both to an absolute URL, and navigate an existing
	// window to it explicitly rather than relying on openWindow() to do that
	// (unreliable for an already-open-but-backgrounded window, especially on
	// iOS, where a backgrounded installed PWA often just gets foregrounded
	// as-is instead of actually navigating).
	const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
			const client = clients[0];
			if (!client) return self.clients.openWindow(target);
			if (client.url !== target && 'navigate' in client) await client.navigate(target);
			return client.focus();
		}),
	);
});
