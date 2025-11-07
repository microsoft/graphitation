import { subtractSchemaDefinitions } from "../subtractSchemaDefinitions";
import {
  SchemaDefinitions,
  createObjectTypeDefinition,
  createInterfaceTypeDefinition,
  createInputObjectTypeDefinition,
  createUnionTypeDefinition,
  createEnumTypeDefinition,
  createScalarTypeDefinition,
} from "../../schema/definition";

describe("subtractSchemaDefinitions", () => {
  describe("complete type removal", () => {
    it("should remove entire type when it is fully covered by subtrahend", () => {
      const minuend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
          Post: createObjectTypeDefinition({
            title: "String",
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          Post: createObjectTypeDefinition({
            title: "String",
          }),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types).toEqual({
        User: createObjectTypeDefinition({
          id: "ID",
          name: "String",
        }),
      });
    });

    it("should keep all types when subtrahend is empty", () => {
      const minuend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {},
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types).toEqual(minuend.types);
    });

    it("should return empty types when minuend equals subtrahend", () => {
      const schema: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(schema, schema);

      expect(result.types).toEqual({});
    });
  });

  describe("partial field subtraction for object types", () => {
    it("should subtract fields that exist in subtrahend", () => {
      const minuend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
            email: "String",
            age: "Int",
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            email: "String",
            age: "Int",
          }),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types.User).toEqual(
        createObjectTypeDefinition({
          id: "ID",
          name: "String",
        }),
      );
    });

    it("should remove entire type if all fields are subtracted", () => {
      const minuend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
          Post: createObjectTypeDefinition({
            title: "String",
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types.User).toBeUndefined();
      expect(result.types.Post).toBeDefined();
    });

    it("should throw when field has different type signature", () => {
      const minuend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            count: "Int",
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            count: "String", // Different type
          }),
        },
        directives: [],
      };

      expect(() => subtractSchemaDefinitions(minuend, subtrahend)).toThrow(
        /Field User.count has different type/,
      );
    });
  });

  describe("partial field subtraction for interface types", () => {
    it("should subtract fields from interface types", () => {
      const minuend: SchemaDefinitions = {
        types: {
          Node: createInterfaceTypeDefinition({
            id: "ID",
            createdAt: "String",
            updatedAt: "String",
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          Node: createInterfaceTypeDefinition({
            createdAt: "String",
          }),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types.Node).toEqual(
        createInterfaceTypeDefinition({
          id: "ID",
          updatedAt: "String",
        }),
      );
    });

    it("should keep interface implementations list intact", () => {
      const minuend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition(
            {
              id: "ID",
              name: "String",
              email: "String",
            },
            ["Node", "Timestamped"],
          ),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            email: "String",
          }),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types.User).toEqual(
        createObjectTypeDefinition(
          {
            id: "ID",
            name: "String",
          },
          ["Node", "Timestamped"],
        ),
      );
    });
  });

  describe("field arguments handling", () => {
    it("should throw when field arguments don't match exactly", () => {
      const minuend: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "Int",
                offset: "Int",
              },
            ],
            posts: ["Post", {}],
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
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
        directives: [],
      };

      expect(() => subtractSchemaDefinitions(minuend, subtrahend)).toThrow(
        /Field arguments must match exactly for subtraction/,
      );
    });

    it("should remove field when arguments match exactly", () => {
      const minuend: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: [
              "User",
              {
                limit: "Int",
                offset: "Int",
              },
            ],
            posts: ["Post", {}],
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
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
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types.Query).toEqual(
        createObjectTypeDefinition({
          posts: ["Post", {}],
        }),
      );
    });
  });

  describe("input object types", () => {
    it("should subtract input fields from input object types", () => {
      const minuend: SchemaDefinitions = {
        types: {
          UserInput: createInputObjectTypeDefinition({
            name: "String",
            email: "String",
            age: "Int",
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          UserInput: createInputObjectTypeDefinition({
            age: "Int",
          }),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types.UserInput).toEqual(
        createInputObjectTypeDefinition({
          name: "String",
          email: "String",
        }),
      );
    });

    it("should remove input type if all fields are subtracted", () => {
      const minuend: SchemaDefinitions = {
        types: {
          UserInput: createInputObjectTypeDefinition({
            name: "String",
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          UserInput: createInputObjectTypeDefinition({
            name: "String",
          }),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types.UserInput).toBeUndefined();
    });
  });

  describe("union types", () => {
    it("should throw when union types don't match exactly", () => {
      const minuend: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Post", "Comment"]),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["Post"]),
        },
        directives: [],
      };

      expect(() => subtractSchemaDefinitions(minuend, subtrahend)).toThrow(
        /Union types must match exactly for subtraction/,
      );
    });

    it("should remove union type if it matches exactly", () => {
      const minuend: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Post"]),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          SearchResult: createUnionTypeDefinition(["User", "Post"]),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types.SearchResult).toBeUndefined();
    });
  });

  describe("enum types", () => {
    it("should throw when enum types don't match exactly", () => {
      const minuend: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition([
            "ADMIN",
            "USER",
            "GUEST",
            "MODERATOR",
          ]),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["GUEST", "MODERATOR"]),
        },
        directives: [],
      };

      expect(() => subtractSchemaDefinitions(minuend, subtrahend)).toThrow(
        /Enum types must match exactly for subtraction/,
      );
    });

    it("should remove enum type if it matches exactly", () => {
      const minuend: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["ADMIN", "USER"]),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          Role: createEnumTypeDefinition(["ADMIN", "USER"]),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types.Role).toBeUndefined();
    });
  });

  describe("scalar types", () => {
    it("should remove scalar if it exists in subtrahend", () => {
      const minuend: SchemaDefinitions = {
        types: {
          DateTime: createScalarTypeDefinition(),
          UUID: createScalarTypeDefinition(),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          UUID: createScalarTypeDefinition(),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types.DateTime).toBeDefined();
      expect(result.types.UUID).toBeUndefined();
    });
  });

  describe("directives", () => {
    it("should remove directive if it exists in subtrahend", () => {
      const minuend: SchemaDefinitions = {
        types: {},
        directives: [
          ["auth", [4, 12]], // FIELD, FIELD_DEFINITION
          ["deprecated", [12]], // FIELD_DEFINITION
          ["custom", [11]], // OBJECT
        ],
      };

      const subtrahend: SchemaDefinitions = {
        types: {},
        directives: [["deprecated", [12]]],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.directives).toEqual([
        ["auth", [4, 12]],
        ["custom", [11]],
      ]);
    });

    it("should throw when directive arguments don't match exactly", () => {
      const minuend: SchemaDefinitions = {
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

      const subtrahend: SchemaDefinitions = {
        types: {},
        directives: [
          [
            "auth",
            [4, 12],
            {
              scopes: "String",
            },
          ],
        ],
      };

      expect(() => subtractSchemaDefinitions(minuend, subtrahend)).toThrow(
        /Directive arguments must match exactly for subtraction/,
      );
    });

    it("should remove directive arguments when they match exactly", () => {
      const minuend: SchemaDefinitions = {
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

      const subtrahend: SchemaDefinitions = {
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

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.directives).toEqual([]);
    });

    it("should remove directive if all arguments are subtracted", () => {
      const minuend: SchemaDefinitions = {
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

      const subtrahend: SchemaDefinitions = {
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

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.directives).toEqual([]);
    });

    it("should keep directive if it has no arguments in both fragments", () => {
      const minuend: SchemaDefinitions = {
        types: {},
        directives: [
          ["skip", [4]],
          ["include", [4]],
        ],
      };

      const subtrahend: SchemaDefinitions = {
        types: {},
        directives: [["include", [4]]],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.directives).toEqual([["skip", [4]]]);
    });
  });

  describe("type kind mismatches", () => {
    it("should throw error when same type name has different kinds", () => {
      const minuend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          User: createInterfaceTypeDefinition({
            id: "ID",
          }),
        },
        directives: [],
      };

      expect(() => subtractSchemaDefinitions(minuend, subtrahend)).toThrow(
        /Type User is represented differently/,
      );
    });

    it("should throw error for scalar vs object mismatch", () => {
      const minuend: SchemaDefinitions = {
        types: {
          DateTime: createScalarTypeDefinition(),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          DateTime: createObjectTypeDefinition({
            value: "String",
          }),
        },
        directives: [],
      };

      expect(() => subtractSchemaDefinitions(minuend, subtrahend)).toThrow(
        /Type DateTime is represented differently/,
      );
    });
  });

  describe("strict mode", () => {
    describe("validation errors", () => {
      it("should throw when subtrahend has field not in minuend", () => {
        const minuend: SchemaDefinitions = {
          types: {
            User: createObjectTypeDefinition({
              id: "ID",
              name: "String",
            }),
          },
          directives: [],
        };

        const subtrahend: SchemaDefinitions = {
          types: {
            User: createObjectTypeDefinition({
              email: "String", // Field doesn't exist in minuend
            }),
          },
          directives: [],
        };

        expect(() =>
          subtractSchemaDefinitions(minuend, subtrahend, true),
        ).toThrow(/Field User.email does not exist in minuend/);
      });

      it("should throw when subtrahend has input field not in minuend", () => {
        const minuend: SchemaDefinitions = {
          types: {
            UserInput: createInputObjectTypeDefinition({
              name: "String",
            }),
          },
          directives: [],
        };

        const subtrahend: SchemaDefinitions = {
          types: {
            UserInput: createInputObjectTypeDefinition({
              email: "String", // Field doesn't exist in minuend
            }),
          },
          directives: [],
        };

        expect(() =>
          subtractSchemaDefinitions(minuend, subtrahend, true),
        ).toThrow(/Input field UserInput.email does not exist in minuend/);
      });

      it("should throw when subtrahend has type not in minuend", () => {
        const minuend: SchemaDefinitions = {
          types: {
            User: createObjectTypeDefinition({
              id: "ID",
            }),
          },
          directives: [],
        };

        const subtrahend: SchemaDefinitions = {
          types: {
            Post: createObjectTypeDefinition({
              title: "String",
            }),
          },
          directives: [],
        };

        expect(() =>
          subtractSchemaDefinitions(minuend, subtrahend, true),
        ).toThrow(/Type Post does not exist in minuend/);
      });

      it("should throw when subtrahend has directive not in minuend", () => {
        const minuend: SchemaDefinitions = {
          types: {},
          directives: [["auth", [4, 12]]],
        };

        const subtrahend: SchemaDefinitions = {
          types: {},
          directives: [["deprecated", [12]]],
        };

        expect(() =>
          subtractSchemaDefinitions(minuend, subtrahend, true),
        ).toThrow(/Directive deprecated does not exist in minuend/);
      });

      it("should throw when trying to subtract union member that doesn't exist", () => {
        const minuend: SchemaDefinitions = {
          types: {
            SearchResult: createUnionTypeDefinition([
              "User",
              "Post",
              "Comment",
            ]),
          },
          directives: [],
        };

        const subtrahend: SchemaDefinitions = {
          types: {
            SearchResult: createUnionTypeDefinition(["Article"]),
          },
          directives: [],
        };

        expect(() =>
          subtractSchemaDefinitions(minuend, subtrahend, true),
        ).toThrow(
          /Union SearchResult: member Article does not exist in minuend/,
        );
      });

      it("should throw when trying to subtract enum value that doesn't exist", () => {
        const minuend: SchemaDefinitions = {
          types: {
            Role: createEnumTypeDefinition(["ADMIN", "USER"]),
          },
          directives: [],
        };

        const subtrahend: SchemaDefinitions = {
          types: {
            Role: createEnumTypeDefinition(["GUEST"]),
          },
          directives: [],
        };

        expect(() =>
          subtractSchemaDefinitions(minuend, subtrahend, true),
        ).toThrow(/Enum Role: value GUEST does not exist in minuend/);
      });
    });
  });

  describe("non-strict mode", () => {
    describe("ignores items in subtrahend not present in minuend", () => {
      it("should ignore field not in minuend", () => {
        const minuend: SchemaDefinitions = {
          types: {
            User: createObjectTypeDefinition({
              id: "ID",
              name: "String",
            }),
          },
          directives: [],
        };

        const subtrahend: SchemaDefinitions = {
          types: {
            User: createObjectTypeDefinition({
              email: "String", // Field doesn't exist in minuend
            }),
          },
          directives: [],
        };

        const result = subtractSchemaDefinitions(minuend, subtrahend, false);

        expect(result.types.User).toEqual(
          createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
        );
      });

      it("should ignore input field not in minuend", () => {
        const minuend: SchemaDefinitions = {
          types: {
            UserInput: createInputObjectTypeDefinition({
              name: "String",
            }),
          },
          directives: [],
        };

        const subtrahend: SchemaDefinitions = {
          types: {
            UserInput: createInputObjectTypeDefinition({
              email: "String", // Field doesn't exist in minuend
            }),
          },
          directives: [],
        };

        const result = subtractSchemaDefinitions(minuend, subtrahend, false);

        expect(result.types.UserInput).toEqual(
          createInputObjectTypeDefinition({
            name: "String",
          }),
        );
      });

      it("should ignore type not in minuend", () => {
        const minuend: SchemaDefinitions = {
          types: {
            User: createObjectTypeDefinition({
              id: "ID",
            }),
          },
          directives: [],
        };

        const subtrahend: SchemaDefinitions = {
          types: {
            Post: createObjectTypeDefinition({
              title: "String",
            }),
          },
          directives: [],
        };

        const result = subtractSchemaDefinitions(minuend, subtrahend, false);

        expect(result.types.User).toEqual(
          createObjectTypeDefinition({
            id: "ID",
          }),
        );
      });

      it("should ignore directive not in minuend", () => {
        const minuend: SchemaDefinitions = {
          types: {},
          directives: [["auth", [4, 12]]],
        };

        const subtrahend: SchemaDefinitions = {
          types: {},
          directives: [["deprecated", [12]]],
        };

        const result = subtractSchemaDefinitions(minuend, subtrahend, false);

        expect(result.directives).toEqual([["auth", [4, 12]]]);
      });

      it("should ignore union member that doesn't exist", () => {
        const minuend: SchemaDefinitions = {
          types: {
            SearchResult: createUnionTypeDefinition([
              "User",
              "Post",
              "Comment",
            ]),
          },
          directives: [],
        };

        const subtrahend: SchemaDefinitions = {
          types: {
            SearchResult: createUnionTypeDefinition(["Article"]),
          },
          directives: [],
        };

        const result = subtractSchemaDefinitions(minuend, subtrahend, false);

        expect(result.types.SearchResult).toEqual(
          createUnionTypeDefinition(["User", "Post", "Comment"]),
        );
      });

      it("should ignore enum value that doesn't exist", () => {
        const minuend: SchemaDefinitions = {
          types: {
            Role: createEnumTypeDefinition(["ADMIN", "USER"]),
          },
          directives: [],
        };

        const subtrahend: SchemaDefinitions = {
          types: {
            Role: createEnumTypeDefinition(["GUEST"]),
          },
          directives: [],
        };

        const result = subtractSchemaDefinitions(minuend, subtrahend, false);

        expect(result.types.Role).toEqual(
          createEnumTypeDefinition(["ADMIN", "USER"]),
        );
      });
    });
  });

  describe("complex scenarios", () => {
    it("should handle mixed type subtraction", () => {
      const minuend: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            user: ["User", { id: "ID" }],
            users: "User",
            post: ["Post", { id: "ID" }],
            posts: "Post",
          }),
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
            email: "String",
          }),
          Post: createObjectTypeDefinition({
            id: "ID",
            title: "String",
          }),
          Role: createEnumTypeDefinition(["ADMIN", "USER"]),
        },
        directives: [["auth", [12]]],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          Query: createObjectTypeDefinition({
            users: "User",
            posts: "Post",
          }),
          User: createObjectTypeDefinition({
            email: "String",
          }),
          Role: createEnumTypeDefinition(["ADMIN", "USER"]),
        },
        directives: [],
      };

      const result = subtractSchemaDefinitions(minuend, subtrahend);

      expect(result.types.Query).toEqual(
        createObjectTypeDefinition({
          user: ["User", { id: "ID" }],
          post: ["Post", { id: "ID" }],
        }),
      );
      expect(result.types.User).toEqual(
        createObjectTypeDefinition({
          id: "ID",
          name: "String",
        }),
      );
      expect(result.types.Post).toEqual(
        createObjectTypeDefinition({
          id: "ID",
          title: "String",
        }),
      );
      expect(result.types.Role).toBeUndefined();
      expect(result.directives).toEqual([["auth", [12]]]);
    });

    it("should not mutate input objects", () => {
      const minuend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            id: "ID",
            name: "String",
          }),
        },
        directives: [],
      };

      const subtrahend: SchemaDefinitions = {
        types: {
          User: createObjectTypeDefinition({
            name: "String",
          }),
        },
        directives: [],
      };

      const originalMinuend = JSON.parse(JSON.stringify(minuend));
      const originalSubtrahend = JSON.parse(JSON.stringify(subtrahend));

      subtractSchemaDefinitions(minuend, subtrahend);

      expect(minuend).toEqual(originalMinuend);
      expect(subtrahend).toEqual(originalSubtrahend);
    });
  });
});
