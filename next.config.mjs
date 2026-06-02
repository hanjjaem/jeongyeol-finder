/** @type {import('next').NextConfig} */
const nextConfig = {
  // /api/chat 가 런타임에 data/*.csv 를 읽으므로 서버리스 번들에 포함시킨다.
  experimental: {
    outputFileTracingIncludes: {
      "/api/chat": ["./data/**"],
    },
  },
};
export default nextConfig;
