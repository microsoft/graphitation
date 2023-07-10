function graphql(..._args: any[]) {
  return "this is not the function you are looking for";
}

describe("a jest test", () => {
  it("works", () => {
    expect(
      graphql`
        fragment SomeComponent_query on Query {
          helloWorld
        }
      `,
    ).toEqual("hello world");
  });
});
