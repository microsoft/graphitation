/**
 * Benchmark for isFragmentOf function
 *
 * Run with: npx ts-node -T ./src/benchmarks/isFragmentOf.benchmark.ts
 */

import { buildASTSchema, parse } from "graphql";
import NiceBenchmark from "./nice-benchmark";
import { extractMinimalViableSchemaForRequestDocument } from "../utilities/extractMinimalViableSchemaForRequestDocument";
import { encodeASTSchema } from "../utilities/encodeASTSchema";
import {
  SchemaDefinitions,
  FieldDefinitionRecord,
  InputValueDefinitionRecord,
  TypeDefinitionTuple,
  DirectiveDefinitionTuple,
  getDirectiveDefinitionArgs,
  getDirectiveName,
  getDirectiveLocations,
  getEnumValues,
  getFieldTypeReference,
  getFieldArgs,
  getFields,
  getInputObjectFields,
  getInputValueTypeReference,
  getUnionTypeMembers,
  isEnumTypeDefinition,
  isInputObjectTypeDefinition,
  isInterfaceTypeDefinition,
  isObjectTypeDefinition,
  isScalarTypeDefinition,
  isUnionTypeDefinition,
  getObjectTypeInterfaces,
  getInterfaceTypeInterfaces,
} from "../schema/definition";

// Real-world schema (similar to production size)
const schemaSDL = `
  type Query {
    user(id: ID!): User
    users(first: Int, after: String, filter: UserFilter): UserConnection!
    post(id: ID!): Post
    posts(first: Int, after: String): PostConnection!
    node(id: ID!): Node
    search(query: String!, type: SearchType): SearchResult
    viewer: Viewer
  }

  type Mutation {
    createUser(input: CreateUserInput!): CreateUserPayload
    updateUser(input: UpdateUserInput!): UpdateUserPayload
    deleteUser(id: ID!): DeleteUserPayload
    createPost(input: CreatePostInput!): CreatePostPayload
  }

  interface Node {
    id: ID!
  }

  interface Connection {
    edges: [Edge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  interface Edge {
    node: Node!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type User implements Node {
    id: ID!
    email: String!
    name: String
    avatar(size: Int = 100): String
    posts(first: Int, after: String): PostConnection!
    followers(first: Int, after: String): UserConnection!
    following(first: Int, after: String): UserConnection!
    createdAt: DateTime!
    updatedAt: DateTime!
    role: UserRole!
    settings: UserSettings
  }

  type UserConnection implements Connection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserEdge implements Edge {
    node: User!
    cursor: String!
  }

  type Post implements Node {
    id: ID!
    title: String!
    content: String!
    author: User!
    comments(first: Int, after: String): CommentConnection!
    likes: Int!
    tags: [String!]!
    status: PostStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type PostConnection implements Connection {
    edges: [PostEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PostEdge implements Edge {
    node: Post!
    cursor: String!
  }

  type Comment implements Node {
    id: ID!
    content: String!
    author: User!
    post: Post!
    createdAt: DateTime!
  }

  type CommentConnection implements Connection {
    edges: [CommentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CommentEdge implements Edge {
    node: Comment!
    cursor: String!
  }

  type Viewer {
    user: User
    notifications(first: Int, unreadOnly: Boolean): NotificationConnection!
  }

  type Notification implements Node {
    id: ID!
    message: String!
    read: Boolean!
    createdAt: DateTime!
  }

  type NotificationConnection implements Connection {
    edges: [NotificationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type NotificationEdge implements Edge {
    node: Notification!
    cursor: String!
  }

  type UserSettings {
    theme: Theme!
    emailNotifications: Boolean!
    pushNotifications: Boolean!
  }

  union SearchResult = User | Post | Comment

  enum UserRole {
    ADMIN
    MODERATOR
    USER
    GUEST
  }

  enum PostStatus {
    DRAFT
    PUBLISHED
    ARCHIVED
  }

  enum Theme {
    LIGHT
    DARK
    SYSTEM
  }

  enum SearchType {
    ALL
    USERS
    POSTS
    COMMENTS
  }

  input UserFilter {
    role: UserRole
    createdAfter: DateTime
    createdBefore: DateTime
  }

  input CreateUserInput {
    email: String!
    name: String
    role: UserRole = USER
  }

  input UpdateUserInput {
    id: ID!
    email: String
    name: String
    role: UserRole
  }

  input CreatePostInput {
    title: String!
    content: String!
    tags: [String!]
    status: PostStatus = DRAFT
  }

  type CreateUserPayload {
    user: User
    errors: [Error!]
  }

  type UpdateUserPayload {
    user: User
    errors: [Error!]
  }

  type DeleteUserPayload {
    success: Boolean!
    errors: [Error!]
  }

  type CreatePostPayload {
    post: Post
    errors: [Error!]
  }

  type Error {
    field: String
    message: String!
  }

  scalar DateTime

  directive @auth(requires: UserRole = USER) on FIELD_DEFINITION
  directive @deprecated(reason: String) on FIELD_DEFINITION
  directive @cacheControl(maxAge: Int, scope: CacheScope) on FIELD_DEFINITION | OBJECT

  enum CacheScope {
    PUBLIC
    PRIVATE
  }
`;

