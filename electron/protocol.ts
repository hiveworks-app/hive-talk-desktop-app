import { app, net, protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

/**
 * 정적 번들 서빙 (2026-09-02 아키텍처 전환, Slack/Discord 방식).
 *
 * Next 정적 export(out/)를 app:// 커스텀 프로토콜로 직접 서빙한다 — 내장 Next 서버
 * (utilityProcess.fork + 포트 + 부팅 대기)가 통째로 사라져 기동이 "파일 열기"가 되고,
 * 포트 23000 점유·localhost 차단·서버 부팅 지연(백신 검사 20초 실측) 이슈 클래스가 소멸한다.
 *
 * 경로 해석: Next export는 라우트를 평평한 파일로 낸다 (/chat → chat.html, RSC 페이로드
 * /chat.txt, 에셋 /_next/..., public 파일 그대로). 요청 pathname을 그 순서로 매핑한다.
 */

export const STATIC_BASE_URL = 'app://bundle';

/** app.whenReady 이전(모듈 로드 시점)에 호출해야 한다 — 이후 등록은 무시된다 */
export function registerStaticScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true, // origin(app://bundle) 성립 — localStorage·쿠키·절대경로 에셋에 필요
        secure: true, // https 취급 — secure context 요구 API(crypto.subtle 등) 허용
        supportFetchAPI: true, // 렌더러 fetch()로 RSC 페이로드(.txt) 로드 허용
      },
    },
  ]);
}

function getBundleRoot(): string {
  // 패키지: extraResources로 복사된 out/ — 미패키지 검증 실행은 프로젝트의 out/ 사용
  return app.isPackaged
    ? path.join(process.resourcesPath, 'out')
    : path.join(app.getAppPath(), 'out');
}

/** whenReady 이후 호출 — 핸들러를 등록하고 베이스 URL을 돌려준다 */
export function setupStaticServing(): string {
  const root = getBundleRoot();

  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const decoded = decodeURIComponent(pathname);

    // 경로 탈출 차단 — 정규화 결과가 번들 루트를 벗어나면 거부
    const resolved = path.normalize(path.join(root, decoded));
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    // 파일 매핑: 정확한 파일 → 라우트 html → 디렉터리 index.html → 404.html
    const candidates =
      decoded === '/' || decoded === ''
        ? [path.join(root, 'index.html')]
        : [resolved, `${resolved}.html`, path.join(resolved, 'index.html')];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return net.fetch(pathToFileURL(candidate).toString());
      }
    }

    const notFoundPage = path.join(root, '404.html');
    if (fs.existsSync(notFoundPage)) {
      return net.fetch(pathToFileURL(notFoundPage).toString());
    }
    return new Response('Not Found', { status: 404 });
  });

  return STATIC_BASE_URL;
}
