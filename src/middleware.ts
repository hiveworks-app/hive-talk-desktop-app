import { NextResponse } from 'next/server';

// Electron standalone 빌드에서 document.cookie로 설정한 쿠키가
// 서버 요청에 포함되지 않는 문제가 있어, 서버사이드 리다이렉트를 제거.
// 인증 가드는 클라이언트 사이드에서 처리 (src/app/(main)/layout.tsx)
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
