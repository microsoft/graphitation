import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import ts from "typescript";
import { program, Command } from "commander";
import { extractImplicitTypesToTypescript } from "@graphitation/supermassive-extractors";
import { parse } from "graphql";
import { generateTS } from "@graphitation/ts-codegen";
import * as glob from "fast-glob";

type GenerateInterfacesOptions = {
  outputDir?: string;
  contextImport?: string;
  contextName?: string;
  enumsImport?: string;
  legacy?: boolean;
  legacyModels?: boolean;
  legacyEnumsCompatibility?: boolean;
  scope?: string;
};

const PREPEND_TO_INTERFACES = `/* eslint-disable */ \n// This file was automatically generated (by @graphitation/supermassive) and should not be edited.\n`;

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
    .argument("<inputs...>")
    .option(
      "-o, --output-dir [outputDir]",
      "output directory relative to file, default generated",
    )
    .option(
      "-ci, --context-import [contextImport]",
      "from where to import context",
    )
    .option("-cn, --context-name [contextName]", "Context name")
    .option("-ei, --enums-import [enumsImport]", "from where to import enums")
    .option("-l, --legacy", "generate legacy types")
    .option("--legacy-models", "do not use models for object types")
    .option(
      "--legacy-enums-compatibility",
      "When this flag is set, then enums are generated using typescript 'Enum' keyword, which is then used in fields along side with string unions. If this flag is not set, then enums are generated as string unions.",
    )
    .option("--scope [scope]", "generate models only for scope")
    .description("generate interfaces and models")
    .action(
      async (inputs: Array<string>, options: GenerateInterfacesOptions) => {
        await generateInterfaces(getFiles(inputs), options);
      },
    );

  return program
    .name("supermassive")
    .addCommand(extractSchemaCommand)
    .addCommand(generateInterfacesCommand);
}

function getFiles(inputs: Array<string>) {
  return inputs
    .map((input) => {
      if (fsSync.existsSync(input)) {
        return input;
      } else {
        return glob.sync([input]);
      }
    })
    .flat()
    .filter(Boolean);
}
function getContextPath(outputDir: string, contextImport: string | undefined) {
  if (!contextImport) {
    return;
  }

  if (!contextImport.startsWith(".")) {
    return contextImport;
  }

  const contextDir = path.join(process.cwd(), contextImport);

  return path
    .relative(outputDir, contextDir)
    .split(path.sep)
    .join(path.posix.sep);
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

    const outputPath = path.join(
      path.dirname(fullPath),
      options.outputDir ? options.outputDir : "__generated__",
    );

    const result = generateTS(document, {
      outputPath,
      documentPath: fullPath,
      contextImport: getContextPath(outputPath, options.contextImport) || null,
      contextName: options.contextName,
      enumsImport: getContextPath(outputPath, options.enumsImport) || null,
      legacyCompat: !!options.legacy,
      legacyNoModelsForObjects: !!options.legacyModels,
      legacyEnumsCompatibility: !!options.legacyEnumsCompatibility,
      modelScope: options.scope || null,
    });

    await fs.mkdir(outputPath, { recursive: true });

    const printer = ts.createPrinter();
    const outputs = result.files.map((file) =>
      fs.writeFile(
        path.join(outputPath, file.fileName),
        PREPEND_TO_INTERFACES +
          printer.printNode(ts.EmitHint.SourceFile, file, file),
        { encoding: "utf-8" },
      ),
    );

    await Promise.all(outputs);
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
