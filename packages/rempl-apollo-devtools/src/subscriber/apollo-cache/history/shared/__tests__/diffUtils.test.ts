import { formatValue } from "../diffUtils";

describe("formatValue", () => {
  describe("primitive values", () => {
    it("should format undefined", () => {
      expect(formatValue(undefined)).toBe("undefined");
    });

    it("should format null", () => {
      expect(formatValue(null)).toBe("null");
    });

    it("should format strings", () => {
      expect(formatValue("hello")).toBe('"hello"');
      expect(formatValue("")).toBe('""');
      expect(formatValue("multi\nline")).toBe('"multi\\nline"');
    });

    it("should format numbers", () => {
      expect(formatValue(42)).toBe("42");
      expect(formatValue(Infinity)).toBe("null");
      expect(formatValue(NaN)).toBe("null");
    });

    it("should format booleans", () => {
      expect(formatValue(true)).toBe("true");
      expect(formatValue(false)).toBe("false");
    });
  });

  describe("bigint values", () => {
    it("should format standalone bigint", () => {
      expect(formatValue(BigInt(123))).toBe('"123n"');
      expect(formatValue(BigInt(0))).toBe('"0n"');
    });
  });

  describe("objects and arrays", () => {
    it("should format objects", () => {
      const result = formatValue({
        user: { name: "John", address: { city: "NYC" } },
      });
      expect(result).toBe(
        '{\n  "user": {\n    "name": "John",\n    "address": {\n      "city": "NYC"\n    }\n  }\n}',
      );
    });

    it("should format object with BigInt", () => {
      const result = formatValue({ id: BigInt(Number.MAX_SAFE_INTEGER) });
      expect(result).toBe(`{\n  "id": "${Number.MAX_SAFE_INTEGER}n"\n}`);
    });

    it("should format arrays", () => {
      const result = formatValue([{ id: 1 }, { id: 2 }]);
      expect(result).toBe(
        '[\n  {\n    "id": 1\n  },\n  {\n    "id": 2\n  }\n]',
      );
    });
  });
});
