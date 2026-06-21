import type { NextConfig } from "next";

/**
 * 기본 `npm run dev`는 Turbopack — webpack dev의 `__webpack_modules__[moduleId] is not a function`·HMR 청크 꼬임 회피.
 * `npm run dev:webpack`은 표준 webpack dev(필요 시 `npm run clean` 후 사용).
 * dev 전역 no-store 헤더는 `/_next` 청크와 충돌할 수 있어 두지 않음.
 */
const nextConfig: NextConfig = {
  /** 태블릿 LAN IP에서 dev HMR·/_next 로드 (Cross origin 경고 방지) */
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.39",
    "192.168.137.1",
    "192.168.137.2",
    "192.168.137.3",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "256kb",
    },
  },
  turbopack: {},
};

export default nextConfig;
