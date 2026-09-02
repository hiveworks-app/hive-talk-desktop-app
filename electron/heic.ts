import { ipcMain } from 'electron';

/**
 * HEIC 폴백 변환 (2026-09-02).
 *
 * RN 업로드 구멍(작은 파일은 포맷 변환 생략)으로 서버에 HEIC 원본이 올라간 경우,
 * Chromium 렌더러는 디코드가 불가능해 <img>가 실패한다. 렌더러가 실패한 URL을
 * IPC로 넘기면 메인(Node)이 받아서 HEIC인지 판정 후 JPEG로 변환해 돌려준다.
 * RN 쪽 구멍은 별도 수정됨 — 이 폴백은 기존 데이터 구제 + 이중 방어.
 */

// ISO-BMFF ftyp 박스 + HEIC 계열 브랜드 판정 — 확장자·Content-Type은 신뢰하지 않는다
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

function isHeicBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.toString('ascii', 4, 8) !== 'ftyp') return false;
  return HEIC_BRANDS.has(buf.toString('ascii', 8, 12));
}

// 프로필/채팅 이미지 용도 상한 — 비정상 대용량은 변환 시도 자체를 거부
const MAX_BYTES = 30 * 1024 * 1024;

export type HeicConvertResult =
  | { status: 'converted'; dataUrl: string }
  | { status: 'not-heic' } // 확정 — 렌더러가 캐시해 재시도하지 않는다
  | { status: 'fetch-failed' }; // 미확정(만료 403 등) — fresh URL로 재시도 여지

export function registerHeicIpc(): void {
  ipcMain.handle('convert-heic', async (_event, rawUrl: string): Promise<HeicConvertResult> => {
    try {
      const url = new URL(String(rawUrl));
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return { status: 'fetch-failed' };

      const res = await fetch(url.toString());
      if (!res.ok) return { status: 'fetch-failed' };
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_BYTES || !isHeicBuffer(bytes)) return { status: 'not-heic' };

      const { default: convert } = await import('heic-convert');
      const jpeg = await convert({ buffer: bytes, format: 'JPEG', quality: 0.9 });
      return {
        status: 'converted',
        dataUrl: `data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}`,
      };
    } catch (err) {
      console.error('[heic] 변환 실패:', err);
      return { status: 'fetch-failed' };
    }
  });
}
