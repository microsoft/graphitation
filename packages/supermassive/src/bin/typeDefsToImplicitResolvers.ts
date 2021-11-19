import path from "path";
import fs from "fs/promises";
import ts from "typescript";
import { Command } from "commander";
import { extractImplicitTypesToTypescript } from "../extractImplicitTypes";
import { parse } from "graphql";

export function typeDefsToImplicitResolvers(): Command {
  const program = new Command();
  return program
    .argument("<files...>", "graphql typedef files to convert")
    .action(async (files: Array<string>) => {
      await typeDefsToImplicitResolversImpl(files);
    });
}

async function typeDefsToImplicitResolversImpl(
  files: Array<string>
): Promise<void> {
  for (const file of files) {
    let fullPath: string;
    if (path.isAbsolute(file)) {
      fullPath = file;
    } else {
      fullPath = path.join(process.cwd(), file);
    }
    const stat = await fs.stat(fullPath);
    if (!stat.isFile) {
      throw new Error(`Invalid file ${file}`);
    }
    const content = await fs.readFile(fullPath, { encoding: "utf-8" });
    const document = parse(content);
    const tsContents = extractImplicitTypesToTypescript(document);
    const tsDir = path.join(path.dirname(fullPath), "__generated__");
    await fs.mkdir(tsDir, { recursive: true });
    const tsFileName = path.join(
      tsDir,
      path.basename(fullPath, path.extname(fullPath)) + ".ts"
    );
    const printer = ts.createPrinter();
    await fs.writeFile(
      tsFileName,
      printer.printNode(ts.EmitHint.SourceFile, tsContents, tsContents),
      { encoding: "utf-8" }
    );
  }
}
