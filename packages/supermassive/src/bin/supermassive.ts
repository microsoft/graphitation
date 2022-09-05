import path from "path";
import fs from "fs/promises";
import ts from "typescript";
import { program, Command } from "commander";
import { extractImplicitTypesToTypescript } from "../extractors/extractImplicitTypesToTypescript";
import { parse } from "graphql";
import { generateTS } from "../codegen";

type GenerateInterfacesOptions = {
  outputDir?: string;
  contextImport?: string;
  contextName?: string;
};

export function supermassive(): Command {
  const extractSchemaCommand = new Command();
  extractSchemaCommand
    .name("extract-schema")
    .argument("<files...>")
    .description(
      "extract implicit resolvers to a ts file from graphql typedefs",
    )
    .action(async (files: Array<string>) => {
      await typeDefsToImplicitResolversImpl(files);
    });

  const generateInterfacesCommand = new Command();
  generateInterfacesCommand
    .name("generate-interfaces")
    .argument("<files...>")
    .option(
      "-o, --output-dir [outputDir]",
      "output directory relative to file, default generated",
    )
    .option(
      "-ci, --context-import [contextImport]",
      "from where to import context",
    )
    .option("-cn, --context-name [contextName]", "Context name")
    .description("generate interfaces and models")
    .action(
      async (files: Array<string>, options: GenerateInterfacesOptions) => {
        await generateInterfaces(files, options);
      },
    );

  return program
    .name("supermassive")
    .addCommand(extractSchemaCommand)
    .addCommand(generateInterfacesCommand);
}

async function generateInterfaces(
  files: Array<string>,
  options: GenerateInterfacesOptions,
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

    let result = generateTS(
      document,
      options.contextImport,
      options.contextName,
    );

    const tsDir = path.join(
      path.dirname(fullPath),
      options.outputDir ? options.outputDir : "__generated__",
    );
    await fs.mkdir(tsDir, { recursive: true });

    const printer = ts.createPrinter();

    await fs.writeFile(
      path.join(tsDir, "models.interface.ts"),
      printer.printNode(ts.EmitHint.SourceFile, result.models, result.models),
      { encoding: "utf-8" },
    );

    await fs.writeFile(
      path.join(tsDir, "resolvers.interface.ts"),
      printer.printNode(
        ts.EmitHint.SourceFile,
        result.resolvers,
        result.resolvers,
      ),
      { encoding: "utf-8" },
    );
  }
}

async function typeDefsToImplicitResolversImpl(
  files: Array<string>,
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
      path.basename(fullPath, path.extname(fullPath)) + ".ts",
    );
    const printer = ts.createPrinter();

    await fs.writeFile(
      tsFileName,
      printer.printNode(ts.EmitHint.SourceFile, tsContents, tsContents),
      { encoding: "utf-8" },
    );
  }
}
