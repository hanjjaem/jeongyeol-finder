import { fileURLToPath } from "node:url";
import path from "node:path";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 표 데이터는 빌드 타임에 JSON으로 import 한다(lib/table.ts) → 런타임 fs 읽기 없음.
  // Cloudflare(OpenNext) 빌드일 때만 standalone 출력 + 트레이싱 루트를 프로젝트로 고정
  //  (상위 폴더를 워크스페이스 루트로 오인해 standalone이 한 단계 중첩되는 것 방지).
  // Vercel 빌드는 CF_BUILD가 없으므로 영향 없음.
  ...(process.env.CF_BUILD === "1"
    ? { output: "standalone", outputFileTracingRoot: projectRoot }
    : {}),
};
export default nextConfig;

// Cloudflare(OpenNext) — `next dev`에서도 워커 바인딩에 접근할 수 있게 초기화.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
