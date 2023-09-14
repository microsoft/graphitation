import { runCLI } from "jest";
import type { Config } from "@jest/types";
import * as path from "path";
import { SourceMapGenerator } from "source-map-js";

describe("jest loader", () => {
  it("works", async () => {
    expect(await runJestTest("succeeds")).not.toMatch("failed");
  });

  xit("uses the source-map to point at the correct failing line and column", async () => {
    expect(await runJestTest("fails")).toMatch("a-jest-test.ts:23:7");
  });

  it("uses the source-map to point at the correct failing line", async () => {
    expect(await runJestTest("fails")).toMatch("a-jest-test.ts:23:1");
  });

  it("does not perform any extra source-map processing when there were no changes", async () => {
    const spy = jest.spyOn(SourceMapGenerator, "fromSourceMap");
    await runJestTest("does nothing");
    expect(spy).not.toHaveBeenCalled();
  });
});

async function runJestTest(testNamePattern: string) {
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
      testRegex:
        testNamePattern === "does nothing"
          ? "a-jest-test-without-doc\\.ts$"
          : "a-jest-test\\.ts$",
      testNamePattern,
      runInBand: true,
      useStderr: true,
      cache: false,
      transform: JSON.stringify({
        "\\.ts$": [path.join(__dirname, "../ts-jest.ts"), {}],
      }),
    } as Config.Argv,
    roots,
  );

  return cleanAnsi(output);
}

// Taken from vscode-jest, which is MIT licensed:
// https://github.com/jest-community/vscode-jest/pull/501/files#diff-ca5696b367d474e785317cb7a0d9853fef5729387ab8d0fab4c46268c03aae99R135-R137
function cleanAnsi(str: string): string {
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    "",
  );
}
