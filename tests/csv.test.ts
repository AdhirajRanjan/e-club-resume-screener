import { expect, it } from "vitest";
import { csvCell, shortlistCsv } from "@/lib/csv";

it("escapes Excel formulas, quotes, newline cells and adds the UTF-8 byte order mark", () => {
  for (const value of ["=1+1", "+1", "-1", "@SUM(1)", " \t=1+1", "＠formula"]) {
    expect(csvCell(value)).toBe(`"'${value}"`);
  }
  expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  expect(shortlistCsv([])).toMatch(/^\ufeff"Applicant name".*"Decision timestamp"\r\n$/);
});
