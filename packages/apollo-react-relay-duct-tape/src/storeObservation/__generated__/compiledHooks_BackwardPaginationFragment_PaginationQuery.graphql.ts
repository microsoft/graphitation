/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type compiledHooks_BackwardPaginationFragment_PaginationQueryVariables = {
    messagesBackwardCount: number;
    messagesBeforeCursor: string;
    id: string;
};
export type compiledHooks_BackwardPaginationFragment_PaginationQueryResponse = {
    readonly node: {
        readonly " $fragmentRefs": FragmentRefs<"compiledHooks_BackwardPaginationFragment">;
    } | null;
};
export type compiledHooks_BackwardPaginationFragment_PaginationQuery = {
    readonly response: compiledHooks_BackwardPaginationFragment_PaginationQueryResponse;
    readonly variables: compiledHooks_BackwardPaginationFragment_PaginationQueryVariables;
};


/*
query compiledHooks_BackwardPaginationFragment_PaginationQuery($messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_BackwardPaginationFragment
    id
  }
}

fragment compiledHooks_BackwardPaginationFragment on Conversation {
  messages(last: $messagesBackwardCount, before: $messagesBeforeCursor) @connection(key: "compiledHooks_conversation_messages") {
    edges {
      node {
        text
        id
        __typename
      }
      cursor
    }
    pageInfo {
      hasPreviousPage
      startCursor
    }
  }
  id
}
*/

/*
query compiledHooks_BackwardPaginationFragment_PaginationQuery($messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_BackwardPaginationFragment
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment compiledHooks_BackwardPaginationFragment on Conversation {
  messages(last: $messagesBackwardCount, before: $messagesBeforeCursor) @connection(key: "compiledHooks_conversation_messages") {
    edges {
      node {
        text
        id
        __typename
      }
      cursor
    }
    pageInfo {
      hasPreviousPage
      startCursor
    }
  }
  id
}
*/