// Sample operations (<1kb each, typical real-world queries)
const sampleOperations = [
  // Simple query
  `query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      role
    }
  }`,
  // Query with nested fields
  `query GetUserWithPosts($id: ID!, $first: Int) {
    user(id: $id) {
      id
      name
      posts(first: $first) {
        edges {
          node {
            id
            title
            status
          }
          cursor
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  }`,
  // Query with fragments
  `query GetViewer {
    viewer {
      user {
        id
        name
        avatar(size: 200)
        settings {
          theme
          emailNotifications
        }
      }
    }
  }`,
  // Search query with union
  `query Search($query: String!, $type: SearchType) {
    search(query: $query, type: $type) {
      ... on User {
        id
        name
        email
      }
      ... on Post {
        id
        title
        author {
          name
        }
      }
    }
  }`,
  // Mutation
  `mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      post {
        id
        title
        content
        status
      }
      errors {
        field
        message
      }
    }
  }`,
  // Query with interface
  `query GetNode($id: ID!) {
    node(id: $id) {
      id
      ... on User {
        name
        email
      }
      ... on Post {
        title
        content
      }
      ... on Comment {
        content
      }
    }
  }`,
];

// Build schema and extract fragments
const schema = buildASTSchema(parse(schemaSDL));
const fullSchemaDefinitions = encodeASTSchema(parse(schemaSDL))[0];

const fragments = sampleOperations.map((op) => {
  const doc = parse(op);
  return extractMinimalViableSchemaForRequestDocument(schema, doc).definitions;
});

// ============================================================================
// Implementation 1: Original (current)
// ============================================================================
function isFragmentOf_v1(
  schema: SchemaDefinitions,
  fragment: SchemaDefinitions,
): boolean {
  for (const [typeName, fragmentType] of Object.entries(fragment.types)) {
    const schemaType = schema.types[typeName];
    if (!schemaType) return false;
    if (!isTypeFragmentOf_v1(schemaType, fragmentType)) return false;
  }

  if (fragment.directives) {
    if (!schema.directives) return false;
    for (const fragmentDirective of fragment.directives) {
      const fragmentName = getDirectiveName(fragmentDirective);
      const schemaDirective = schema.directives.find(
        (d) => getDirectiveName(d) === fragmentName,
      );
      if (!schemaDirective) return false;
      if (!isDirectiveFragmentOf_v1(schemaDirective, fragmentDirective))
        return false;
    }
  }

  return true;
}

