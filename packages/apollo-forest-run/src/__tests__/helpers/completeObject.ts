import { gql } from "./descriptor";

export const completeObjectDoc = gql`
  query ($includeOptional: Boolean = false, $skipOptional: Boolean = true) {
    ...CompleteObjectFragment
  }
  fragment CompleteObjectFragment on CompleteObject {
    __typename

    scalar
    scalarList

    maybeInclude: scalar(simple: true) @include(if: $includeOptional)
    maybeSkip: scalar(simple: false) @skip(if: $skipOptional)

    plainObject {
      __typename
      foo
    }
    plainObjectList {
      __typename
      foo
    }

    entity {
      __typename
      id
      foo
    }
    entityList {
      __typename
      id
      foo
    }
    entityOrPlainObjectUnionList {
      __typename
      ... on EntityFoo {
        id
        foo
      }
      ... on PlainObjectFoo {
        foo
      }
    }

    connection {
      __typename
      edges {
        __typename
        cursor
        since
        node {
          __typename
          id
          foo
        }
      }
      pageInfo {
        __typename
        hasNextPage
      }
    }

    # TODO:
    plainObjectUnion {
      __typename
      ... on PlainObjectFoo {
        foo
        entityUnion {
          ...EntityUnion
        }
      }
      ... on PlainObjectBar {
        bar
        entityUnion {
          ...EntityUnion
        }
      }
    }
    plainObjectUnionList {
      __typename
      ... on PlainObjectFoo {
        foo
        entityUnion {
          ...EntityUnion
        }
      }
      ... on PlainObjectBar {
        bar
        entityUnion {
          ...EntityUnion
        }
      }
    }

    plainObjectInterface {
      __typename
      ... on PlainObjectBar {
        bar
      }
      ... on PlainObjectFoo {
        foo
      }
    }
    plainObjectInterfaceList {
      __typename
    }

    completeObject {
      ...NestedCompleteObject
    }

    completeObjectList {
      ...NestedCompleteObject
    }
  }

  fragment EntityUnion on EntityUnion {
    __typename
    ... on EntityFoo {
      id
      foo
    }
    ... on EntityBar {
      id
      bar
    }
  }

  fragment NestedCompleteObject on CompleteObject {
    __typename
    optionalScalar: scalar @include(if: $includeOptional)

    scalar
    scalarList

    plainObject {
      __typename
      foo
    }
    entity {
      __typename
      id
      foo
    }
    entityList {
      __typename
      id
      foo
    }

    # TODO:
    plainObjectUnion {
      __typename
    }
    plainObjectUnionList {
      __typename
    }

    plainObjectInterface {
      __typename
    }
    plainObjectInterfaceList {
      __typename
    }
  }
`;

// Data factories that represents parts of completeObjectFragment
export const entityFoo = (overrides?: any) => ({
  __typename: "EntityFoo",
  id: "1",
  foo: "foo",
  ...overrides,
});

export const pageInfo = (overrides?: any) => ({
  __typename: "PageInfo",
  hasNextPage: false,
  ...overrides,
});

export const entityFooConnection = (overrides?: any) => ({
  __typename: "EntityFooConnection",
  edges: [entityFooEdge()],
  pageInfo: pageInfo(),
  ...overrides,
});

export const entityFooEdge = (overrides?: any) => ({
  __typename: "EntityFooEdge",
  cursor: "foo-edge-1",
  node: entityFoo(),
  since: 123456789,
  ...overrides,
});

export const entityBar = (overrides?: any) => ({
  __typename: "EntityBar",
  id: "1",
  string: "string",
  ...overrides,
});

export const plainObjectFoo = (overrides?: any) => ({
  __typename: "PlainObjectFoo",
  foo: "foo",
  ...overrides,
});

export const plainObjectBar = (overrides?: any) => ({
  __typename: "PlainObjectBar",
  bar: "bar",
  ...overrides,
});

// Fields of this object fully match CompleteObjectFragment.
//   when adding new fields here, they must be also added to the fragment
export const completeObject = (overrides?: any) => ({
  __typename: "CompleteObject",
  scalar: "value",
  scalarList: [null, "foo", null, "bar", null],

  plainObject: plainObjectFoo(),
  plainObjectList: [
    null,
    plainObjectFoo(),
    null,
    plainObjectFoo({ foo: "foo2" }),
    null,
  ],

  plainObjectUnion: plainObjectFoo({ entityUnion: null }), // alternatively can be plainObjectBar
  plainObjectUnionList: [
    null,
    plainObjectFoo({ entityUnion: null }),
    null,
    plainObjectBar({ entityUnion: null }),
    null,
  ],

  plainObjectInterface: plainObjectBar(), // alternatively can be plainObjectFoo
  plainObjectInterfaceList: null, // TODO

  entity: entityFoo(),
  entityList: null,
  // entityList: [null, entityFoo(), null, entityFoo({ id: "2" }), null],
  //
  // entityUnion: entityBar(), // alternatively can be entityFoo
  // entityInterface: entityFoo(), // alternatively can be entityBar
  // entityOrPlainObjectUnion: entityFoo(), // alternatively can be plainObjectFoo

  // entityOrPlainObjectInterface: plainObjectBar(), // alternatively can be entityBar

  connection: entityFooConnection(),

  completeObject: null,
  completeObjectList: null,

  entityOrPlainObjectUnionList: [
    null,
    entityFoo(),
    null,
    plainObjectFoo(),
    null,
  ],

  ...overrides,
});

// When used with the CompleteObjectFragment,
// fields listed in the fragment will be considered missing (because they do not exist in this object)
export const objectWithMissingFields = (overrides?: any) => ({
  __typename: "CompleteObject",
  ...overrides,
});
