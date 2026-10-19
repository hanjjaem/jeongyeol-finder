export type FullMark = {
  rank: string;
  symbol: "★" | "○";
  cell: string;
  raw: string;
};

export type FullPathEntry = {
  text: string;
  row: number;
  level: number;
};

export type FullRecord = {
  id: string;
  source_sheet: string;
  source_row_start: number;
  source_row_end: number;
  source_range: string;
  department_scope: string;
  category: { text: string; raw: string; row: number };
  task_raw: string;
  task: string;
  path: FullPathEntry[];
  marks: FullMark[];
  drafter: string[];
  approver: string[];
  status: string;
  issues: string[];
};

import departments from "./fullDepartments.generated";

// 전체 원문(2MB+)은 별도 청크로 분리해 첫 화면 로딩을 막지 않는다.
let _records: Promise<FullRecord[]> | null = null;
export function loadFullRecords(): Promise<FullRecord[]> {
  if (!_records) {
    _records = import("./fullData.generated").then((module) => module.default as FullRecord[]);
    _records.catch(() => { _records = null; }); // 네트워크 실패 시 다음 검색에서 다시 받는다
  }
  return _records;
}

export function getDepartments(): string[] {
  return departments;
}
