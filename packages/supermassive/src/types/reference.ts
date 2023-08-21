import { TypeReference } from "./definition";
import { TypeNode, print } from "graphql";

// Assumes strict reference format (i.e. no whitespaces, comments, etc)
// (must be enforced at build-time)
const EncodedSpecTypes = [
  "String",
  "Boolean",
  "Int",
  "Float",
  "ID",

  "String!",
  "Boolean!",
  "Int!",
  "Float!",
  "ID!",

  "[String]",
  "[Boolean]",
  "[Int]",
  "[Float]",
  "[ID]",

  "[String!]",
  "[Boolean!]",
  "[Int!]",
  "[Float!]",
  "[ID!]",

  "[String]!",
  "[Boolean]!",
  "[Int]!",
  "[Float]!",
  "[ID]!",

  "[String!]!",
  "[Boolean!]!",
  "[Int!]!",
  "[Float!]!",
  "[ID!]!",
];
const EncodedSpecTypeCount = 5;

const NON_NULL_TOKEN = "!";
const LIST_START_TOKEN = "[";
const LIST_END_TOKEN = "]";

export function isNonNullType(typeRef: TypeReference): boolean {
  const ref = normalize(typeRef);
  return ref[ref.length - 1] === NON_NULL_TOKEN;
}

export function isListType(typeRef: TypeReference): boolean {
  const ref = normalize(typeRef);
  return ref[ref.length - 1] === LIST_END_TOKEN;
}

export function isWrapperType(typeRef: TypeReference): boolean {
  return isNonNullType(typeRef) || isListType(typeRef);
}

export function unwrapOne(typeRef: TypeReference): TypeReference {
  const ref = normalize(typeRef);
  if (isListType(ref)) {
    return optimize(ref.slice(1, ref.length - 1));
  }
  if (isNonNullType(ref)) {
    return optimize(ref.slice(0, ref.length - 1));
  }
  throw new Error(
    `Can not unwrap type "${ref}": it is a nullable type and is not a list`,
  );
}

export function unwrapAll(typeRef: TypeReference): TypeReference {
  const typeName = typeNameFromReference(typeRef);
  return optimize(typeName);
}

export function typeNameFromReference(typeRef: TypeReference): string {
  if (
    typeof typeRef === "number" &&
    EncodedSpecTypes[typeRef % EncodedSpecTypeCount]
  ) {
    // Fast path for spec types
    return EncodedSpecTypes[typeRef % EncodedSpecTypeCount];
  }
  const ref = normalize(typeRef);
  let startIndex = 0;
  let endIndex = ref.length - 1;
  while (ref[startIndex] === LIST_START_TOKEN) {
    startIndex++;
  }
  while (ref[endIndex] === LIST_END_TOKEN || ref[endIndex] === NON_NULL_TOKEN) {
    endIndex--;
  }
  return startIndex === 0 && endIndex === ref.length - 1
    ? ref
    : ref.slice(startIndex, endIndex + 1);
}

export function typeReferenceFromNode(typeNode: TypeNode): TypeReference {
  return optimize(print(typeNode));
}

export function typeReferenceFromName(name: string): TypeReference {
  return optimize(name);
}

export function inspectTypeReference(typeRef: TypeReference): string {
  return typeof typeRef === "number"
    ? EncodedSpecTypes[typeRef] ?? "(UnknownType)"
    : typeRef;
}

function normalize(typeRef: TypeReference): string {
  if (typeof typeRef === "number") {
    const stringRef = EncodedSpecTypes[typeRef];
    if (!stringRef) {
      const rangeEnd = EncodedSpecTypes.length - 1;
      throw new Error(
        `Unexpected type reference: ${typeRef} ` +
          `(expecting string or numeric id in the range 0-${rangeEnd})`,
      );
    }
    return stringRef;
  }
  return typeRef;
}

function optimize(typeRef: string): TypeReference {
  const index = EncodedSpecTypes.indexOf(typeRef);
  return index === -1 ? typeRef : index;
}
