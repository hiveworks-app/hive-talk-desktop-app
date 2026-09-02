'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BootScreen } from '@/shared/ui/BootScreen';

// 정적 export는 서버 redirect()를 쓸 수 없다 — 클라이언트 리다이렉트로 진입점 이동.
// 리다이렉트 동안 null을 렌더하면 빈 흰 창이 된다 — 브랜드 로딩으로 채운다 (2026-09-02)
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/members');
  }, [router]);
  return <BootScreen />;
}