function isTypeFragmentOf_v1(
  schemaType: TypeDefinitionTuple,
  fragmentType: TypeDefinitionTuple,
): boolean {
  if (schemaType[0] !== fragmentType[0]) return false;

  if (
    isObjectTypeDefinition(schemaType) &&
    isObjectTypeDefinition(fragmentType)
  ) {
    if (!isFieldsFragmentOf_v1(getFields(schemaType), getFields(fragmentType)))
      return false;
    const schemaInterfaces = getObjectTypeInterfaces(schemaType);
    const fragmentInterfaces = getObjectTypeInterfaces(fragmentType);
    return isArraySubset_v1(schemaInterfaces, fragmentInterfaces);
  }

  if (
    isInterfaceTypeDefinition(schemaType) &&
    isInterfaceTypeDefinition(fragmentType)
  ) {
    if (!isFieldsFragmentOf_v1(getFields(schemaType), getFields(fragmentType)))
      return false;
    const schemaInterfaces = getInterfaceTypeInterfaces(schemaType);
    const fragmentInterfaces = getInterfaceTypeInterfaces(fragmentType);
    return isArraySubset_v1(schemaInterfaces, fragmentInterfaces);
  }

  if (
    isInputObjectTypeDefinition(schemaType) &&
    isInputObjectTypeDefinition(fragmentType)
  ) {
    return isInputFieldsFragmentOf_v1(
      getInputObjectFields(schemaType),
      getInputObjectFields(fragmentType),
    );
  }

  if (
    isUnionTypeDefinition(schemaType) &&
    isUnionTypeDefinition(fragmentType)
  ) {
    const schemaMembers = getUnionTypeMembers(schemaType);
    const fragmentMembers = getUnionTypeMembers(fragmentType);
    return arraysEqual_v1(schemaMembers, fragmentMembers);
  }

  if (isEnumTypeDefinition(schemaType) && isEnumTypeDefinition(fragmentType)) {
    const schemaValues = getEnumValues(schemaType);
    const fragmentValues = getEnumValues(fragmentType);
    return arraysEqual_v1(schemaValues, fragmentValues);
  }

  if (
    isScalarTypeDefinition(schemaType) &&
    isScalarTypeDefinition(fragmentType)
  ) {
    return true;
  }

  return false;
}

function isFieldsFragmentOf_v1(
  schemaFields: FieldDefinitionRecord,
  fragmentFields: FieldDefinitionRecord,
): boolean {
  for (const [fieldName, fragmentField] of Object.entries(fragmentFields)) {
    const schemaField = schemaFields[fieldName];
    if (schemaField === undefined) return false;
    if (
      getFieldTypeReference(schemaField) !==
      getFieldTypeReference(fragmentField)
    )
      return false;
    if (
      !isInputValuesSubset_v1(
        getFieldArgs(schemaField),
        getFieldArgs(fragmentField),
      )
    )
      return false;
  }
  return true;
}

function isInputFieldsFragmentOf_v1(
  schemaFields: InputValueDefinitionRecord,
  fragmentFields: InputValueDefinitionRecord,
): boolean {
  for (const [fieldName, fragmentField] of Object.entries(fragmentFields)) {
    const schemaField = schemaFields[fieldName];
    if (schemaField === undefined) return false;
    if (
      getInputValueTypeReference(schemaField) !==
      getInputValueTypeReference(fragmentField)
    )
      return false;
  }
  return true;
}

function isDirectiveFragmentOf_v1(
  schemaDirective: DirectiveDefinitionTuple,
  fragmentDirective: DirectiveDefinitionTuple,
): boolean {
  if (
    !isInputValuesSubset_v1(
      getDirectiveDefinitionArgs(schemaDirective),
      getDirectiveDefinitionArgs(fragmentDirective),
    )
  ) {
    return false;
  }
  return isArraySubset_v1(
    getDirectiveLocations(schemaDirective),
    getDirectiveLocations(fragmentDirective),
  );
}

function isInputValuesSubset_v1(
  schemaArgs: InputValueDefinitionRecord | undefined,
  fragmentArgs: InputValueDefinitionRecord | undefined,
): boolean {
  if (!fragmentArgs) return true;
  if (!schemaArgs) return false;
  for (const [argName, fragmentArg] of Object.entries(fragmentArgs)) {
    const schemaArg = schemaArgs[argName];
    if (schemaArg === undefined) return false;
    if (
      getInputValueTypeReference(schemaArg) !==
      getInputValueTypeReference(fragmentArg)
    )
      return false;
  }
  return true;
}

function arraysEqual_v1<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}

function isArraySubset_v1<T>(superset: T[], subset: T[]): boolean {
  const supersetSet = new Set(superset);
  return subset.every((item) => supersetSet.has(item));
}

