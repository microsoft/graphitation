import { parse, Kind } from "graphql";
import { print } from "../print";

describe("Printer: Query document", () => {
  it("prints minimal ast", () => {
    const ast = {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: "foo" },
    } as const;
    expect(print(ast)).toBe("foo");
  });

  it("produces helpful error messages", () => {
    const badAST = { random: "Data" };

    // @ts-expect-error tests printing invalid nodes
    expect(() => print(badAST)).toThrow(
      'Invalid AST Node: { random: "Data" }.',
    );
  });

  it("correctly prints operations without name", () => {
    const queryASTShorthanded = parse("query { id, name }");
    expect(print(queryASTShorthanded)).toBe("{id,name}");

    const mutationAST = parse("mutation { id, name }");
    expect(print(mutationAST)).toBe("mutation {id,name}");

    const queryASTWithArtifacts = parse(
      "query ($foo:TestType) @testDirective { id, name }",
    );
    expect(print(queryASTWithArtifacts)).toBe(
      "query ($foo:TestType) @testDirective {id,name}",
    );

    const mutationASTWithArtifacts = parse(
      "mutation ($foo: TestType) @testDirective { id, name }",
    );
    expect(print(mutationASTWithArtifacts)).toBe(
      "mutation ($foo:TestType) @testDirective {id,name}",
    );
  });

  it("prints query with variable directives", () => {
    const queryASTWithVariableDirective = parse(
      "query ($foo: TestType = {a: 123} @testDirective(if: true) @test) { id }",
    );
    expect(print(queryASTWithVariableDirective)).toBe(
      "query ($foo:TestType={a:123} @testDirective(if:true) @test) {id}",
    );
  });

  it("keeps arguments on one line", () => {
    const printed = print(
      parse("{ trip(wheelchair:false arriveBy:false) { dateTime } }"),
    );

    expect(printed).toBe("{trip(wheelchair:false,arriveBy:false) {dateTime}}");
  });

  it("prints kitchen sink without altering ast", () => {
    const ast = parse(kitchenSinkQuery, { noLocation: true });

    const astBeforePrintCall = JSON.stringify(ast);
    const printed = print(ast);
    const printedAST = parse(printed, { noLocation: true });

    expect(printedAST).toStrictEqual(ast);
    expect(JSON.stringify(ast)).toBe(astBeforePrintCall);

    expect(printed).toBe(
      `query queryName($foo:ComplexType,$site:Site=MOBILE) @onQuery {whoever123is:node(id:[123,456]) {id,... on User @onInlineFragment {field2 {id,alias:field1(first:10,after:$foo) @include(if:$foo) {id,...frag @onFragmentSpread}}},... @skip(unless:$foo) {id},... {id}}} mutation likeStory @onMutation {like(story:123) @onField {story {id @onField}}} subscription StoryLikeSubscription($input:StoryLikeSubscribeInput @onVariableDefinition) @onSubscription {storyLikeSubscribe(input:$input) {story {likers {count},likeSentence {text}}}} fragment frag on Friend @onFragmentDefinition {foo(size:$size,bar:$b,obj:{key:"value",block:"""
block string uses \\"""
"""})} {unnamed(truthy:true,falsy:false,nullish:null),query} {__typename}`,
    );
  });
});

const kitchenSinkQuery: string = String.raw`
query queryName($foo: ComplexType, $site: Site = MOBILE) @onQuery {
  whoever123is: node(id: [123, 456]) {
    id
    ... on User @onInlineFragment {
      field2 {
        id
        alias: field1(first: 10, after: $foo) @include(if: $foo) {
          id
          ...frag @onFragmentSpread
        }
      }
    }
    ... @skip(unless: $foo) {
      id
    }
    ... {
      id
    }
  }
}

mutation likeStory @onMutation {
  like(story: 123) @onField {
    story {
      id @onField
    }
  }
}

subscription StoryLikeSubscription(
  $input: StoryLikeSubscribeInput @onVariableDefinition
)
  @onSubscription {
  storyLikeSubscribe(input: $input) {
    story {
      likers {
        count
      }
      likeSentence {
        text
      }
    }
  }
}

fragment frag on Friend @onFragmentDefinition {
  foo(
    size: $size
    bar: $b
    obj: {
      key: "value"
      block: """
      block string uses \"""
      """
    }
  )
}

{
  unnamed(truthy: true, falsy: false, nullish: null)
  query
}

query {
  __typename
}
`;
