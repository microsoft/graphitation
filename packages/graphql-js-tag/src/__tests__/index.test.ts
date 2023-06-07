import { graphql } from "..";
import { parse, print } from "graphql";

describe(graphql, () => {
  const SomeFragment = graphql`
    fragment SomeFragment on SomeType {
      id
    }
  `;

  const SomeOtherFragment = graphql`
    fragment SomeOtherFragment on SomeType {
      ...SomeFragment
    }
    ${SomeFragment}
  `;

  it("returns the document in graphql-js AST form", () => {
    const expected = parse(`
      fragment SomeFragment on SomeType {
        id
      }
    `);
    expect(print(SomeFragment)).toEqual(print(expected));
  });

  it("appends fragments", () => {
    const expected = parse(`
      fragment SomeOtherFragment on SomeType {
        ...SomeFragment
      }
      fragment SomeFragment on SomeType {
        id
      }
    `);
    expect(print(SomeOtherFragment)).toEqual(print(expected));
  });

  it("de-dupes fragments", () => {
    const expected = parse(`
      fragment NoopFragment on IgnoredType {
        __typename
      }
      fragment SomeOtherFragment on SomeType {
        ...SomeFragment
      }
      fragment SomeFragment on SomeType {
        id
      }
    `);
    const actual = graphql`
      fragment NoopFragment on IgnoredType {
        __typename
      }
      ${SomeOtherFragment}
      ${SomeFragment /* This fragment is also contained in SomeOtherFragment */}
    `;
    expect(print(actual)).toEqual(print(expected));
  });

  it("re-uses definition objects to avoid increased memory usage", () => {
    const actual = SomeOtherFragment.definitions[1];
    const expected = SomeFragment.definitions[0];
    expect(actual).toBe(expected);
  });
});