// ============================================================================
// Implementation 2: Optimized with for-in loops and direct property access
// ============================================================================
function isFragmentOf_v2(
  schema: SchemaDefinitions,
  fragment: SchemaDefinitions,
): boolean {
  const schemaTypes = schema.types;
  const fragmentTypes = fragment.types;

  for (const typeName in fragmentTypes) {
    const schemaType = schemaTypes[typeName];
    if (!schemaType) return false;
    if (!isTypeFragmentOf_v2(schemaType, fragmentTypes[typeName])) return false;
  }

  const fragmentDirectives = fragment.directives;
  if (fragmentDirectives) {
    const schemaDirectives = schema.directives;
    if (!schemaDirectives) return false;

    const directiveMap = new Map<string, DirectiveDefinitionTuple>();
    for (let i = 0; i < schemaDirectives.length; i++) {
      directiveMap.set(schemaDirectives[i][0], schemaDirectives[i]);
    }

    for (let i = 0; i < fragmentDirectives.length; i++) {
      const fragDir = fragmentDirectives[i];
      const schemaDir = directiveMap.get(fragDir[0]);
      if (!schemaDir) return false;
      if (!isDirectiveFragmentOf_v2(schemaDir, fragDir)) return false;
    }
  }

  return true;
}

function isTypeFragmentOf_v2(
  schemaType: TypeDefinitionTuple,
  fragmentType: TypeDefinitionTuple,
): boolean {
  const kind = schemaType[0];
  if (kind !== fragmentType[0]) return false;

  // Use direct kind comparison instead of type guard functions
  switch (kind) {
    case 2: // OBJECT
    case 3: // INTERFACE
      if (
        !isFieldsFragmentOf_v2(
          schemaType[1] as FieldDefinitionRecord,
          fragmentType[1] as FieldDefinitionRecord,
        )
      ) {
        return false;
      }
      const schemaIfaces = schemaType[2] as string[] | undefined;
      const fragIfaces = fragmentType[2] as string[] | undefined;
      if (fragIfaces && fragIfaces.length > 0) {
        if (!schemaIfaces) return false;
        return isArraySubset_v2(schemaIfaces, fragIfaces);
      }
      return true;

    case 6: // INPUT
      return isInputFieldsFragmentOf_v2(
        schemaType[1] as InputValueDefinitionRecord,
        fragmentType[1] as InputValueDefinitionRecord,
      );

    case 4: // UNION
      return arraysEqual_v2(
        schemaType[1] as string[],
        fragmentType[1] as string[],
      );

    case 5: // ENUM
      return arraysEqual_v2(
        schemaType[1] as string[],
        fragmentType[1] as string[],
      );

    case 1: // SCALAR
      return true;

    default:
      return false;
  }
}

function isFieldsFragmentOf_v2(
  schemaFields: FieldDefinitionRecord,
  fragmentFields: FieldDefinitionRecord,
): boolean {
  for (const fieldName in fragmentFields) {
    const schemaField = schemaFields[fieldName];
    if (schemaField === undefined) return false;

    const fragmentField = fragmentFields[fieldName];
    const schemaType = Array.isArray(schemaField)
      ? schemaField[0]
      : schemaField;
    const fragmentType = Array.isArray(fragmentField)
      ? fragmentField[0]
      : fragmentField;

    if (schemaType !== fragmentType) return false;

    const fragmentArgs = Array.isArray(fragmentField)
      ? fragmentField[1]
      : undefined;
    if (fragmentArgs) {
      const schemaArgs = Array.isArray(schemaField)
        ? schemaField[1]
        : undefined;
      if (!schemaArgs) return false;
      if (!isInputValuesSubset_v2(schemaArgs, fragmentArgs)) return false;
    }
  }
  return true;
}

function isInputFieldsFragmentOf_v2(
  schemaFields: InputValueDefinitionRecord,
  fragmentFields: InputValueDefinitionRecord,
): boolean {
  for (const fieldName in fragmentFields) {
    const schemaField = schemaFields[fieldName];
    if (schemaField === undefined) return false;

    const fragmentField = fragmentFields[fieldName];
    const schemaType = Array.isArray(schemaField)
      ? schemaField[0]
      : schemaField;
    const fragmentType = Array.isArray(fragmentField)
      ? fragmentField[0]
      : fragmentField;

    if (schemaType !== fragmentType) return false;
  }
  return true;
}

