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
  output: 'standalone',
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
