import {
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  parse as gqlParse,
} from "graphql";
import {
  FieldInfo,
  FieldMap,
  OperationDescriptor,
  OperationEnv,
  PossibleSelection,
  PossibleSelections,
  VariableValues,
} from "../../descriptor/types";
import { describeDocument } from "../../descriptor/document";
import { describeOperation } from "../../descriptor/operation";
import { describeResultTree } from "../../descriptor/possibleSelection";
import { assert } from "../../jsutils/assert";

const descriptorCache = new Map();
const documentCache = new Map();

export function parseOnce(str: string) {
  let doc = documentCache.get(str);
  if (!doc) {
    doc = gqlParse(str, { noLocation: true });
    documentCache.set(str, doc);
  }
  return doc;
}

export const gql = (x: TemplateStringsArray) => parseOnce(x[0] ?? "");

export function createTestOperation(
  documentOrString: DocumentNode | string,
  variables: VariableValues | undefined = undefined,
  context: OperationEnv = { defaultHistorySize: 0 },
): OperationDescriptor {
  const document =
    typeof documentOrString === "string"
      ? parseOnce(documentOrString)
      : documentOrString;
  let doc = document;
  if (
    doc.definitions.length === 1 &&
    doc.definitions[0].kind === "FragmentDefinition"
  ) {
    // Convenience: for fragment-only doc create an operation with fragment as the root selection
    const fragment: FragmentDefinitionNode = doc.definitions[0];
    doc = {
      ...document,
      definitions: [
        {
          kind: "OperationDefinition",
          operation: "query",
          selectionSet: {
            kind: "SelectionSet",
            selections: [
              {
                kind: "FragmentSpread",
                name: { kind: "Name", value: fragment.name.value },
              },
            ],
          },
        } as OperationDefinitionNode,
        ...doc.definitions,
      ],
    };
  }
  const docDescriptor = describeDocument(doc);

  let resultDescriptor = descriptorCache.get(documentOrString);
  if (!resultDescriptor) {
    resultDescriptor = describeResultTree(docDescriptor);
    descriptorCache.set(documentOrString, resultDescriptor);
  }

  return describeOperation(
    context,
    docDescriptor,
    resultDescriptor,
    variables ?? {},
  );
}

export function getFieldInfo(
  selection: PossibleSelection | PossibleSelections,
  path: string[],
): FieldInfo {
  if (selection instanceof Map) {
    // PossibleSelections map
    selection = selection.get(null) as PossibleSelection;
  }
  let result: FieldInfo | undefined;
  let currentFields: FieldMap | undefined = selection.fields;
  for (const step of path) {
    result = currentFields?.get(step)?.[0];
    currentFields = result?.selection?.get(null)?.fields;
  }
  assert(result);
  return result;
}

export function clearDescriptorCache() {
  descriptorCache.clear();
}

export function clearDocumentCache() {
  descriptorCache.clear();
}