function isDirectiveFragmentOf_v2(
  schemaDirective: DirectiveDefinitionTuple,
  fragmentDirective: DirectiveDefinitionTuple,
): boolean {
  const fragmentArgs = fragmentDirective[2];
  if (fragmentArgs) {
    const schemaArgs = schemaDirective[2];
    if (!schemaArgs) return false;
    if (!isInputValuesSubset_v2(schemaArgs, fragmentArgs)) return false;
  }
  return isArraySubset_v2(schemaDirective[1], fragmentDirective[1]);
}

function isInputValuesSubset_v2(
  schemaArgs: InputValueDefinitionRecord,
  fragmentArgs: InputValueDefinitionRecord,
): boolean {
  for (const argName in fragmentArgs) {
    const schemaArg = schemaArgs[argName];
    if (schemaArg === undefined) return false;

    const fragmentArg = fragmentArgs[argName];
    const schemaType = Array.isArray(schemaArg) ? schemaArg[0] : schemaArg;
    const fragmentType = Array.isArray(fragmentArg)
      ? fragmentArg[0]
      : fragmentArg;

    if (schemaType !== fragmentType) return false;
  }
  return true;
}

function arraysEqual_v2<T>(a: T[], b: T[]): boolean {
  const len = a.length;
  if (len !== b.length) return false;
  if (len === 0) return true;
  if (len === 1) return a[0] === b[0];
  if (len === 2)
    return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);

  // For larger arrays, use Set-based comparison (no sorting)
  const setA = new Set(a);
  for (let i = 0; i < len; i++) {
    if (!setA.has(b[i])) return false;
  }
  return true;
}

function isArraySubset_v2<T>(superset: T[], subset: T[]): boolean {
  const len = subset.length;
  if (len === 0) return true;
  if (len === 1) return superset.includes(subset[0]);

  const supersetSet = new Set(superset);
  for (let i = 0; i < len; i++) {
    if (!supersetSet.has(subset[i])) return false;
  }
  return true;
}

