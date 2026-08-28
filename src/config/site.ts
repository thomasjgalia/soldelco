export const EXTERNAL_LINKS = {
	golf: 'https://golf.soldelco.com',
	cornhole: 'https://cornhole.soldelco.com',
};

// Safe to ship to every browser -- this is the public half of the VAPID key
// pair used to sign Web Push messages; only VAPID_PRIVATE_KEY (a Worker
// secret) can actually send a push.
export const VAPID_PUBLIC_KEY = 'BIEjA3-jSjyfN1RaiVq2UFMnFGrLDLi0DRz2gDEAufgtsRdn7TlvNhpBZuOeUI9sKg5tgOI80zf3u5sAibcPGMY';
