import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// BYOK 구조라 서버 시크릿/캐시 백엔드(R2·KV) 불필요 → 최소 설정.
export default defineCloudflareConfig({});
