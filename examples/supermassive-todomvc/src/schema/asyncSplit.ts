import { ApolloLink, Observable } from "@apollo/client";

export function asyncSplit(
  test: () => Promise<boolean> | boolean,
  left: () => Promise<ApolloLink>,
  right: () => Promise<ApolloLink>
): ApolloLink {
  let link: ApolloLink;
  return new ApolloLink((operation, forward) => {
    if (link) {
      return link.request(operation, forward);
    } else {
      return new Observable((observer) => {
        (async () => {
          if (await test()) {
            link = await left();
          } else {
            link = await right();
          }
          link.request(operation, forward)?.subscribe(observer);
        })();
      });
    }
  });
}
