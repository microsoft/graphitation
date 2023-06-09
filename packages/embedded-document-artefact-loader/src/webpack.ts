import type { LoaderDefinition } from "webpack";

export const webpackLoader: LoaderDefinition = (
  source,
  _sourceMap,
  _additionalData,
) => {
  return source.replace(
    /graphql\s*`(?:[^`])*`/g,
    (taggedTemplateExpression) => {
      const match = taggedTemplateExpression.match(
        /(query|mutation|subscription|fragment)\s+\b(.+?)\b/,
      );
      if (match && match[2]) {
        return `require("./__generated__/${match[2]}.graphql").default`;
      }
      return taggedTemplateExpression;
    },
  );
};

export default webpackLoader;
