/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",            // 정적 HTML/JS만 생성(out/)
  basePath: "/jeongyeol-finder", // GitHub Pages 프로젝트 경로
  images: { unoptimized: true }, // 정적 export는 이미지 최적화 서버 없음
  trailingSlash: true,         // /path/ → /path/index.html (Pages 디렉터리 서빙)
};
export default nextConfig;
