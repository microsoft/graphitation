import { basename } from "path";
import { types, template } from "@babel/core";
import type { PluginObj, PluginPass } from "@babel/core";

export function inlineAssert(): PluginObj<PluginPass> {
  const t = types;
  const assertTemplate = template.expression(
    `(%%cond%%) || assert(false, %%message%%)`,
  );
  return {
    visitor: {
      CallExpression(path, state) {
        const node = path.node;
        const parent = path.parent;

        if (
          parent.type !== "ExpressionStatement" ||
          node.callee.type !== "Identifier" ||
          node.callee.name !== "assert" ||
          node.arguments.length !== 1 ||
          !node.loc
        ) {
          return;
        }
        const cond = node.arguments[0];
        const filename = state.file.opts.filename || "unknown";
        const { line, column } = node.loc.start;
        const locationStr = `${basename(filename)}:${line}:${column}`;

        path.replaceWith(
          assertTemplate({ cond, message: t.stringLiteral(locationStr) }),
        );
      },
    },
  };
}
