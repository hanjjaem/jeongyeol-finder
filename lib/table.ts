import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export type Row = Record<string, string>;

const CSV_PATH = path.join(process.cwd(), "data", "전결_검색테이블_통합.csv");

export function parseTable(): Row[] {
  const csv = fs.readFileSync(CSV_PATH, "utf-8");
  return parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as Row[];
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
