// Feed-style autoplay: a video starts loading + playing (muted, looped) once
// it's scrolled far enough into view, and pauses once it isn't --
// IntersectionObserver's intersection ratio is naturally clipped by a
// horizontal carousel's own scroll container too, so only the
// currently-visible slide of a multi-media post autoplays. `src` is only
// ever attached the first time a video becomes visible (via `data-src`), so
// a video nobody scrolls to never downloads anything.
export function wireVideoAutoplay(container: ParentNode) {
	container.querySelectorAll<HTMLVideoElement>('.js-autoplay-video').forEach((video) => {
		video.addEventListener('click', () => {
			if (video.paused) video.play();
			else video.pause();
		});
	});

	container.querySelectorAll<HTMLButtonElement>('.js-video-mute-toggle').forEach((btn) => {
		const video = btn.closest('.js-video-wrap')?.querySelector<HTMLVideoElement>('.js-autoplay-video');
		if (!video) return;
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			video.muted = !video.muted;
			btn.textContent = video.muted ? '🔇' : '🔊';
		});
	});

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				const video = entry.target as HTMLVideoElement;
				if (entry.isIntersecting) {
					if (!video.src && video.dataset.src) video.src = video.dataset.src;
					video.play().catch(() => {});
				} else {
					video.pause();
				}
			});
		},
		{ threshold: 0.6 },
	);
	container.querySelectorAll<HTMLVideoElement>('.js-autoplay-video').forEach((video) => observer.observe(video));
}
