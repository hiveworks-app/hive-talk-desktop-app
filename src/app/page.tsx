'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 정적 export는 서버 redirect()를 쓸 수 없다 — 클라이언트 리다이렉트로 진입점 이동
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/members');
  }, [router]);
  return null;
}