// ============================================================================
// Implementation 3: Fully inlined with minimal function calls
// ============================================================================
function isFragmentOf_v3(
  schema: SchemaDefinitions,
  fragment: SchemaDefinitions,
): boolean {
  const schemaTypes = schema.types;
  const fragmentTypes = fragment.types;

  // Types check
  for (const typeName in fragmentTypes) {
    const schemaType = schemaTypes[typeName];
    if (!schemaType) return false;

    const fragmentType = fragmentTypes[typeName];
    const kind = schemaType[0];
    if (kind !== fragmentType[0]) return false;

    if (kind === 2 || kind === 3) {
      // OBJECT or INTERFACE
      // Check fields
      const schemaFields = schemaType[1] as FieldDefinitionRecord;
      const fragmentFields = fragmentType[1] as FieldDefinitionRecord;

      for (const fieldName in fragmentFields) {
        const schemaField = schemaFields[fieldName];
        if (schemaField === undefined) return false;

        const fragmentField = fragmentFields[fieldName];
        const schemaFieldType = Array.isArray(schemaField)
          ? schemaField[0]
          : schemaField;
        const fragmentFieldType = Array.isArray(fragmentField)
          ? fragmentField[0]
          : fragmentField;

        if (schemaFieldType !== fragmentFieldType) return false;

        // Check args
        const fragmentArgs = Array.isArray(fragmentField)
          ? fragmentField[1]
          : undefined;
        if (fragmentArgs) {
          const schemaArgs = Array.isArray(schemaField)
            ? schemaField[1]
            : undefined;
          if (!schemaArgs) return false;

          for (const argName in fragmentArgs) {
            const schemaArg = schemaArgs[argName];
            if (schemaArg === undefined) return false;
            const sArgType = Array.isArray(schemaArg)
              ? schemaArg[0]
              : schemaArg;
            const fArgType = Array.isArray(fragmentArgs[argName])
              ? fragmentArgs[argName][0]
              : fragmentArgs[argName];
            if (sArgType !== fArgType) return false;
          }
        }
      }

      // Check interfaces
      const fragIfaces = fragmentType[2] as string[] | undefined;
      if (fragIfaces && fragIfaces.length > 0) {
        const schemaIfaces = schemaType[2] as string[] | undefined;
        if (!schemaIfaces) return false;
        const ifaceSet = new Set(schemaIfaces);
        for (let i = 0; i < fragIfaces.length; i++) {
          if (!ifaceSet.has(fragIfaces[i])) return false;
        }
      }
    } else if (kind === 6) {
      // INPUT
      const schemaFields = schemaType[1] as InputValueDefinitionRecord;
      const fragmentFields = fragmentType[1] as InputValueDefinitionRecord;

      for (const fieldName in fragmentFields) {
        const schemaField = schemaFields[fieldName];
        if (schemaField === undefined) return false;
        const fragmentField = fragmentFields[fieldName];
        const sType = Array.isArray(schemaField) ? schemaField[0] : schemaField;
        const fType = Array.isArray(fragmentField)
          ? fragmentField[0]
          : fragmentField;
        if (sType !== fType) return false;
      }
    } else if (kind === 4 || kind === 5) {
      // UNION or ENUM
      const schemaValues = schemaType[1] as string[];
      const fragmentValues = fragmentType[1] as string[];
      const len = schemaValues.length;
      if (len !== fragmentValues.length) return false;
      if (len > 0) {
        const setA = new Set(schemaValues);
        for (let i = 0; i < len; i++) {
          if (!setA.has(fragmentValues[i])) return false;
        }
      }
    }
    // SCALAR (kind === 1) - always true if kind matches
  }

  // Directives check
  const fragmentDirectives = fragment.directives;
  if (fragmentDirectives && fragmentDirectives.length > 0) {
    const schemaDirectives = schema.directives;
    if (!schemaDirectives) return false;

    // Build directive map
    const directiveMap = new Map<string, DirectiveDefinitionTuple>();
    for (let i = 0; i < schemaDirectives.length; i++) {
      directiveMap.set(schemaDirectives[i][0], schemaDirectives[i]);
    }

    for (let i = 0; i < fragmentDirectives.length; i++) {
      const fragDir = fragmentDirectives[i];
      const schemaDir = directiveMap.get(fragDir[0]);
      if (!schemaDir) return false;

      // Check args
      const fragmentArgs = fragDir[2];
      if (fragmentArgs) {
        const schemaArgs = schemaDir[2];
        if (!schemaArgs) return false;
        for (const argName in fragmentArgs) {
          const schemaArg = schemaArgs[argName];
          if (schemaArg === undefined) return false;
          const sType = Array.isArray(schemaArg) ? schemaArg[0] : schemaArg;
          const fType = Array.isArray(fragmentArgs[argName])
            ? fragmentArgs[argName][0]
            : fragmentArgs[argName];
          if (sType !== fType) return false;
        }
      }

      // Check locations
      const schemaLocs = schemaDir[1];
      const fragLocs = fragDir[1];
      if (fragLocs.length > 0) {
        const locSet = new Set(schemaLocs);
        for (let j = 0; j < fragLocs.length; j++) {
          if (!locSet.has(fragLocs[j])) return false;
        }
      }
    }
  }

  return true;
}

// ============================================================================
// Verify all implementations produce same results
// ============================================================================
console.log("Verifying implementations produce identical results...");
let allMatch = true;
for (let i = 0; i < fragments.length; i++) {
  const r1 = isFragmentOf_v1(fullSchemaDefinitions, fragments[i]);
  const r2 = isFragmentOf_v2(fullSchemaDefinitions, fragments[i]);
  const r3 = isFragmentOf_v3(fullSchemaDefinitions, fragments[i]);

  if (r1 !== r2 || r2 !== r3) {
    console.error(`Mismatch for fragment ${i}: v1=${r1}, v2=${r2}, v3=${r3}`);
    allMatch = false;
  }
}

