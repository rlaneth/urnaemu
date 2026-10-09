// Candidate photos for the -fo.dat: JPEG at the size of the bundled photos (161×225 for a
// titular, 111×155 for a vice or suplente). Browser only (canvas).
import { PHOTO_SIZE } from './candidates.js';

async function jpeg(canvas) {
	const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
	return new Uint8Array(await blob.arrayBuffer());
}
function canvasOf([width, height]) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

/** Neutral placeholder: a gray silhouette with the initials of the name. */
export async function placeholderPhoto(name, role = 'titular') {
	const size = PHOTO_SIZE[role], [w, h] = size, canvas = canvasOf(size), g = canvas.getContext('2d');
	g.fillStyle = '#dfe3ea';
	g.fillRect(0, 0, w, h);
	g.fillStyle = '#a9b1bf';
	g.beginPath();
	g.arc(w / 2, h * 0.38, w * 0.22, 0, Math.PI * 2);
	g.fill();
	g.beginPath();
	g.ellipse(w / 2, h * 1.02, w * 0.44, h * 0.36, 0, Math.PI, 0);
	g.fill();
	const initials = String(name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
	g.fillStyle = '#fff';
	g.font = `600 ${Math.round(w * 0.16)}px sans-serif`;
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillText(initials, w / 2, h * 0.38);
	return jpeg(canvas);
}

/** A user image (File or Blob), cropped to the photo proportion and scaled to its size. */
export async function photoFromImage(file, role = 'titular') {
	const size = PHOTO_SIZE[role], [w, h] = size, canvas = canvasOf(size), g = canvas.getContext('2d');
	const image = await createImageBitmap(file);
	const scale = Math.max(w / image.width, h / image.height);
	const sw = w / scale, sh = h / scale;
	g.fillStyle = '#fff';
	g.fillRect(0, 0, w, h);
	g.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, 0, 0, w, h);
	image.close?.();
	return jpeg(canvas);
}
