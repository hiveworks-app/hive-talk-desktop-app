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

/** RN IMAGE_PROCESS_OPTS 동일 값 — 서버에 저장되는 자산 규격이므로 데스크톱 스케일 대상이 아니다
 *  (여기서 올린 썸네일·압축본을 RN 앱 사용자도 그대로 본다). */
export const CHAT_IMAGE_PROCESS_OPTS = {
  compressIfOverBytes: 500_000, // 0.5MB
  originalMaxWidth: 1600,
  thumbWidth: 360,
  originalQuality: 0.7,
  thumbQuality: 0.5,
} as const;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 불러올 수 없습니다.'));
    };
    img.src = url;
  });
}

/** 가로폭 기준 JPEG 변환 (RN resizeAndSaveJpeg 대응) — 업스케일 방지, 투명 영역 흰 배경 */
function drawToJpegBlob(img: HTMLImageElement, targetWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const width = Math.min(targetWidth, img.naturalWidth);
    const height = Math.round(img.naturalHeight * (width / img.naturalWidth));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas context unavailable'));
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('이미지 변환에 실패했습니다.'))),
      'image/jpeg',
      quality,
    );
  });
}

/** 채팅 이미지 전송 전처리 (RN useChatRoomActions 이미지 분기 파리티).
 *  썸네일은 항상 생성(360px·q0.5), 원본은 0.5MB 초과 시 1600px·q0.7 JPEG 압축. */
export async function prepareChatImage(
  file: File,
): Promise<{ original: File; thumbnail: Blob }> {
  const img = await loadImageElement(file);
  const thumbnail = await drawToJpegBlob(
    img,
    CHAT_IMAGE_PROCESS_OPTS.thumbWidth,
    CHAT_IMAGE_PROCESS_OPTS.thumbQuality,
  );
  let original = file;
  // GIF는 재인코딩 금지 — canvas JPEG 변환은 첫 프레임 정지 이미지가 되어 애니메이션이
  // 사라진다. 정지 썸네일만 생성하고 원본은 그대로 업로드한다 (2026-08-26 리뷰)
  if (file.type !== 'image/gif' && file.size > CHAT_IMAGE_PROCESS_OPTS.compressIfOverBytes) {
    const blob = await drawToJpegBlob(
      img,
      CHAT_IMAGE_PROCESS_OPTS.originalMaxWidth,
      CHAT_IMAGE_PROCESS_OPTS.originalQuality,
    );
    original = new File([blob], file.name.replace(/\.\w+$/, '.jpg') || 'image.jpg', {
      type: 'image/jpeg',
    });
  }
  return { original, thumbnail };
}