export const documents: import("relay-compiler-language-graphitation").CompiledArtefactModule = {
  "executionQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": {
          "kind": "Name",
          "value": "compiledHooks_BackwardPaginationFragment_PaginationQuery"
        },
        "variableDefinitions": [
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "messagesBackwardCount"
              }
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "Int"
                }
              }
            },
            "directives": []
          },
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "messagesBeforeCursor"
              }
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "String"
                }
              }
            },
            "directives": []
          },
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "id"
              }
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "ID"
                }
              }
            },
            "directives": []
          }
        ],
        "directives": [],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "node"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "id"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "id"
                    }
                  }
                }
              ],
              "directives": [],
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "__typename"
                    },
                    "arguments": [],
                    "directives": []
                  },
                  {
                    "kind": "FragmentSpread",
                    "name": {
                      "kind": "Name",
                      "value": "compiledHooks_BackwardPaginationFragment"
                    },
                    "directives": []
                  },
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "id"
                    },
                    "arguments": [],
                    "directives": []
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": {
          "kind": "Name",
          "value": "compiledHooks_BackwardPaginationFragment"
        },
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "Conversation"
          }
        },
        "directives": [],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "messages"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "last"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "messagesBackwardCount"
                    }
                  }
                },
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "before"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "messagesBeforeCursor"
                    }
                  }
                }
              ],
              "directives": [
                {
                  "kind": "Directive",
                  "name": {
                    "kind": "Name",
                    "value": "connection"
                  },
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": {
                        "kind": "Name",
                        "value": "key"
                      },
                      "value": {
                        "kind": "StringValue",
                        "value": "compiledHooks_conversation_messages",
                        "block": false
                      }
                    }
                  ]
                }
              ],
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "edges"
                    },
                    "arguments": [],
                    "directives": [],
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "node"
                          },
                          "arguments": [],
                          "directives": [],
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "text"
                                },
                                "arguments": [],
                                "directives": []
                              },
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "id"
                                },
                                "arguments": [],
                                "directives": []
                              },
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "__typename"
                                },
                                "arguments": [],
                                "directives": []
                              }
                            ]
                          }
                        },
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "cursor"
                          },
                          "arguments": [],
                          "directives": []
                        }
                      ]
                    }
                  },
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "pageInfo"
                    },
                    "arguments": [],
                    "directives": [],
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "hasPreviousPage"
                          },
                          "arguments": [],
                          "directives": []
                        },
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "startCursor"
                          },
                          "arguments": [],
                          "directives": []
                        }
                      ]
                    }
                  }
                ]
              }
            },
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "id"
              },
              "arguments": [],
              "directives": []
            }
          ]
        }
      }
    ]
  },
  "watchQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": {
          "kind": "Name",
          "value": "compiledHooks_BackwardPaginationFragment_PaginationQuery"
        },
        "variableDefinitions": [
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "messagesBackwardCount"
              }
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "Int"
                }
              }
            },
            "directives": []
          },
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "messagesBeforeCursor"
              }
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "String"
                }
              }
            },
            "directives": []
          },
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "id"
              }
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "ID"
                }
              }
            },
            "directives": []
          }
        ],
        "directives": [],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "node"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "id"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "id"
                    }
                  }
                }
              ],
              "directives": [],
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "__typename"
                    },
                    "arguments": [],
                    "directives": []
                  },
                  {
                    "kind": "FragmentSpread",
                    "name": {
                      "kind": "Name",
                      "value": "compiledHooks_BackwardPaginationFragment"
                    },
                    "directives": []
                  },
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "id"
                    },
                    "arguments": [],
                    "directives": []
                  },
                  {
                    "kind": "InlineFragment",
                    "typeCondition": {
                      "kind": "NamedType",
                      "name": {
                        "kind": "Name",
                        "value": "Node"
                      }
                    },
                    "directives": [],
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "__fragments"
                          },
                          "arguments": [],
                          "directives": [
                            {
                              "kind": "Directive",
                              "name": {
                                "kind": "Name",
                                "value": "client"
                              },
                              "arguments": []
                            }
                          ]
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": {
          "kind": "Name",
          "value": "compiledHooks_BackwardPaginationFragment"
        },
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "Conversation"
          }
        },
        "directives": [],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "messages"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "last"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "messagesBackwardCount"
                    }
                  }
                },
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "before"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "messagesBeforeCursor"
                    }
                  }
                }
              ],
              "directives": [
                {
                  "kind": "Directive",
                  "name": {
                    "kind": "Name",
                    "value": "connection"
                  },
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": {
                        "kind": "Name",
                        "value": "key"
                      },
                      "value": {
                        "kind": "StringValue",
                        "value": "compiledHooks_conversation_messages",
                        "block": false
                      }
                    }
                  ]
                }
              ],
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "edges"
                    },
                    "arguments": [],
                    "directives": [],
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "node"
                          },
                          "arguments": [],
                          "directives": [],
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "text"
                                },
                                "arguments": [],
                                "directives": []
                              },
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "id"
                                },
                                "arguments": [],
                                "directives": []
                              },
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "__typename"
                                },
                                "arguments": [],
                                "directives": []
                              }
                            ]
                          }
                        },
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "cursor"
                          },
                          "arguments": [],
                          "directives": []
                        }
                      ]
                    }
                  },
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "pageInfo"
                    },
                    "arguments": [],
                    "directives": [],
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "hasPreviousPage"
                          },
                          "arguments": [],
                          "directives": []
                        },
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "startCursor"
                          },
                          "arguments": [],
                          "directives": []
                        }
                      ]
                    }
                  }
                ]
              }
            },
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "id"
              },
              "arguments": [],
              "directives": []
            }
          ]
        }
      }
    ]
  },
  "metadata": {
    "rootSelection": "node",
    "mainFragment": {
      "name": "compiledHooks_BackwardPaginationFragment",
      "typeCondition": "Conversation"
    },
    "connection": {
      "selectionPath": [
        "messages"
      ],
      "backwardCountVariable": "messagesBackwardCount",
      "backwardCursorVariable": "messagesBeforeCursor"
    }
  }
};