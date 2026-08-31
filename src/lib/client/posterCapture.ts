// Client-side video thumbnail capture -- there's no server-side video
// processing anywhere in this app. A hidden <video> decodes a frame, a
// <canvas> grabs it. Shared by every place that needs a poster: the Feed
// compose dialog (captures from a File before upload), the album upload
// forms (same), and the one-time admin backfill tool (captures from an
// already-uploaded video's URL instead of a local File).

// Filename marker a poster File is tagged with so the server-side upload
// handler (uploadPostMedia / uploadPhotosToAlbum) can recognize it and pair
// it with the video that precedes it in the same upload, instead of
// treating it as a separate attached photo.
export const POSTER_MARKER = '__poster__.';

function captureFrame(video: HTMLVideoElement): Promise<Blob | null> {
	return new Promise((resolve) => {
		video.addEventListener('error', () => resolve(null), { once: true });
		video.addEventListener(
			'loadedmetadata',
			() => {
				video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
			},
			{ once: true },
		);
		video.addEventListener(
			'seeked',
			() => {
				try {
					const canvas = document.createElement('canvas');
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;
					const ctx = canvas.getContext('2d');
					if (!ctx || canvas.width === 0 || canvas.height === 0) return resolve(null);
					ctx.drawImage(video, 0, 0);
					canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
				} catch {
					resolve(null);
				}
			},
			{ once: true },
		);
	});
}

export async function capturePosterFromFile(videoFile: File): Promise<File | null> {
	const url = URL.createObjectURL(videoFile);
	const video = document.createElement('video');
	video.src = url;
	video.muted = true;
	video.playsInline = true;
	const blob = await captureFrame(video);
	URL.revokeObjectURL(url);
	return blob ? new File([blob], `${POSTER_MARKER}jpg`, { type: 'image/jpeg' }) : null;
}

export async function capturePosterFromUrl(url: string): Promise<Blob | null> {
	const video = document.createElement('video');
	video.src = url;
	video.muted = true;
	video.playsInline = true;
	return captureFrame(video);
}
