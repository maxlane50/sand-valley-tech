import { AVATAR_SIZE, centerCrop } from './avatars';

/**
 * Turns whatever came out of the camera roll into a small square JPEG.
 *
 * This runs in the browser on purpose. A phone photo is 3-5MB; an avatar is
 * 256px and lands around 20KB. Resizing here means the upload is instant on
 * clubhouse wifi, the serverless function never handles a large body, and the
 * bucket stays trivially small.
 *
 * The crop is centred rather than stretched — a squashed face is worse than a
 * cropped one, and phone photos are usually portrait.
 */
export async function toAvatarJpeg(
  file: File,
  size = AVATAR_SIZE,
  quality = 0.82,
): Promise<string> {
  const source = await loadImage(file);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser will not give us a canvas to resize with.');

  // Photos of people are almost always downscaled here, and the default
  // smoothing is what keeps that from looking crunchy.
  context.imageSmoothingQuality = 'high';

  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!width || !height) throw new Error('That file does not look like an image.');

  const { sx, sy, side } = centerCrop(width, height);
  context.drawImage(source, sx, sy, side, side, 0, 0, size, size);

  if ('close' in source) source.close();

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * createImageBitmap applies the EXIF rotation, which is what stops photos
 * taken in portrait from arriving on their side. Safari has only supported
 * the option relatively recently, so an <img> is the fallback — browsers
 * orient those from EXIF by default too.
 */
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> path.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('That file could not be read as an image.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
