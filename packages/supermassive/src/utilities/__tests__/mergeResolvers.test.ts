import { mergeResolvers } from "../mergeResolvers";

describe("mergeResolvers", () => {
  const resolvers = {
    Query: {
      user: () => ({ name: "John" }),
    },
  };
  const extractedResolvers = {
    Query: {
      user: () => ({ age: 30 }),
    },
  };

  it("should merge resolvers correctly", () => {
    const mergedResolvers = mergeResolvers({}, [
      resolvers,
      extractedResolvers,
    ]) as typeof extractedResolvers;

    expect(mergedResolvers).toEqual({
      Query: {
        user: expect.any(Function),
      },
    });

    const result = mergedResolvers.Query.user();
    expect(result).toEqual({
      age: 30,
    });
  });

  it("should return extracted resolvers when resolvers is empty", () => {
    const mergedResolvers = mergeResolvers({}, [{}, resolvers]);
    expect(mergedResolvers).toEqual(resolvers);
  });

  it("should return original resolvers when extractedResolvers is empty", () => {
    const mergedResolvers = mergeResolvers({}, [extractedResolvers, {}]);
    expect(mergedResolvers).toEqual(extractedResolvers);
  });

  it("should return original resolvers when both inputs are empty", () => {
    const mergedResolvers = mergeResolvers({}, [{}]);
    expect(mergedResolvers).toEqual({});
  });

  it("should support merging of nested resolver arrays", () => {
    const mergedResolvers = mergeResolvers({}, [
      resolvers,
      [extractedResolvers],
    ]) as typeof resolvers;
    const result = mergedResolvers.Query.user();
    expect(result).toEqual({
      age: 30,
    });
  });

  it("should merge enum resolvers expressed in graphql-tools style", () => {
    const mergedResolvers = mergeResolvers({}, [
      {
        MyEnum: { foo: 1, bar: "bar" },
      },
    ]);
    expect(mergedResolvers).toEqual({
      MyEnum: { foo: 1, bar: "bar" },
    });
  });
});
