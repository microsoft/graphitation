function graphql(..._args: any[]) {
  return "this is not the function you are looking for";
}

describe("a jest test", () => {
  it("succeeds", () => {
    expect(
      graphql`
        fragment SomeComponent_query on Query {
          helloWorld
        }
      `,
    ).toEqual("hello world");
  });

  it("fails", () => {
    expect(
      graphql`
        fragment SomeComponent_query on Query {
          helloWorld
        }
      `,
    ).toEqual("bye world");
  });
});
