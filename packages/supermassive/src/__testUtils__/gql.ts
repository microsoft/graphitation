import { DocumentNode, parse } from "graphql";

export type GqlResult = { raw: string; document: DocumentNode };

export function gql(raw: TemplateStringsArray): GqlResult {
  return { raw: raw[0], document: parse(raw[0]) };
}