if (!allMatch) {
  console.error(
    "IMPLEMENTATIONS PRODUCE DIFFERENT RESULTS! Aborting benchmark.",
  );
  process.exit(1);
}
console.log("All implementations match!\n");

// ============================================================================
// Run benchmark
// ============================================================================
const ITERATIONS = 10000;

const suite = new NiceBenchmark(
  `isFragmentOf Benchmark (${ITERATIONS} iterations × ${fragments.length} fragments)`,
);

suite.add("v1: Original implementation", () => {
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < fragments.length; i++) {
      isFragmentOf_v1(fullSchemaDefinitions, fragments[i]);
    }
  }
});

suite.add("v2: Optimized (for-in, direct access, switch)", () => {
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < fragments.length; i++) {
      isFragmentOf_v2(fullSchemaDefinitions, fragments[i]);
    }
  }
});

suite.add("v3: Fully inlined", () => {
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < fragments.length; i++) {
      isFragmentOf_v3(fullSchemaDefinitions, fragments[i]);
    }
  }
});

// ============================================================================
// Implementation 4: v2 with Object.keys optimization for small objects
// ============================================================================
function isFragmentOf_v4(
  schema: SchemaDefinitions,
  fragment: SchemaDefinitions,
): boolean {
  const schemaTypes = schema.types;
  const fragmentTypes = fragment.types;
  const fragmentTypeNames = Object.keys(fragmentTypes);

  for (let t = 0; t < fragmentTypeNames.length; t++) {
    const typeName = fragmentTypeNames[t];
    const schemaType = schemaTypes[typeName];
    if (!schemaType) return false;
    if (!isTypeFragmentOf_v4(schemaType, fragmentTypes[typeName])) return false;
  }

  const fragmentDirectives = fragment.directives;
  if (fragmentDirectives && fragmentDirectives.length > 0) {
    const schemaDirectives = schema.directives;
    if (!schemaDirectives) return false;

    // Build directive map only if needed
    const directiveMap = new Map<string, DirectiveDefinitionTuple>();
    for (let i = 0; i < schemaDirectives.length; i++) {
      directiveMap.set(schemaDirectives[i][0], schemaDirectives[i]);
    }

    for (let i = 0; i < fragmentDirectives.length; i++) {
      const fragDir = fragmentDirectives[i];
      const schemaDir = directiveMap.get(fragDir[0]);
      if (!schemaDir) return false;
      if (!isDirectiveFragmentOf_v4(schemaDir, fragDir)) return false;
    }
  }

  return true;
}

