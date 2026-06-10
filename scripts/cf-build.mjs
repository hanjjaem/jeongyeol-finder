// Cloudflare(OpenNext) 빌드 전용 진입점.
// - CF_BUILD=1 로 next.config가 output:"standalone"을 켜게 함(Vercel 빌드는 영향 없음)
// - Next 16 기본 Turbopack 대신 webpack으로 빌드(OpenNext가 안정적으로 읽는 런타임)
// - next build를 우리가 직접 하므로 OpenNext는 --skipNextBuild 로 번들만 생성
import { execSync } from "node:child_process";

process.env.CF_BUILD = "1";
const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });

run("node scripts/gen-table.mjs");
run("next build --webpack");
run("opennextjs-cloudflare build --skipNextBuild");
