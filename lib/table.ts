// CSV는 소스 진실. 빌드 전 scripts/gen-table.mjs 가 생성하는 TS 모듈을 import 한다.
// (Cloudflare Workers에는 런타임 파일시스템이 없어 fs.readFileSync 불가 → 빌드 타임 임베드.
//  JSON이 아닌 TS 배열 리터럴이어야 번들에 인라인되어 워커에서 동작)
import rows from "./tableData.generated";

export type Row = Record<string, string>;

export function parseTable(): Row[] {
  return rows as Row[];
}

export function buildTablePrompt(rows: Row[]): string {
  // 한 행 = 한 줄. 챗봇이 표를 직접 읽고 분기·전결을 판단한다.
  const header =
    "대분류번호|대분류명|검색키|검색키워드|분기기준|분기조건|금액하한|금액상한|기안권자|전결권자|비고";
  const lines = rows.map((r) =>
    [
      r["대분류번호"], r["대분류명"], r["검색키"], r["검색키워드"],
      r["분기기준"], r["분기조건"], r["금액하한"], r["금액상한"],
      r["기안권자"], r["전결권자"], r["비고"],
    ].join("|")
  );
  return [header, ...lines].join("\n");
}
