import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import ts from "typescript";
import { program, Command } from "commander";
import { extractImplicitTypesToTypescript } from "@graphitation/supermassive-extractors";
import { parse, print, locatedError, GraphQLError, printError } from "graphql";
import { generateTS } from "@graphitation/ts-codegen";
import {
  mergeSchemas as mergeSchemasImpl,
  FileSystemModuleLoader,
} from "@graphitation/merge-schemas";
import * as glob from "fast-glob";

type GenerateInterfacesOptions = {
  outputDir?: string;
  contextImport?: string;
  contextName?: string;
  enumsImport?: string;
  legacy?: boolean;
  legacyModels?: boolean;
  scope?: string;
};

type MergeSchemasOptions = {
  output?: string;
  ignoreEntryPointMissingTypes?: boolean;
};

const PREPEND_TO_INTERFACES = `/* eslint-disable */ \n// This file was automatically generated (by @graphitation/cli) and should not be edited.\n`;
const PREPEND_TO_GRAPHQL =
  "# This file was automatically generated (by @graphitation/cli) and should not be edited.\n";

export function graphitation(): Command {
  const extractSchemaCommand = new Command();
  extractSchemaCommand
    .name("extract-schema")
    .argument("<files...>")
    .description(
      "extract implicit resolvers to a ts file from graphql typedefs",
    )
    .action(async (files: Array<string>) => {
      await typeDefsToImplicitResolversImpl(await getFiles(files));
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
    .option("--scope [scope]", "generate models only for scope")
    .description("generate interfaces and models")
    .action(
      async (inputs: Array<string>, options: GenerateInterfacesOptions) => {
        await generateInterfaces(await getFiles(inputs), options);
      },
    );

  const mergeSchemasCommand = new Command();
  mergeSchemasCommand
    .name("merge-schemas")
    .argument("<entryPoints...>")
    .option("-o,--output [output]", "output file, otherwise writes to stdout")
    .option(
      "--ignore-entry-point-missing-types",
      "ignore missing types in entry points for implicit types compat mode",
    )
    .action(
      async (entryPoints: Array<string>, options: MergeSchemasOptions) => {
        await mergeSchemas(await getFiles(entryPoints), options);
      },
    );

  return program
    .name("supermassive")
    .addCommand(extractSchemaCommand)
    .addCommand(generateInterfacesCommand)
    .addCommand(mergeSchemasCommand);
}

async function getFiles(inputs: Array<string>): Promise<Array<string>> {
  return Promise.all(
    inputs
      .map((input) => {
        if (fsSync.existsSync(input)) {
          return input;
        } else {
          return glob.sync([input]);
        }
      })
      .flat()
      .filter(Boolean)
      .map(async (file) => {
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
        return fullPath;
      }),
  );
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
    const content = await fs.readFile(file, { encoding: "utf-8" });
    const document = parse(content);

    const outputPath = path.join(
      path.dirname(file),
      options.outputDir ? options.outputDir : "__generated__",
    );

    const result = generateTS(document, {
      outputPath,
      documentPath: file,
      contextImport: getContextPath(outputPath, options.contextImport) || null,
      contextName: options.contextName,
      enumsImport: getContextPath(outputPath, options.enumsImport) || null,
      legacyCompat: !!options.legacy,
      legacyNoModelsForObjects: !!options.legacyModels,
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
    const content = await fs.readFile(file, { encoding: "utf-8" });
    const document = parse(content);

    const tsContents = extractImplicitTypesToTypescript(document);
    const tsDir = path.join(path.dirname(file), "__generated__");
    await fs.mkdir(tsDir, { recursive: true });
    const tsFileName = path.join(
      tsDir,
      path.basename(file, path.extname(file)) + ".ts",
    );
    const printer = ts.createPrinter();

    await fs.writeFile(
      tsFileName,
      printer.printNode(ts.EmitHint.SourceFile, tsContents, tsContents),
      { encoding: "utf-8" },
    );
  }
}

async function mergeSchemas(
  files: Array<string>,
  options: MergeSchemasOptions,
): Promise<void> {
  const result = await mergeSchemasImpl(
    files.map((absolutePath) => ({ absolutePath })),
    new FileSystemModuleLoader(),
  );
  let fail = false;
  if (result.errors) {
    for (const error of result.errors || []) {
      if (!(options.ignoreEntryPointMissingTypes && error.isEntryPoint)) {
        fail = true;
      }
      let message;
      if (error.forType) {
        message = `Missing type ${error.name} in module ${error.module} requested by module ${error.forType.module}`;
      } else {
        message = `Missing type ${error.name} in module ${error.module}`;
      }
      const locError = locatedError(
        new GraphQLError(message),
        error.forType?.node,
      );
      console.warn(printError(locError));
    }
  }
  if (fail) {
    throw new Error("Missing types, aborting.");
  } else {
    const output = PREPEND_TO_GRAPHQL + print(result.document);
    if (options.output) {
      await fs.writeFile(options.output, output, { encoding: "utf-8" });
    } else {
      process.stdout.write(output);
    }
  }
}
