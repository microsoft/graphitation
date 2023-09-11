import { TypeReference } from "./definition";
import { print, TypeNode } from "graphql";

// Assumes strict reference format (i.e. no whitespaces, comments, etc)
// Note: the actual type id is shifted by 1, so String=1, Boolean=2, etc. There is no type with id 0 for sanity.
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
const NamedTypeMod = 5;

const NON_NULL_TOKEN = "!";
const LIST_START_TOKEN = "[";
const LIST_END_TOKEN = "]";

export function isNonNullType(typeRef: TypeReference): boolean {
  const ref = decodeRef(typeRef);
  return ref[ref.length - 1] === NON_NULL_TOKEN;
}

export function isListType(typeRef: TypeReference): boolean {
  const ref = decodeRef(typeRef);
  return ref[ref.length - 1] === LIST_END_TOKEN;
}

export function isWrapperType(typeRef: TypeReference): boolean {
  return isNonNullType(typeRef) || isListType(typeRef);
}

export function unwrap(typeRef: TypeReference): TypeReference {
  const ref = decodeRef(typeRef);
  if (isListType(ref)) {
    return encodeRef(ref.slice(1, ref.length - 1));
  }
  if (isNonNullType(ref)) {
    return encodeRef(ref.slice(0, ref.length - 1));
  }
  throw new Error(
    `Can not unwrap type "${ref}": it is a nullable type and is not a list`,
  );
}

export function unwrapAll(typeRef: TypeReference): TypeReference {
  const typeName = typeNameFromReference(typeRef);
  return encodeRef(typeName);
}

export function typeNameFromReference(typeRef: TypeReference): string {
  if (typeof typeRef === "number") {
    // Fast path for spec types
    return typeNameFromSpecReference(typeRef);
  }
  const ref = decodeRef(typeRef);
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
  return encodeRef(print(typeNode));
}

export function typeReferenceFromName(name: string): TypeReference {
  return encodeRef(name);
}

export function inspectTypeReference(typeRef: TypeReference): string {
  return typeof typeRef === "number"
    ? EncodedSpecTypes[typeRef] ?? "(UnknownType)"
    : typeRef;
}

function decodeRef(typeRef: TypeReference): string {
  if (typeof typeRef === "number") {
    const stringRef = EncodedSpecTypes[typeRef - 1];
    if (!stringRef) {
      const rangeEnd = EncodedSpecTypes.length;
      throw new Error(
        `Unexpected type reference: ${typeRef} ` +
          `(expecting string or numeric id in the range 1:${rangeEnd})`,
      );
    }
    return stringRef;
  }
  return typeRef;
}

function encodeRef(typeRef: string): TypeReference {
  const index = EncodedSpecTypes.indexOf(typeRef);
  return index === -1 ? typeRef : index + 1;
}

function typeNameFromSpecReference(typeRef: number): string {
  return decodeRef(((typeRef - 1) % NamedTypeMod) + 1);
}
