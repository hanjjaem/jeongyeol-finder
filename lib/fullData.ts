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

import rows from "./fullData.generated";

export function getFullRecords(): FullRecord[] {
  return rows as FullRecord[];
}

export function getDepartments(): string[] {
  return [...new Set(getFullRecords().map((record) => record.department_scope))];
}
