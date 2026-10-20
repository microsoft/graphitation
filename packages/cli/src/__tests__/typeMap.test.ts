import fs from "fs/promises";
import path from "path";
import { parse } from "graphql";
import ts from "typescript";
import { generateTS } from "@graphitation/ts-codegen";
import { supermassive } from "../supermassive";

it("generates public TypeMap payloads with the legacy CLI options", async () => {
  const documentPath = path.join(__dirname, "fixtures", "type-map.graphql");
  const outputPath = path.join(__dirname, "fixtures", "__generated_type_map__");
  try {
    await supermassive().parseAsync([
      "node",
      "supermassive",
      "generate-interfaces",
      documentPath,
      "--use-string-unions-instead-of-enums",
      "-l",
      "--legacy-models",
      "--output-dir=__generated_type_map__",
    ]);
    const { files } = generateTS(
      parse(await fs.readFile(documentPath, "utf-8")),
      {
        outputPath,
        documentPath,
        legacyCompat: true,
        legacyNoModelsForObjects: true,
        useStringUnionsInsteadOfEnums: true,
      },
    );
    for (const file of files) {
      const generated = await fs.readFile(
        path.join(outputPath, file.fileName),
        "utf-8",
      );
      expect(generated.split("\n").slice(2).join("\n")).toBe(file.content);
    }

    const consumer = path.join(outputPath, "consumer.ts");
    await fs.writeFile(
      consumer,
      `
        import type { TypeMap } from "./legacy-types.interface";
        const mock: Partial<TypeMap["BaseConversation"]> = {
          id: "channel-id", title: "Channel Name",
        };
        const query: TypeMap["Query"] = {
          conversation: { id: "id", title: "Channel Name" },
          conversations: [{ id: "id", title: "Channel Name" }],
          enabled: false,
        };
        // @ts-expect-error Interface fields must keep their scalar types.
        const invalidInterface: Partial<TypeMap["BaseConversation"]> = { id: 123 };
        // @ts-expect-error Root scalar fields must keep their types.
        const invalidQuery: Partial<TypeMap["Query"]> = { enabled: "yes" };
        // @ts-expect-error Root fields must keep interface fields.
        const invalidNested: Partial<TypeMap["Query"]> = { conversation: { id: 123, title: "title" } };
        // @ts-expect-error Root lists must keep their item types.
        const invalidList: Partial<TypeMap["Query"]> = { conversations: [{ id: "id", title: 123 }] };
      `,
    );
    const program = ts.createProgram([consumer], {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2019,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      types: [],
    });
    expect(
      ts.formatDiagnosticsWithColorAndContext(
        ts.getPreEmitDiagnostics(program),
        {
          getCurrentDirectory: () => outputPath,
          getCanonicalFileName: (name) => name,
          getNewLine: () => "\n",
        },
      ),
    ).toBe("");
  } finally {
    await fs.rm(outputPath, { recursive: true, force: true });
  }
});
