import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import ts from "typescript";
import { program, Command } from "commander";
import { extractImplicitTypesToTypescript } from "@graphitation/supermassive-extractors";
import { parse } from "graphql";
import { generateTS } from "@graphitation/ts-codegen";
import * as glob from "fast-glob";
import type { ContextTypeExtension } from "@graphitation/ts-codegen";

type GenerateInterfacesOptions = {
  outputDir?: string;
  contextTypePath?: string;
  contextTypeName?: string;
  enumsImport?: string;
  legacy?: boolean;
  legacyModels?: boolean;
  useStringUnionsInsteadOfEnums?: boolean;
  contextTypeExtensionsFile?: string;
  enumMigrationJsonFile?: string;
  enumMigrationExceptionsJsonFile?: string;
  generateOnlyEnums?: boolean;
  generateResolverMap?: boolean;
  mandatoryResolverTypes?: boolean;
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
      "-ci, --context-type-path [contextTypePath]",
      "from where to import context",
    )
    .option("-cn, --context-type-name [contextTypeName]", "Context type name")
    .option("-ei, --enums-import [enumsImport]", "from where to import enums")
    .option("-l, --legacy", "generate legacy types")
    .option("--legacy-models", "do not use models for object types")
    .option(
      "--use-string-unions-instead-of-enums",
      "When this flag is set, then enums are replaced by string unions.",
    )
    .option("--generate-only-enums", "Generate only enum file")
    .option("--scope [scope]", "generate models only for scope")
    .option(
      "--enum-migration-json-file [enumMigrationJsonFile]",
      "File containing array of enum names, which should be migrated to string unions",
    )
    .option(
      "--enum-migration-exceptions-json-file [enumMigrationExceptionsJsonFile]",
      "File containing array of enum names, which should remain typescript enums",
    )
    .option(
      "--context-type-extensions-file [contextTypeExtensionsFile]",
      "Describes context types and their import paths. Used to generate resolver context type extensions. The file must be defined in the following format: { baseContextTypePath?: string, baseContextTypeName?: string, groups?: { [groupName]: { useLegacy?: boolean, required?: {[namespace: string]]: string[] }}}, contextTypes: { required? :{ [namespace: string]: { [type: string]: { importNamespaceName?: string, importPath: string, typeName: string }}}}",
    )
    .option(
      "--generate-resolver-map",
      "Generate a schema map for resolvers. Default export with resolvers for each type",
    )
    .option(
      "--mandatory-resolver-types",
      "Makes resolver types for type extensions mandatory to ensure that new resolvers are provided if module extends a type",
    )
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
function getContextPath(
  outputDir: string,
  contextTypePath: string | undefined,
) {
  if (!contextTypePath) {
    return;
  }

  if (!contextTypePath.startsWith(".")) {
    return contextTypePath;
  }

  const contextDir = path.join(process.cwd(), contextTypePath);

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
    let contextTypeExtensions: ContextTypeExtension | undefined;

    const outputPath = path.join(
      path.dirname(fullPath),
      options.outputDir ? options.outputDir : "__generated__",
    );
    let enumNamesToMigrate;
    let enumNamesToKeep;
    if (options.enumMigrationJsonFile) {
      const content = JSON.parse(
        await fs.readFile(
          path.join(process.cwd(), options.enumMigrationJsonFile),
          {
            encoding: "utf-8",
          },
        ),
      );

      if (!Array.isArray(content)) {
        throw new Error("enumMigrationJsonFile doesn't contain an array");
      }

      enumNamesToMigrate = content as string[];
    }

    if (options.contextTypeExtensionsFile) {
      const content = JSON.parse(
        await fs.readFile(
          path.join(process.cwd(), options.contextTypeExtensionsFile),
          {
            encoding: "utf-8",
          },
        ),
      );

      if (!content?.contextTypes) {
        throw new Error(
          "contextTypeExtensionsFile doesn't contain contextTypes",
        );
      }

      contextTypeExtensions = content;
    }

    if (options.enumMigrationExceptionsJsonFile) {
      const content = JSON.parse(
        await fs.readFile(
          path.join(process.cwd(), options.enumMigrationExceptionsJsonFile),
          {
            encoding: "utf-8",
          },
        ),
      );

      if (!Array.isArray(content)) {
        throw new Error(
          "enumMigrationExceptionsJsonFile doesn't contain an array",
        );
      }

      enumNamesToKeep = content as string[];
    }

    const result = generateTS(document, {
      outputPath,
      documentPath: fullPath,
      contextTypePath:
        getContextPath(outputPath, options.contextTypePath) || null,
      contextTypeName: options.contextTypeName,
      enumsImport: getContextPath(outputPath, options.enumsImport) || null,
      legacyCompat: !!options.legacy,
      legacyNoModelsForObjects: !!options.legacyModels,
      useStringUnionsInsteadOfEnums: !!options.useStringUnionsInsteadOfEnums,
      generateOnlyEnums: !!options.generateOnlyEnums,
      generateResolverMap: !!options.generateResolverMap,
      mandatoryResolverTypes: !!options.mandatoryResolverTypes,
      enumNamesToMigrate,
      enumNamesToKeep,
      contextTypeExtensions,
      modelScope: options.scope || null,
    });

    await fs.mkdir(outputPath, { recursive: true });

    const printer = ts.createPrinter();
    const outputs = result.files.map((file) => {
      const printed = file.statements
        .map((stmt) => printer.printNode(ts.EmitHint.Unspecified, stmt, file))
        .join(os.EOL) + os.EOL;
      return fs.writeFile(
        path.join(outputPath, file.fileName),
        PREPEND_TO_INTERFACES + printed,
        { encoding: "utf-8" },
      );
    });

    if (result.contextMappingOutput) {
      outputs.push(
        fs.writeFile(
          path.join(outputPath, "schema-context-mapping-metadata.json"),
          JSON.stringify(result.contextMappingOutput, null, 2),
          { encoding: "utf-8" },
        ),
      );
    }

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
    const dummySourceFile = ts.createSourceFile(
      tsFileName,
      "",
      ts.ScriptTarget.Latest,
    );

    await fs.writeFile(
      tsFileName,
      printer.printNode(ts.EmitHint.Unspecified, tsContents, dummySourceFile),
      { encoding: "utf-8" },
    );
  }
}
