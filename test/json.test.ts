import { describe, it, expect } from "vitest";
import { extractJson } from "../lib/json";

describe("extractJson", () => {
  it("앞뒤 텍스트가 있어도 JSON 객체만 뽑는다", () => {
    const o = extractJson('머리말 {"approver":"국·소장"} 꼬리말') as { approver: string };
    expect(o.approver).toBe("국·소장");
  });

  it("중첩 객체도 가장 바깥 { }까지 통째로 파싱한다", () => {
    const o = extractJson('x {"a":1,"b":{"c":2}} y') as { a: number; b: { c: number } };
    expect(o.b.c).toBe(2);
  });

  it("JSON이 없으면 'JSON 없음'으로 throw 한다", () => {
    expect(() => extractJson("그냥 텍스트")).toThrow("JSON 없음");
  });
});
