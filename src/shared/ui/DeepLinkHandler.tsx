'use client';

import { useEffect } from 'react';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { isValidEmail } from '@/shared/utils/validation';
import { useDeepLinkStore } from '@/store/deepLinkStore';

/** 이중 인코딩된 쿼리 값(예: @ → %40 → %2540)을 안전하게 원복한다 (RN +native-intent 패리티) */
function safeDecodeComponent(value: string): string {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      break;
    }
    if (decoded === current) break;
    current = decoded;
  }
  return current;
}

/**
 * hivetalk:// 딥링크 수신 라우터 — (main) 레이아웃에만 마운트 (로그인 상태에서만
 * 의미 있는 링크들이라, 미로그인 시엔 자연히 무시된다).
 *
 * profile/email/verify: 메일 '앱에서 인증 완료하기' → 랜딩 페이지가
 * hivetalk://profile/email/verify?code=6자리&email=…&expiresAt=… 호출 — 경로는 모바일
 * Universal Link(/profile/email/verify)와 동일 형태로 통일(백엔드 협의 2026-09-04).
 * 인증 정보를 스토어에 적재하고 이메일 변경 화면으로 이동 — 화면(useChangeEmail)이
 * 만료 검사 후 자동 검증한다.
 */
export function DeepLinkHandler() {
  const router = useAppRouter();

  useEffect(() => {
    const api = (window as unknown as {
      electronAPI?: {
        onDeepLink?: (cb: (url: string) => void) => () => void;
        deepLinkReady?: () => void;
      };
    }).electronAPI;
    if (!api?.onDeepLink) return;

    const unsubscribe = api.onDeepLink(url => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return; // 형식 불량 URL 무시
      }
      // hivetalk://profile/email/verify — 커스텀 스킴은 첫 세그먼트가 host로 파싱되므로
      // host+pathname을 합쳐 경로를 복원한다 (hivetalk:///a/b 꼴의 빈 host도 동일 결과)
      const action = (parsed.host + parsed.pathname).replace(/^\/+/, '').replace(/\/+$/, '');
      if (action === 'profile/email/verify') {
        const code = parsed.searchParams.get('code') ?? '';
        // searchParams가 1회 디코딩하므로 랜딩이 이중 인코딩(%2540)을 넘겨도 원복된다
        const email = safeDecodeComponent(parsed.searchParams.get('email') ?? '');
        // 외부 유입 값 — 형식 검증 통과분만 수용 (코드 6자리 숫자 + 이메일 형식)
        if (!/^\d{6}$/.test(code) || !isValidEmail(email)) return;
        const rawExpiresAt = Number(parsed.searchParams.get('expiresAt'));
        const expiresAt = Number.isFinite(rawExpiresAt) && rawExpiresAt > 0 ? rawExpiresAt : undefined;
        useDeepLinkStore.getState().setPendingEmailVerify({ email, code, expiresAt });
        router.push('/settings/email');
      }
    });
    // 준비 신호 — 콜드 스타트(앱 꺼진 상태에서 링크 클릭)로 큐잉된 URL이 이 시점에 온다
    api.deepLinkReady?.();
    return unsubscribe;
  }, [router]);

  return null;
}
