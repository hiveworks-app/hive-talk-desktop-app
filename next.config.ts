import path from "path";
import type { NextConfig } from "next";

const svgrOptions = {
  svgoConfig: {
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            removeViewBox: false,
          },
        },
      },
      // convertColors 제거: -default.svg 아이콘은 이미 currentColor 사용
      // star-filled.svg 등 고유 색상(#FFED66) 보존
    ],
  },
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('./package.json');

const nextConfig: NextConfig = {
  // 정적 export (2026-09-02 아키텍처 전환) — Electron이 내장 Next 서버(utilityProcess) 없이
  // out/ 정적 파일을 app:// 프로토콜로 직접 서빙한다 (Slack/Discord 방식).
  // 기동 시 서버 부팅·포트 점유·localhost 이슈 클래스가 통째로 사라진다.
  // 제약: 동적 세그먼트(/chat/[roomId]) 불가 → 쿼리 파라미터(/chat?roomId=…)로 전환됨.
  output: 'export',
  // 정적 export는 Next 이미지 최적화 서버가 없다 — 원본 그대로 사용
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  turbopack: {
    resolveAlias: {
      '@assets': path.resolve(__dirname, 'assets'),
    },
    rules: {
      '*.svg': {
        loaders: [{ loader: '@svgr/webpack', options: svgrOptions }],
        as: '*.js',
      },
    },
  },
  webpack(config) {
    const fileLoaderRule = config.module.rules.find(
      (rule: { test?: RegExp }) => rule.test?.test?.('.svg'),
    );
    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/i;
    }

    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: [{ loader: '@svgr/webpack', options: svgrOptions }],
    });

    return config;
  },
};

export default nextConfig;
