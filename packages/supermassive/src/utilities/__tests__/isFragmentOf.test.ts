import { isFragmentOf } from "../isFragmentOf";
import {
  SchemaDefinitions,
  createObjectTypeDefinition,
  createInterfaceTypeDefinition,
  createInputObjectTypeDefinition,
  createUnionTypeDefinition,
  createEnumTypeDefinition,
  createScalarTypeDefinition,
} from "../../schema/definition";

describe("isFragmentOf", () => {
  describe("empty schemas", () => {
    it("should return true for two empty schemas", () => {
      const schema: SchemaDefinitions = {
        types: {},
      };

      const fragment: SchemaDefinitions = {
        types: {},
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return true when fragment is empty and schema is not", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {},
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when schema is empty and fragment is not", () => {
      const schema: SchemaDefinitions = {
        types: {},
      };

      const fragment: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });
  });

  describe("object types", () => {
    it("should return true when fragment type is identical to schema type", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return true when fragment has subset of fields", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
            email: "String",
            age: "Int",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment has field not in schema", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            email: "String", // Not in schema
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return false when fragment field has different type", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            count: "Int",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            count: "String", // Different type
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return true when fragment has subset of types", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
          Post: createObjectTypeDefinition({
            title: "String",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment has type not in schema", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Post: createObjectTypeDefinition({
            title: "String",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });
  });

  describe("field arguments", () => {
    it("should return true when field arguments match exactly", () => {
      const schema: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "Int",
                offset: "Int",
              },
            ],
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "Int",
                offset: "Int",
              },
            ],
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return true when fragment has fewer arguments (subset is valid)", () => {
      const schema: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "Int",
                offset: "Int",
              },
            ],
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "Int",
                // offset omitted - valid subset
              },
            ],
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment has argument not in schema", () => {
      const schema: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "Int",
              },
            ],
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "Int",
                offset: "Int", // Not in schema
              },
            ],
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return false when fragment field has arguments but schema field does not", () => {
      const schema: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: "User",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "Int",
              },
            ],
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return true when schema field has arguments but fragment field does not (empty subset is valid)", () => {
      const schema: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "Int",
              },
            ],
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: "User",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment argument has different type", () => {
      const schema: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "Int",
              },
            ],
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "String", // Different type
              },
            ],
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });
  });

  describe("interface types", () => {
    it("should return true when fragment interface is subset of schema interface", () => {
      const schema: SchemaDefinitions = {
        types: {
          Node: createInterfaceTypeDefinition({
            id: "ID",
            createdAt: "String",
            updatedAt: "String",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Node: createInterfaceTypeDefinition({
            id: "ID",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment interface has field not in schema", () => {
      const schema: SchemaDefinitions = {
        types: {
          Node: createInterfaceTypeDefinition({
            id: "ID",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Node: createInterfaceTypeDefinition({
            id: "ID",
            createdAt: "String", // Not in schema
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });
  });

  describe("interface implementations", () => {
    it("should return true when fragment implements subset of interfaces", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition(
            {
              id: "ID",
              name: "String",
            },
            ["Node", "Timestamped", "Auditable"],
          ),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition(
            {
              id: "ID",
            },
            ["Node", "Timestamped"],
          ),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment implements interface not in schema", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition(
            {
              id: "ID",
            },
            ["Node"],
          ),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition(
            {
              id: "ID",
            },
            ["Node", "Timestamped"], // Timestamped not in schema
          ),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return true when fragment has no interfaces and schema does", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition(
            {
              id: "ID",
            },
            ["Node"],
          ),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return true for interface implementing other interfaces", () => {
      const schema: SchemaDefinitions = {
        types: {
          Node: createInterfaceTypeDefinition(
            {
              id: "ID",
            },
            ["Identifiable", "Timestamped"],
          ),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Node: createInterfaceTypeDefinition(
            {
              id: "ID",
            },
            ["Identifiable"],
          ),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });
  });

  describe("input object types", () => {
    it("should return true when fragment input has subset of fields", () => {
      const schema: SchemaDefinitions = {
        types: {
          UserInput: createInputObjectTypeDefinition({
            name: "String",
            email: "String",
            age: "Int",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          UserInput: createInputObjectTypeDefinition({
            name: "String",
            email: "String",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment input has field not in schema", () => {
      const schema: SchemaDefinitions = {
        types: {
          UserInput: createInputObjectTypeDefinition({
            name: "String",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          UserInput: createInputObjectTypeDefinition({
            name: "String",
            email: "String", // Not in schema
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return false when fragment input field has different type", () => {
      const schema: SchemaDefinitions = {
        types: {
          UserInput: createInputObjectTypeDefinition({
            age: "Int",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          UserInput: createInputObjectTypeDefinition({
            age: "String", // Different type
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });
  });

  describe("union types (atomic)", () => {
    it("should return true when union types match exactly", () => {
      const schema: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Post", "Comment"]),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Post", "Comment"]),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return true when union members are in different order", () => {
      const schema: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Post", "Comment"]),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["Comment", "User", "Post"]),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment union has fewer members", () => {
      const schema: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Post", "Comment"]),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Post"]),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return false when fragment union has more members", () => {
      const schema: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Post"]),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Post", "Comment"]),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return false when fragment union has different members", () => {
      const schema: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Post"]),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Comment"]),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });
  });

  describe("enum types (atomic)", () => {
    it("should return true when enum types match exactly", () => {
      const schema: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["ADMIN", "USER", "GUEST"]),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["ADMIN", "USER", "GUEST"]),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return true when enum values are in different order", () => {
      const schema: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["ADMIN", "USER", "GUEST"]),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["GUEST", "ADMIN", "USER"]),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment enum has fewer values", () => {
      const schema: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["ADMIN", "USER", "GUEST"]),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["ADMIN", "USER"]),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return false when fragment enum has more values", () => {
      const schema: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["ADMIN", "USER"]),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["ADMIN", "USER", "GUEST"]),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return false when fragment enum has different values", () => {
      const schema: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["ADMIN", "USER"]),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["ADMIN", "GUEST"]),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });
  });

  describe("scalar types", () => {
    it("should return true when scalar exists in both", () => {
      const schema: SchemaDefinitions = {
        types: {
          DateTime: createScalarTypeDefinition(),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          DateTime: createScalarTypeDefinition(),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment scalar does not exist in schema", () => {
      const schema: SchemaDefinitions = {
        types: {
          DateTime: createScalarTypeDefinition(),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          UUID: createScalarTypeDefinition(),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });
  });

  describe("directives", () => {
    it("should return true when fragment has no directives and schema does", () => {
      const schema: SchemaDefinitions = {
        types: {},
        directives: [
          ["auth", [4, 12]], // FIELD, FIELD_DEFINITION
        ],
      };

      const fragment: SchemaDefinitions = {
        types: {},
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return true when directive exists in both with matching arguments", () => {
      const schema: SchemaDefinitions = {
        types: {},
        directives: [
          [
            "auth",
            [4, 12],
            {
              requires: "Role",
            },
          ],
        ],
      };

      const fragment: SchemaDefinitions = {
        types: {},
        directives: [
          [
            "auth",
            [4, 12],
            {
              requires: "Role",
            },
          ],
        ],
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment directive does not exist in schema", () => {
      const schema: SchemaDefinitions = {
        types: {},
        directives: [["auth", [4, 12]]],
      };

      const fragment: SchemaDefinitions = {
        types: {},
        directives: [["deprecated", [12]]],
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return false when fragment has directives but schema does not", () => {
      const schema: SchemaDefinitions = {
        types: {},
      };

      const fragment: SchemaDefinitions = {
        types: {},
        directives: [["auth", [4, 12]]],
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return true when fragment directive has fewer arguments (subset is valid)", () => {
      const schema: SchemaDefinitions = {
        types: {},
        directives: [
          [
            "auth",
            [4, 12],
            {
              requires: "Role",
              scopes: "String",
            },
          ],
        ],
      };

      const fragment: SchemaDefinitions = {
        types: {},
        directives: [
          [
            "auth",
            [4, 12],
            {
              requires: "Role",
              // scopes omitted - valid subset
            },
          ],
        ],
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment directive has argument not in schema", () => {
      const schema: SchemaDefinitions = {
        types: {},
        directives: [
          [
            "auth",
            [4, 12],
            {
              requires: "Role",
            },
          ],
        ],
      };

      const fragment: SchemaDefinitions = {
        types: {},
        directives: [
          [
            "auth",
            [4, 12],
            {
              requires: "Role",
              scopes: "String", // Not in schema
            },
          ],
        ],
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return false when directive argument types don't match", () => {
      const schema: SchemaDefinitions = {
        types: {},
        directives: [
          [
            "auth",
            [4, 12],
            {
              requires: "Role",
            },
          ],
        ],
      };

      const fragment: SchemaDefinitions = {
        types: {},
        directives: [
          [
            "auth",
            [4, 12],
            {
              requires: "String", // Different type
            },
          ],
        ],
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return true when fragment directive locations are subset of schema locations", () => {
      const schema: SchemaDefinitions = {
        types: {},
        directives: [["auth", [4, 12, 14]]], // FIELD, FIELD_DEFINITION, INTERFACE
      };

      const fragment: SchemaDefinitions = {
        types: {},
        directives: [["auth", [4, 12]]], // FIELD, FIELD_DEFINITION (subset)
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false when fragment directive has location not in schema", () => {
      const schema: SchemaDefinitions = {
        types: {},
        directives: [["auth", [4, 12]]], // FIELD, FIELD_DEFINITION
      };

      const fragment: SchemaDefinitions = {
        types: {},
        directives: [["auth", [4, 12, 14]]], // FIELD, FIELD_DEFINITION, INTERFACE (14 not in schema)
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return true for directives without arguments", () => {
      const schema: SchemaDefinitions = {
        types: {},
        directives: [["skip", [4]]],
      };

      const fragment: SchemaDefinitions = {
        types: {},
        directives: [["skip", [4]]],
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });
  });

  describe("type kind mismatches", () => {
    it("should return false when same type name has different kinds (object vs interface)", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          User: createInterfaceTypeDefinition({
            id: "ID",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return false when same type name has different kinds (scalar vs object)", () => {
      const schema: SchemaDefinitions = {
        types: {
          DateTime: createScalarTypeDefinition(),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          DateTime: createObjectTypeDefinition({
            value: "String",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should return false when same type name has different kinds (enum vs union)", () => {
      const schema: SchemaDefinitions = {
        types: {
          Result: createEnumTypeDefinition(["SUCCESS", "FAILURE"]),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Result: createUnionTypeDefinition(["Success", "Failure"]),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });
  });

  describe("complex scenarios", () => {
    it("should validate a realistic schema fragment", () => {
      const schema: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            user: ["User", { id: "ID" }],
            users: ["User", { limit: "Int", offset: "Int" }],
            post: ["Post", { id: "ID" }],
            posts: "Post",
          }),
          User: createObjectTypeDefinition(
            {
              id: "ID",
              name: "String",
              email: "String",
              posts: "Post",
            },
            ["Node"],
          ),
          Post: createObjectTypeDefinition(
            {
              id: "ID",
              title: "String",
              content: "String",
              author: "User",
            },
            ["Node"],
          ),
          Node: createInterfaceTypeDefinition({
            id: "ID",
          }),
          Role: createEnumTypeDefinition(["ADMIN", "USER", "GUEST"]),
          SearchResult: createUnionTypeDefinition(["User", "Post"]),
        },
        directives: [
          ["auth", [4, 12], { requires: "Role" }],
          ["deprecated", [12]],
        ],
      };

      const fragment: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            user: ["User", { id: "ID" }],
          }),
          User: createObjectTypeDefinition(
            {
              id: "ID",
              name: "String",
            },
            ["Node"],
          ),
          Node: createInterfaceTypeDefinition({
            id: "ID",
          }),
          Role: createEnumTypeDefinition(["ADMIN", "USER", "GUEST"]),
        },
        directives: [["auth", [4], { requires: "Role" }]],
      };

      expect(isFragmentOf(schema, fragment)).toBe(true);
    });

    it("should return false for invalid fragment with missing type", () => {
      const schema: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            user: "User",
          }),
          User: createObjectTypeDefinition({
            id: "ID",
          }),
        },
      };

      const fragment: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            user: "User",
          }),
          User: createObjectTypeDefinition({
            id: "ID",
          }),
          Post: createObjectTypeDefinition({
            // Not in schema
            title: "String",
          }),
        },
      };

      expect(isFragmentOf(schema, fragment)).toBe(false);
    });

    it("should handle multiple issues in fragment", () => {
      const schema: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            user: "User",
          }),
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
        },
      };

      // Fragment with field not in schema
      const invalidFragment: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            user: "User",
          }),
          User: createObjectTypeDefinition({
            id: "ID",
            email: "String", // Not in schema
          }),
        },
      };

      expect(isFragmentOf(schema, invalidFragment)).toBe(false);
    });
  });
});