function isTypeFragmentOf_v4(
  schemaType: TypeDefinitionTuple,
  fragmentType: TypeDefinitionTuple,
): boolean {
  const kind = schemaType[0];
  if (kind !== fragmentType[0]) return false;

  if (kind === 2 || kind === 3) {
    // OBJECT or INTERFACE
    const schemaFields = schemaType[1] as FieldDefinitionRecord;
    const fragmentFields = fragmentType[1] as FieldDefinitionRecord;
    const fieldNames = Object.keys(fragmentFields);

    for (let f = 0; f < fieldNames.length; f++) {
      const fieldName = fieldNames[f];
      const schemaField = schemaFields[fieldName];
      if (schemaField === undefined) return false;

      const fragmentField = fragmentFields[fieldName];
      const schemaFieldType = Array.isArray(schemaField)
        ? schemaField[0]
        : schemaField;
      const fragmentFieldType = Array.isArray(fragmentField)
        ? fragmentField[0]
        : fragmentField;

      if (schemaFieldType !== fragmentFieldType) return false;

      const fragmentArgs = Array.isArray(fragmentField)
        ? fragmentField[1]
        : undefined;
      if (fragmentArgs) {
        const schemaArgs = Array.isArray(schemaField)
          ? schemaField[1]
          : undefined;
        if (!schemaArgs) return false;

        const argNames = Object.keys(fragmentArgs);
        for (let a = 0; a < argNames.length; a++) {
          const argName = argNames[a];
          const schemaArg = schemaArgs[argName];
          if (schemaArg === undefined) return false;
          const sArgType = Array.isArray(schemaArg) ? schemaArg[0] : schemaArg;
          const fArgType = Array.isArray(fragmentArgs[argName])
            ? fragmentArgs[argName][0]
            : fragmentArgs[argName];
          if (sArgType !== fArgType) return false;
        }
      }
    }

    const fragIfaces = fragmentType[2] as string[] | undefined;
    if (fragIfaces && fragIfaces.length > 0) {
      const schemaIfaces = schemaType[2] as string[] | undefined;
      if (!schemaIfaces) return false;
      if (fragIfaces.length === 1) {
        if (!schemaIfaces.includes(fragIfaces[0])) return false;
      } else {
        const ifaceSet = new Set(schemaIfaces);
        for (let i = 0; i < fragIfaces.length; i++) {
          if (!ifaceSet.has(fragIfaces[i])) return false;
        }
      }
    }
    return true;
  }

  if (kind === 6) {
    // INPUT
    const schemaFields = schemaType[1] as InputValueDefinitionRecord;
    const fragmentFields = fragmentType[1] as InputValueDefinitionRecord;
    const fieldNames = Object.keys(fragmentFields);

    for (let f = 0; f < fieldNames.length; f++) {
      const fieldName = fieldNames[f];
      const schemaField = schemaFields[fieldName];
      if (schemaField === undefined) return false;
      const fragmentField = fragmentFields[fieldName];
      const sType = Array.isArray(schemaField) ? schemaField[0] : schemaField;
      const fType = Array.isArray(fragmentField)
        ? fragmentField[0]
        : fragmentField;
      if (sType !== fType) return false;
    }
    return true;
  }

  if (kind === 4 || kind === 5) {
    // UNION or ENUM
    const schemaValues = schemaType[1] as string[];
    const fragmentValues = fragmentType[1] as string[];
    const len = schemaValues.length;
    if (len !== fragmentValues.length) return false;
    if (len <= 3) {
      // For small arrays, linear search is faster
      for (let i = 0; i < len; i++) {
        if (!schemaValues.includes(fragmentValues[i])) return false;
      }
    } else {
      const setA = new Set(schemaValues);
      for (let i = 0; i < len; i++) {
        if (!setA.has(fragmentValues[i])) return false;
      }
    }
    return true;
  }

  // SCALAR (kind === 1)
  return true;
}

function isDirectiveFragmentOf_v4(
  schemaDirective: DirectiveDefinitionTuple,
  fragmentDirective: DirectiveDefinitionTuple,
): boolean {
  const fragmentArgs = fragmentDirective[2];
  if (fragmentArgs) {
    const schemaArgs = schemaDirective[2];
    if (!schemaArgs) return false;

    const argNames = Object.keys(fragmentArgs);
    for (let a = 0; a < argNames.length; a++) {
      const argName = argNames[a];
      const schemaArg = schemaArgs[argName];
      if (schemaArg === undefined) return false;
      const sType = Array.isArray(schemaArg) ? schemaArg[0] : schemaArg;
      const fType = Array.isArray(fragmentArgs[argName])
        ? fragmentArgs[argName][0]
        : fragmentArgs[argName];
      if (sType !== fType) return false;
    }
  }

  const schemaLocs = schemaDirective[1];
  const fragLocs = fragmentDirective[1];
  const locLen = fragLocs.length;
  if (locLen === 0) return true;
  if (locLen === 1) return schemaLocs.includes(fragLocs[0]);

  const locSet = new Set(schemaLocs);
  for (let i = 0; i < locLen; i++) {
    if (!locSet.has(fragLocs[i])) return false;
  }
  return true;
}

// Verify v4 matches
const v4Results = fragments.map((f) =>
  isFragmentOf_v4(fullSchemaDefinitions, f),
);
const v1Results = fragments.map((f) =>
  isFragmentOf_v1(fullSchemaDefinitions, f),
);
if (v4Results.some((r, i) => r !== v1Results[i])) {
  console.error("v4 produces different results!");
  process.exit(1);
}
console.log("v4 verified!\n");

suite.add("v4: Object.keys + small array optimizations", () => {
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < fragments.length; i++) {
      isFragmentOf_v4(fullSchemaDefinitions, fragments[i]);
    }
  }
});

suite.run().then(() => {
  console.log("\nDone!");
});
