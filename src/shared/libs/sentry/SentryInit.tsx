'use client';

import { useEffect } from 'react';
import { initRendererSentry } from './initSentry';

/**
 * 렌더러 Sentry를 마운트 시 1회 초기화하는 외부 시스템 동기화 컴포넌트.
 * 루트 레이아웃에 배치. (UI 없음)
 */
export function SentryInit() {
  useEffect(() => {
    initRendererSentry();
  }, []);

  return null;
}
