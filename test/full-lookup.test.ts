import { describe, expect, it } from "vitest";
import { lookup } from "../lib/lookup";

describe("lookup() — 전체 원문 후보와 근거", () => {
  it("부서를 지정하면 원문 행과 표시를 반환한다", async () => {
    const response = await lookup("예산의 변경", "공통사항");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.source).toBe("full");
      expect(response.result.fullSearch).toBe(true);
      expect(response.result.evidence?.[0]).toMatchObject({
        sourceSheet: "공통사항",
        sourceRow: 14,
        taskRaw: "5. 예산의 변경",
      });
      expect(response.result.evidence?.[0]?.approver).toEqual(["국∙소장"]);
    }
  });

  it("여러 원문 행은 임의로 합치지 않고 선택지로 남긴다", async () => {
    const response = await lookup("병가", "공통사항");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.needsChoice).toBe(true);
      expect(response.result.options.length).toBeGreaterThan(1);
      expect(response.result.options.every((option) => option.evidence?.sourceSheet === "공통사항")).toBe(true);
    }
  });

  it("기존 169건 결과에도 원문 근거를 붙인다", async () => {
    const response = await lookup("예산의 변경");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.source).toBe("local");
      expect(response.result.evidence?.map((evidence) => evidence.id)).toContain("공통사항:14");
    }
  });

  it("전체 검색은 부서 범위를 지킨다", async () => {
    const response = await lookup("자료 수집", "기획감사실");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.fullSearch).toBe(true);
      expect(response.result.evidence?.every((evidence) => evidence.sourceSheet === "기획감사실")).toBe(true);
    }
  });
});
