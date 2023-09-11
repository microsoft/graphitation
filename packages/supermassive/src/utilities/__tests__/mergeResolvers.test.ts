import { mergeResolvers } from "../mergeResolvers";
import {
  MyInterfaceType,
  MyObjectType,
  foo,
} from "./fixtures/esModuleResolvers";
import { ObjectTypeResolver, UserInterfaceTypeResolver } from "../../types";

describe("mergeResolvers", () => {
  const resolvers1 = {
    Query: {
      user: () => ({ name: "John" }),
    },
    Chat: {
      with: () => ({ name: "John" }),
    },
  };
  const resolvers2 = {
    Query: {
      user: () => ({ age: 30 }),
    },
    Chat: {
      title: () => "Chat",
    },
  };

  it("should merge object resolvers correctly", () => {
    const mergedResolvers = mergeResolvers({}, [
      resolvers1,
      resolvers2,
    ]) as typeof resolvers1 & typeof resolvers2;

    expect(mergedResolvers).toEqual({
      Query: {
        user: expect.any(Function),
      },
      Chat: {
        with: expect.any(Function),
        title: expect.any(Function),
      },
    });

    const user = mergedResolvers.Query.user();
    const chatWith = mergedResolvers.Chat.with();
    const chatTitle = mergedResolvers.Chat.title();
    expect(user).toEqual({
      age: 30,
    });
    expect(chatWith).toEqual({
      name: "John",
    });
    expect(chatTitle).toEqual("Chat");
  });

  it("should return extracted resolvers when resolvers is empty", () => {
    const mergedResolvers = mergeResolvers({}, [{}, resolvers1]);
    expect(mergedResolvers).toEqual(resolvers1);
  });

  it("should return original resolvers when extractedResolvers is empty", () => {
    const mergedResolvers = mergeResolvers({}, [resolvers2, {}]);
    expect(mergedResolvers).toEqual(resolvers2);
  });

  it("should return original resolvers when both inputs are empty", () => {
    const mergedResolvers = mergeResolvers({}, [{}]);
    expect(mergedResolvers).toEqual({});
  });

  it("should support merging of nested resolver arrays", () => {
    const mergedResolvers = mergeResolvers({}, [
      resolvers1,
      [resolvers2],
    ]) as typeof resolvers1;
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

  it("merges abstract type resolvers, defined as ES module exports", () => {
    const resolvers = { MyInterfaceType };
    const mergedResolvers = mergeResolvers({}, [resolvers]);
    const mergedResolvers2 = mergeResolvers({ ...resolvers }, [resolvers]);

    expect(
      (mergedResolvers.MyInterfaceType as UserInterfaceTypeResolver)
        .__resolveType,
    ).toBe(MyInterfaceType.__resolveType);
    expect(
      (mergedResolvers2.MyInterfaceType as UserInterfaceTypeResolver)
        .__resolveType,
    ).toBe(MyInterfaceType.__resolveType);
  });

  it("merges field resolvers, defined as ES module exports", () => {
    const resolvers = { MyObjectType };
    const mergedResolvers = mergeResolvers({}, [resolvers]);
    const mergedResolvers2 = mergeResolvers({ MyObjectType: {} }, [resolvers]);
    const mergedResolvers3 = mergeResolvers(
      { MyObjectType: { foo: () => null } },
      [resolvers],
    );

    expect((mergedResolvers.MyObjectType as ObjectTypeResolver).foo).toBe(foo);
    expect((mergedResolvers2.MyObjectType as ObjectTypeResolver).foo).toBe(foo);
    expect((mergedResolvers3.MyObjectType as ObjectTypeResolver).foo).toBe(foo);
  });
});
