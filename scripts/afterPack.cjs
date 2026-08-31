const path = require('path');
const fs = require('fs');

/**
 * electron-builder는 extraResources 필터에 명시해도 node_modules를 강제 제외한다.
 * Next standalone 서버의 런타임 의존성(next 등)이 빠지면 내장 서버가 "Cannot find module 'next'"로
 * 부팅에 실패하므로 (2026-08-31 QA), 패키징 직후 여기서 직접 복사한다.
 */
exports.default = async function afterPack(context) {
  const src = path.join(context.packager.projectDir, '.next', 'standalone', 'node_modules');
  const dest = path.join(
    context.packager.getResourcesDir(context.appOutDir),
    'standalone',
    'node_modules',
  );
  if (!fs.existsSync(src)) {
    throw new Error(`[afterPack] standalone node_modules 없음: ${src} — next build(output: standalone) 선행 필요`);
  }
  await fs.promises.cp(src, dest, { recursive: true });
  console.log(`[afterPack] standalone node_modules 복사 완료 → ${dest}`);
};
