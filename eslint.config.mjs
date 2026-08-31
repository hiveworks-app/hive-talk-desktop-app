import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Electron 데스크톱 앱: next/image 최적화가 불필요하므로 <img> 사용 허용
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Electron 빌드 결과물
    "dist-electron/**",
    // electron-builder 패키징 산출물 (앱 번들 안의 standalone 빌드까지 통째로 들어있다)
    "release/**",
    // 빌드 스크립트 (afterPack 훅 — CJS require 사용)
    "scripts/**",
  ]),
]);

export default eslintConfig;
