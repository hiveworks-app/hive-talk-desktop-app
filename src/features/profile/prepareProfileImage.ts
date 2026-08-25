/**
 * 프로필 이미지 업로드 전처리 (RN fileUtils.prepareImageForUpload의 프로필 옵션 대응).
 *
 * RN MyProfileEdit과 동일한 규칙:
 * - 원본: 1MB 초과 시 가로 1024px·JPEG 80%로 압축, 이하면 원본 그대로
 * - 썸네일: 0.4MB 이상일 때만 가로 128px·JPEG 50%로 생성
 *   (미만이면 null — 원본 키가 썸네일을 겸한다)
 */

const COMPRESS_IF_OVER_BYTES = 1 * 1024 * 1024;
const THUMB_IF_OVER_BYTES = 0.4 * 1024 * 1024;
const ORIGINAL_MAX_WIDTH = 1024;
const THUMB_WIDTH = 128;
const ORIGINAL_QUALITY = 0.8;
const THUMB_QUALITY = 0.5;

export interface PreparedProfileImage {
  /** 업로드할 원본 (필요 시 압축본) */
  original: File;
  /** 128px 썸네일 — 생성 조건 미달이면 null (원본 키를 썸네일로 재사용) */
  thumbnail: File | null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
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

function resizeToJpeg(
  img: HTMLImageElement,
  targetWidth: number,
  quality: number,
  fileName: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    // 업스케일 방지 — 규칙의 의도는 축소·압축이므로 원본이 목표 폭보다 좁으면 원본 폭 유지
    const width = Math.min(targetWidth, img.naturalWidth);
    const height = Math.round(img.naturalHeight * (width / img.naturalWidth));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas context unavailable'));
    // PNG/WebP 투명 영역이 JPEG 변환에서 검게 뭉개지지 않도록 흰 배경을 깐다
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      blob =>
        blob
          ? resolve(new File([blob], fileName, { type: 'image/jpeg' }))
          : reject(new Error('이미지 변환에 실패했습니다.')),
      'image/jpeg',
      quality,
    );
  });
}

export async function prepareProfileImage(file: File): Promise<PreparedProfileImage> {
  const needsCompress = file.size > COMPRESS_IF_OVER_BYTES;
  const needsThumbnail = file.size >= THUMB_IF_OVER_BYTES;
  if (!needsCompress && !needsThumbnail) return { original: file, thumbnail: null };

  const img = await loadImage(file);
  const base = file.name.replace(/\.\w+$/, '');
  const original = needsCompress
    ? await resizeToJpeg(img, ORIGINAL_MAX_WIDTH, ORIGINAL_QUALITY, `${base}.jpg`)
    : file;
  const thumbnail = needsThumbnail
    ? await resizeToJpeg(img, THUMB_WIDTH, THUMB_QUALITY, `thumb_${base}.jpg`)
    : null;
  return { original, thumbnail };
}
