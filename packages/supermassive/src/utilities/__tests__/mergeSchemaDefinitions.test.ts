import { parse } from "graphql";
import {
  createSchemaDefinitions,
  mergeSchemaDefinitions,
} from "../mergeSchemaDefinitions";
import { encodeASTSchema } from "../encodeASTSchema";
import { SchemaDefinitions } from "../../schema/definition";

function schema(sdl: string): SchemaDefinitions[] {
  const doc = parse(sdl);
  return encodeASTSchema(doc);
}

describe("mergeSchemaDefinitions", () => {
  it("should return accumulator when no definitions provided", () => {
    const accumulator = schema(`
      type User {
        id: ID
      }
    `)[0];
    const result = mergeSchemaDefinitions(accumulator, []);
    expect(result).toBe(accumulator);
  });

  it("should merge fields from multiple object type definitions with interfaces", () => {
    const defs = schema(`
      type User implements Node & Named {
        id: ID
        name: String
      }
      
      extend type User implements Contactable {
        email: String
      }
    `);
    const result = mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "User": [
            2,
            {
              "email": 1,
              "id": 5,
              "name": 1,
            },
            [
              "Node",
              "Named",
              "Contactable",
            ],
          ],
        },
      }
    `);
  });

  it("should merge multiple types and preserve interfaces", () => {
    const defs = schema(`
      type User implements Node {
        id: ID
      }
      
      type User {
        name: String
      }
      
      type Post {
        title: String
      }
    `);
    const result = mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "Post": [
            2,
            {
              "title": 1,
            },
          ],
          "User": [
            2,
            {
              "id": 5,
              "name": 1,
            },
            [
              "Node",
            ],
          ],
        },
      }
    `);
  });

  it("should merge interface and input type definitions", () => {
    const defs = schema(`
      interface Node {
        id: ID
      }
      
      input UserInput {
        name: String
      }
      
      extend interface Node {
        typename: String
      }
      
      extend input UserInput {
        email: String
      }
    `);
    const result = mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "Node": [
            3,
            {
              "id": 5,
              "typename": 1,
            },
          ],
          "UserInput": [
            6,
            {
              "email": 1,
              "name": 1,
            },
          ],
        },
      }
    `);
  });

  it("should handle scalar, union, enum types and directives", () => {
    const defs = schema(`
      scalar DateTime
      
      union SearchResult = User | Post
      
      enum UserRole {
        ADMIN
        USER
      }
      
      directive @skip on FIELD
    `);
    const result = mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [
          [
            "skip",
            [
              4,
            ],
          ],
        ],
        "types": {
          "DateTime": [
            1,
          ],
          "SearchResult": [
            4,
            [
              "User",
              "Post",
            ],
          ],
          "UserRole": [
            5,
            [
              "ADMIN",
              "USER",
            ],
          ],
        },
      }
    `);
  });

  it("should throw when scalar type definition differs", () => {
    const defs = schema(`
      scalar DateTime
      
      enum DateTime {
        ADMIN
      }
    `);
    expect(() => {
      mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    }).toThrow();
  });

  it("should merge schema with createSchemaDefinitions", () => {
    const defs = schema(`
      type User implements Node {
        id: ID
      }
      
      extend type User {
        name: String
      }
      
      type Post {
        title: String
      }
    `);
    const result = createSchemaDefinitions(defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "Post": [
            2,
            {
              "title": 1,
            },
          ],
          "User": [
            2,
            {
              "id": 5,
              "name": 1,
            },
            [
              "Node",
            ],
          ],
        },
      }
    `);
  });

  it("should handle type extensions with multiple interfaces", () => {
    const defs = schema(`
      type User implements Node {
        id: ID
      }
      
      extend type User implements Named {
        name: String @testDirective
      }
      
      extend type User implements Contactable {
        email: String
      }
    `);
    const result = mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "User": [
            2,
            {
              "email": 1,
              "id": 5,
              "name": 1,
            },
            [
              "Node",
              "Named",
              "Contactable",
            ],
          ],
        },
      }
    `);
  });

  it("should not modify target when source has no interfaces", () => {
    const defs = schema(`
      type User implements Node {
        id: ID
      }
      
      extend type User {
        name: String
      }
    `);
    const [base] = defs;
    const targetInterfacesBefore = base.types.User[2];
    mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(base.types.User[2]).toEqual(targetInterfacesBefore);
  });

  it("should copy interfaces from source when target has none", () => {
    const defs = schema(`
      type User {
        id: ID
      }
      
      extend type User implements Node & Named {
        name: String
      }
    `);
    const result = mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "User": [
            2,
            {
              "id": 5,
              "name": 1,
            },
            [
              "Node",
              "Named",
            ],
          ],
        },
      }
    `);
  });

  it("should add unique interfaces from source to target", () => {
    const defs = schema(`
      type User implements Node {
        id: ID
      }
      
      extend type User implements Named & Timestamped {
        name: String
      }
    `);
    const result = mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "User": [
            2,
            {
              "id": 5,
              "name": 1,
            },
            [
              "Node",
              "Named",
              "Timestamped",
            ],
          ],
        },
      }
    `);
  });

  it("should not duplicate existing interfaces when merging", () => {
    const defs = schema(`
      type User implements Node & Named {
        id: ID
      }
      
      extend type User implements Node & Contactable {
        name: String
      }
    `);
    const result = mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "User": [
            2,
            {
              "id": 5,
              "name": 1,
            },
            [
              "Node",
              "Named",
              "Contactable",
            ],
          ],
        },
      }
    `);
  });

  it("should work with interface type definitions", () => {
    const defs = schema(`
      interface Entity implements Node {
        id: ID
      }
      
      extend interface Entity implements Named {
        name: String
      }
    `);
    const result = mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "Entity": [
            3,
            {
              "id": 5,
              "name": 1,
            },
            [
              "Node",
              "Named",
            ],
          ],
        },
      }
    `);
  });

  it("should copy interfaces from source when target interface has none", () => {
    const defs = schema(`
      interface Entity {
        id: ID
      }
      
      extend interface Entity implements Node & Named {
        name: String
      }
    `);
    const result = mergeSchemaDefinitions({ types: {}, directives: [] }, defs);
    expect(result).toMatchInlineSnapshot(`
      {
        "directives": [],
        "types": {
          "Entity": [
            3,
            {
              "id": 5,
              "name": 1,
            },
            [
              "Node",
              "Named",
            ],
          ],
        },
      }
    `);
  });
});
