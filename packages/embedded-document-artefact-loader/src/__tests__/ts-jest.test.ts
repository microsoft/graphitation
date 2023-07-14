import { runCLI } from "jest";
import type { Config } from "@jest/types";
import * as path from "path";

describe("jest loader", () => {
  it("works", async () => {
    let output = "";
    jest.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      if (typeof chunk === "string") {
        output += chunk;
      }
      return true;
    });

    const roots = [path.join(__dirname, "./fixtures")];
    await runCLI(
      {
        roots,
        testRegex: "a-jest-test\\.ts$",
        runInBand: true,
        useStderr: true,
        transform: JSON.stringify({
          "\\.ts$": path.join(__dirname, "../ts-jest.ts"),
        }),
      } as Config.Argv,
      roots,
    );

    expect(output).not.toMatch(/failed/i);
  });
});
