import { describe, it, expect } from "vitest";
import { getMimeType } from "../../../components/shared/import-types";

describe("getMimeType", () => {
  it("maps known extensions", () => {
    expect(getMimeType("data.csv")).toBe("text/csv");
    expect(getMimeType("data.JSON")).toBe("application/json");
    expect(getMimeType("book.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(getMimeType("legacy.xls")).toBe("application/vnd.ms-excel");
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(getMimeType("archive.zip")).toBe("application/octet-stream");
    expect(getMimeType("noextension")).toBe("application/octet-stream");
  });
});
