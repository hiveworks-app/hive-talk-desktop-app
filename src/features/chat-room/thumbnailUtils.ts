/**
 * Video 첫 프레임 기반 썸네일 생성 유틸 (모바일 expo-video-thumbnails 대체)
 */
export async function createVideoThumbnail(file: File, maxSize: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px';
  document.body.appendChild(video);

  const cleanup = () => {
    URL.revokeObjectURL(url);
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (video.parentNode) document.body.removeChild(video);
  };

  try {
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('Video load error'));
    });

    video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    let { videoWidth: w, videoHeight: h } = video;
    if (!w || !h) throw new Error(`Video dimensions unavailable (${w}x${h})`);

    if (w > h) {
      if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; }
    } else {
      if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('toBlob returned null')),
        'image/jpeg',
        0.7,
      );
    });

    return blob;
  } finally {
    cleanup();
  }
}

/**
 * Canvas 기반 이미지 썸네일 생성 유틸
 */
export function createImageThumbnail(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context unavailable'));

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Thumbnail generation failed'));
        },
        'image/jpeg',
        0.7,
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
