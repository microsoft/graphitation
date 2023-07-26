import { FormatModuleOptions, formatModuleFactory } from "../formatModule";
import * as path from "path";
import { Request } from "relay-compiler";
import { SourceLocation } from "relay-compiler/lib/core/IR";

import type { FormatModule } from "relay-compiler/lib/language/RelayLanguagePluginInterface";

type FormatModuleData = Parameters<FormatModule>[0];

async function formatModule(
  options: Partial<FormatModuleOptions>,
  data: Partial<FormatModuleData>,
) {
  const fn = await formatModuleFactory({
    schema: path.resolve(
      __dirname,
      "../../../apollo-react-relay-duct-tape/src/__tests__/schema.graphql",
    ),
    ...options,
  } as FormatModuleOptions);
  return fn({
    moduleName: "MessageComponent",
    ...data,
  } as FormatModuleData);
}

describe("formatModule", () => {
  it("only prints the types when not emitting docs", async () => {
    expect(
      await formatModule(
        { emitDocuments: false },
        {
          definition: {
            kind: "Request",
            root: {
              kind: "Root",
              operation: "query",
            },
          } as Request,
          typeText: `
            export type MessageComponent_message = {
              id: string;
            };
          `,
          docText: `
            fragment MessageComponent_message on Message {
              id
            }
          `,
        },
      ),
    ).toMatchInlineSnapshot(`
      "/* tslint:disable */
      /* eslint-disable */
      // @ts-nocheck


                  export type MessageComponent_message = {
                    id: string;
                  };
                "
    `);
  });

  it("only prints the execution query doc when not emitting narrow observables", async () => {
    expect(
      await formatModule(
        { emitDocuments: true, emitNarrowObservables: false },
        {
          definition: {
            kind: "Request",
            root: {
              kind: "Root",
              operation: "query",
            },
          } as Request,
          typeText: `
            export type MessageComponent_message = {
              id: string;
            };
          `,
          docText: `
            fragment MessageComponent_message on Message {
              id
            }
          `,
        },
      ),
    ).toMatchInlineSnapshot(`
      "/* tslint:disable */
      /* eslint-disable */
      // @ts-nocheck


                  export type MessageComponent_message = {
                    id: string;
                  };
                

      export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = {
        "executionQueryDocument": {
          "kind": "Document",
          "definitions": [
            {
              "kind": "FragmentDefinition",
              "name": {
                "kind": "Name",
                "value": "MessageComponent_message"
              },
              "typeCondition": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "Message"
                }
              },
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "id"
                    }
                  }
                ]
              }
            }
          ]
        }
      };

      export default documents;"
    `);
  });

  it("adds supermassive AST to the execution doc", async () => {
    expect(
      await formatModule(
        {
          emitDocuments: true,
          emitSupermassiveDocuments: true,
          emitNarrowObservables: false,
        },
        {
          definition: {
            kind: "Request",
          } as Request,
          typeText: `
            export type MessageComponent_message = {
              id: string;
            };
          `,
          docText: `
            fragment MessageComponent_message on Message {
              id
            }
          `,
        },
      ),
    ).toMatchInlineSnapshot(`
      "/* tslint:disable */
      /* eslint-disable */
      // @ts-nocheck


                  export type MessageComponent_message = {
                    id: string;
                  };
                

      export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = {
        "executionQueryDocument": {
          "kind": "Document",
          "definitions": [
            {
              "kind": "FragmentDefinition",
              "name": {
                "kind": "Name",
                "value": "MessageComponent_message"
              },
              "typeCondition": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "Message"
                }
              },
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "id"
                    },
                    "__type": {
                      "kind": "NonNullType",
                      "type": {
                        "kind": "NamedType",
                        "name": {
                          "kind": "Name",
                          "value": "ID"
                        }
                      }
                    },
                    "arguments": []
                  }
                ]
              }
            }
          ]
        }
      };

      export default documents;"
    `);
  });

  it("also prints the watch query doc when emitting narrow observables", async () => {
    expect(
      await formatModule(
        {
          emitDocuments: true,
          emitSupermassiveDocuments: false,
          emitNarrowObservables: true,
        },
        {
          definition: {
            kind: "Request",
            root: {
              kind: "Root",
              operation: "query",
            },
          } as Request,
          typeText: `export type UserComponentQuery = {};`,
          docText: `
            query UserComponentQuery {
              user(id: 42) {
                id
              }
            }
          `,
        },
      ),
    ).toMatchInlineSnapshot(`
      "/* tslint:disable */
      /* eslint-disable */
      // @ts-nocheck

      export type UserComponentQuery = {};

      export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
      var v0 = {
        "kind": "Name",
        "value": "id"
      },
      v1 = {
        "kind": "Document",
        "definitions": [
          {
            "kind": "OperationDefinition",
            "operation": "query",
            "name": {
              "kind": "Name",
              "value": "UserComponentQuery"
            },
            "selectionSet": {
              "kind": "SelectionSet",
              "selections": [
                {
                  "kind": "Field",
                  "name": {
                    "kind": "Name",
                    "value": "user"
                  },
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": (v0/*: any*/),
                      "value": {
                        "kind": "IntValue",
                        "value": "42"
                      }
                    }
                  ],
                  "selectionSet": {
                    "kind": "SelectionSet",
                    "selections": [
                      {
                        "kind": "Field",
                        "name": (v0/*: any*/)
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      };
      return {
        "executionQueryDocument": (v1/*: any*/),
        "watchQueryDocument": (v1/*: any*/)
      };
      })();

      export default documents;"
    `);
  });

  describe("concerning narrow observables", () => {
    it("exports from sibling watch query artefact for fragments", async () => {
      expect(
        await formatModule(
          {
            emitDocuments: true,
            emitSupermassiveDocuments: true,
            emitNarrowObservables: true,
          },
          {
            definition: {
              kind: "Fragment",
              name: "MessageComponent_message",
              directives: [
                {
                  kind: "Directive",
                  name: "refetchable",
                  args: [
                    {
                      kind: "Argument",
                      name: "queryName",
                      value: {
                        kind: "Literal",
                        value: "MessageComponent_messageWatchNodeQuery",
                        loc: { kind: "Generated" },
                      },
                      metadata: undefined,
                      loc: { kind: "Generated" },
                    },
                  ],

                  metadata: undefined,
                  loc: { kind: "Generated" },
                },
              ],

              argumentDefinitions: [],
              metadata: undefined,
              selections: [],
              type: "unknown",
              loc: { kind: "Generated" },
            },
            typeText: `
              export type MessageComponent_message = {
                id: string;
              };
            `,
            docText: null,
          },
        ),
      ).toMatchInlineSnapshot(`
        "/* tslint:disable */
        /* eslint-disable */
        // @ts-nocheck


                      export type MessageComponent_message = {
                        id: string;
                      };
                    

        import { documents } from "./MessageComponent_messageWatchNodeQuery.graphql";
        export default documents;"
      `);
    });

    it("exports from sibling refetch query artefact for fragments when it contains @refetchable", async () => {
      expect(
        await formatModule(
          {
            emitDocuments: true,
            emitSupermassiveDocuments: true,
            emitNarrowObservables: true,
          },
          {
            definition: {
              kind: "Fragment",
              name: "MessageComponent_message",
              directives: [
                {
                  kind: "Directive",
                  name: "refetchable",
                  args: [
                    {
                      kind: "Argument",
                      name: "queryName",
                      value: {
                        kind: "Literal",
                        value: "MessageComponent_messageWatchNodeQuery",
                        loc: { kind: "Generated" },
                      },
                      metadata: undefined,
                      loc: { kind: "Generated" },
                    },
                  ],

                  metadata: undefined,
                  loc: { kind: "Generated" },
                },
                {
                  kind: "Directive",
                  name: "refetchable",
                  args: [
                    {
                      kind: "Argument",
                      name: "queryName",
                      value: {
                        kind: "Literal",
                        value: "MessageComponentRefetchQuery",
                        loc: { kind: "Source" } as SourceLocation,
                      },
                      metadata: undefined,
                      loc: { kind: "Source" } as SourceLocation,
                    },
                  ],

                  metadata: undefined,
                  loc: { kind: "Source" } as SourceLocation,
                },
              ],

              argumentDefinitions: [],
              metadata: undefined,
              selections: [],
              type: "unknown",
              loc: { kind: "Generated" },
            },
            typeText: `
              export type MessageComponent_message = {
                id: string;
              };
            `,
            docText: null,
          },
        ),
      ).toMatchInlineSnapshot(`
        "/* tslint:disable */
        /* eslint-disable */
        // @ts-nocheck


                      export type MessageComponent_message = {
                        id: string;
                      };
                    

        import { documents } from "./MessageComponentRefetchQuery.graphql";
        export default documents;"
      `);
    });
  });

  it("does not add watch node queries for mutations", async () => {
    expect(
      await formatModule(
        {
          emitDocuments: true,
          emitSupermassiveDocuments: false,
          emitNarrowObservables: true,
        },
        {
          definition: {
            kind: "Request",
            root: {
              kind: "Root",
              operation: "mutation",
            },
          } as Request,
          typeText: `export type MessageComponent_message = {};`,
          docText: `
            mutation MessageComponent_message {
              user(id: 42) {
                id
              }
            }
          `,
        },
      ),
    ).toMatchInlineSnapshot(`
      "/* tslint:disable */
      /* eslint-disable */
      // @ts-nocheck

      export type MessageComponent_message = {};

      export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
      var v0 = {
        "kind": "Name",
        "value": "id"
      };
      return {
        "executionQueryDocument": {
          "kind": "Document",
          "definitions": [
            {
              "kind": "OperationDefinition",
              "operation": "mutation",
              "name": {
                "kind": "Name",
                "value": "MessageComponent_message"
              },
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "user"
                    },
                    "arguments": [
                      {
                        "kind": "Argument",
                        "name": (v0/*: any*/),
                        "value": {
                          "kind": "IntValue",
                          "value": "42"
                        }
                      }
                    ],
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v0/*: any*/)
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      };
      })();

      export default documents;"
    `);
  });

  it("does not add watch node queries for subscriptions", async () => {
    expect(
      await formatModule(
        {
          emitDocuments: true,
          emitSupermassiveDocuments: false,
          emitNarrowObservables: true,
        },
        {
          definition: {
            kind: "Request",
            root: {
              kind: "Root",
              operation: "subscription",
            },
          } as Request,
          typeText: `export type MessageComponent_message = {};`,
          docText: `
          subscription MessageComponent_message {
              user(id: 42) {
                id
              }
            }
          `,
        },
      ),
    ).toMatchInlineSnapshot(`
      "/* tslint:disable */
      /* eslint-disable */
      // @ts-nocheck

      export type MessageComponent_message = {};

      export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
      var v0 = {
        "kind": "Name",
        "value": "id"
      };
      return {
        "executionQueryDocument": {
          "kind": "Document",
          "definitions": [
            {
              "kind": "OperationDefinition",
              "operation": "subscription",
              "name": {
                "kind": "Name",
                "value": "MessageComponent_message"
              },
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "user"
                    },
                    "arguments": [
                      {
                        "kind": "Argument",
                        "name": (v0/*: any*/),
                        "value": {
                          "kind": "IntValue",
                          "value": "42"
                        }
                      }
                    ],
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v0/*: any*/)
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      };
      })();

      export default documents;"
    `);
  });

  it.todo("reducing watch query to node fragment");
  it.todo("extract metadata");
});
