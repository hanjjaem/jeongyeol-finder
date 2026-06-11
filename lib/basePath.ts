// GitHub Pages 프로젝트 경로. next/link·next/image는 basePath를 자동 처리하지만
// raw <img src>/<a href> 문자열은 안 되므로 이 헬퍼로 명시 접두한다.
export const BASE_PATH = "/jeongyeol-finder";
export const withBase = (p: string) => `${BASE_PATH}${p.startsWith("/") ? p : "/" + p}`;
