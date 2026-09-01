import { nativeImage } from 'electron';
import { getIconPath } from './utils';

/* ─── Windows·Linux 트레이 아이콘 가공 ─────────────────────────────
   원본 앱 아이콘(정사각형)을 16px로 줄인 뒤 모서리를 둥글게 깎고, 안읽음 상태에는
   우하단에 빨간 점을 합성한다 (2026-09-01 QA: 정사각형이 트레이에서 투박하고,
   기존 점은 지름 10px + 검정 테두리라 과대했음 → 지름 7px, 테두리 없이 AA만).
   비트맵은 BGRA 순서 + 프리멀티플라이드 알파 — 색상값에 알파를 곱해 다뤄야 한다.
   macOS는 전용 템플릿 아이콘(trayIconTemplate.png)을 쓰므로 이 모듈과 무관. */

const SIZE = 16;
const CORNER_RADIUS = 4;
const DOT_RADIUS = 3; // 지름 6px (미리보기 확정 2026-09-01 — 7px는 과대)
// 배지 상태: 캔버스(16px) 밖으로 점을 내밀 수 없으므로 아트워크를 13px로 줄여 좌상단에
// 배치하고, 점 중심을 그 우하단 모서리에 둬 50/50로 걸치게 한다 (사용자 결정 2026-09-01,
// 텔레그램 트레이 배지와 동일 기법)
const BADGE_ART_SIZE = 14; // 점 대비 아이콘을 키움 (미리보기 확정 2026-09-01: 14px + 점 6px)
const BADGE_ART_RADIUS = 3.5; // 14px 아트워크에 비례한 라운딩 (4 × 14/16 = 3.5)
const DOT_CENTER = 13; // 점(지름 6px)이 10~16에 걸침 — 아트워크 모서리(14,14)에 50/50
// 배지 색 #FF3B30 (작업 표시줄 오버레이와 동일) — BGRA 순서
const DOT_B = 0x30;
const DOT_G = 0x3b;
const DOT_R = 0xff;

let cachedBase: Electron.NativeImage | null = null;
let cachedBadge: Electron.NativeImage | null = null;

/** 픽셀 중심 (x+0.5, y+0.5)의 둥근 사각형(size×size, 반경 radius) 커버리지(0~1) — 경계 1px AA */
function roundedCoverage(x: number, y: number, size: number, radius: number): number {
  const px = x + 0.5;
  const py = y + 0.5;
  const nearLeft = px < radius;
  const nearRight = px > size - radius;
  const nearTop = py < radius;
  const nearBottom = py > size - radius;
  if (!(nearLeft || nearRight) || !(nearTop || nearBottom)) return 1; // 모서리 사분면 밖
  const cx = nearLeft ? radius : size - radius;
  const cy = nearTop ? radius : size - radius;
  const dist = Math.hypot(px - cx, py - cy);
  return Math.max(0, Math.min(1, radius + 0.5 - dist));
}

/** 기본 트레이 아이콘 — 모서리 둥근 16px */
export function getRoundedTrayIcon(): Electron.NativeImage {
  if (cachedBase) return cachedBase;
  const buf = Buffer.from(
    nativeImage.createFromPath(getIconPath()).resize({ width: SIZE, height: SIZE }).toBitmap(),
  );
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const f = roundedCoverage(x, y, SIZE, CORNER_RADIUS);
      if (f >= 1) continue;
      const o = (y * SIZE + x) * 4;
      buf[o] = Math.round(buf[o] * f);
      buf[o + 1] = Math.round(buf[o + 1] * f);
      buf[o + 2] = Math.round(buf[o + 2] * f);
      buf[o + 3] = Math.round(buf[o + 3] * f);
    }
  }
  cachedBase = nativeImage.createFromBuffer(buf, { width: SIZE, height: SIZE });
  return cachedBase;
}

/** 안읽음 트레이 아이콘 — 13px 아트워크 + 우하단 모서리에 50/50로 걸친 빨간 점(지름 7px) */
export function getRoundedTrayBadgeIcon(): Electron.NativeImage {
  if (cachedBadge) return cachedBadge;
  const art = nativeImage
    .createFromPath(getIconPath())
    .resize({ width: BADGE_ART_SIZE, height: BADGE_ART_SIZE })
    .toBitmap();
  const buf = Buffer.alloc(SIZE * SIZE * 4); // 투명 캔버스에 좌상단 정렬로 합성
  for (let y = 0; y < BADGE_ART_SIZE; y++) {
    for (let x = 0; x < BADGE_ART_SIZE; x++) {
      const f = roundedCoverage(x, y, BADGE_ART_SIZE, BADGE_ART_RADIUS);
      const src = (y * BADGE_ART_SIZE + x) * 4;
      const dst = (y * SIZE + x) * 4;
      buf[dst] = Math.round(art[src] * f);
      buf[dst + 1] = Math.round(art[src + 1] * f);
      buf[dst + 2] = Math.round(art[src + 2] * f);
      buf[dst + 3] = Math.round(art[src + 3] * f);
    }
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const a = Math.max(
        0,
        Math.min(1, DOT_RADIUS + 0.5 - Math.hypot(x + 0.5 - DOT_CENTER, y + 0.5 - DOT_CENTER)),
      );
      if (a <= 0) continue;
      const o = (y * SIZE + x) * 4;
      // 프리멀티플라이드 "over" 합성: src*α + dst*(1-α)
      buf[o] = Math.round(DOT_B * a + buf[o] * (1 - a));
      buf[o + 1] = Math.round(DOT_G * a + buf[o + 1] * (1 - a));
      buf[o + 2] = Math.round(DOT_R * a + buf[o + 2] * (1 - a));
      buf[o + 3] = Math.round(255 * a + buf[o + 3] * (1 - a));
    }
  }
  cachedBadge = nativeImage.createFromBuffer(buf, { width: SIZE, height: SIZE });
  return cachedBadge;
}
