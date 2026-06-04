/** @type {import('next').NextConfig} */
const nextConfig = {
  // /api/lookup 이 런타임에 data/*.csv 를 읽으므로 서버리스 번들에 포함시킨다.
  experimental: {
    outputFileTracingIncludes: {
      "/api/lookup": ["./data/**"],
    },
  },
};
export default nextConfig;
