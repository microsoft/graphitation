import { gql } from "../__tests__/helpers/descriptor";
import { ForestRun } from "../ForestRun";
import { UpdateStats, UnexpectedRefetch } from "../telemetry/types";

describe("Update Stats Telemetry", () => {
  const query = gql`
    query MyQuery {
      user {
        id
        name
        email
        friends {
          id
          name
          profile {
            id
            bio
          }
        }
      }
    }
  `;

  const initialData = {
    user: {
      __typename: "User",
      id: "1",
      name: "Alice",
      email: "alice@example.com",
      friends: [
        {
          __typename: "Friend",
          id: "2",
          name: "Bob",
          profile: {
            __typename: "Profile",
            id: "BobProfile",
            bio: "Default bio for Bob",
          },
        },
        {
          __typename: "Friend",
          id: "3",
          name: "Charlie",
          profile: {
            __typename: "Profile",
            id: "CharlieProfile",
            bio: "Default bio for Charlie",
          },
        },
      ],
    },
  };

  const updateMutation = gql`
    mutation UpdateFriend {
      updateFriend {
        __typename
        ... on User {
          id
          name
          email
        }
        ... on Profile {
          id
          bio
        }
        ... on Friend {
          id
          name
        }
      }
    }
  `;

  const updatedData = {
    updateFriend: [
      {
        __typename: "User",
        id: "1",
        name: "Updated Alice",
        email: "updated@example.com",
      },
      {
        __typename: "Profile",
        id: "BobProfile",
        bio: "Updated bio for Bob",
      },
      {
        __typename: "Friend",
        id: "2",
        name: "Updated Bob",
      },
    ],
  };
  it("should report update stats telemetry", () => {
    const telemetryEvents: UpdateStats[] = [];
    const cache = new ForestRun({
      logUpdateStats: true,
      notify: (event) => {
        if (event.kind === "UPDATE_STATS") {
          telemetryEvents.push(event);
        }
      },
    });

    const diffs: any[] = [];

    cache.watch({
      query,
      optimistic: true,
      callback: (diff) => {
        diffs.push(diff);
      },
    });

    cache.write({ query, result: initialData });
    cache.write({
      query: updateMutation,
      result: updatedData,
    });

    expect(telemetryEvents.length).toEqual(1);
    expect(telemetryEvents).toMatchSnapshot();
  });

  it("should not report update stats telemetry when disabled", () => {
    const telemetryEvents: UpdateStats[] = [];
    const cache = new ForestRun({
      logUpdateStats: false,
      notify: (event) => {
        if (event.kind === "UPDATE_STATS") {
          telemetryEvents.push(event);
        }
      },
    });

    cache.watch({
      query,
      optimistic: true,
      callback: () => {},
    });

    cache.write({ query, result: initialData });
    cache.write({
      query: updateMutation,
      result: updatedData,
    });

    expect(telemetryEvents.length).toEqual(0);
  });
});

describe("Unexpected refetch telemetry", () => {
  const query = gql`
    query GetUserWithDetails {
      user {
        id
        name
        friends {
          id
          name
        }
      }
    }
  `;

  const initialData = {
    user: {
      __typename: "User",
      id: "1",
      name: "Alice",
      friends: [
        {
          __typename: "Friend",
          id: "2",
          name: "Bob",
        },
      ],
    },
  };

  const fragmentWithMissingFields = gql`
    fragment PartialUser on User {
      id
      name
      friends {
        name
      }
    }
  `;

  const fragmentData = {
    __typename: "User",
    friends: [
      {
        __typename: "Friend",
        name: "Updated Bob",
      },
    ],
  };

  it("should report unexpected refetch telemetry", () => {
    const telemetryEvents: UnexpectedRefetch[] = [];

    const cache = new ForestRun({
      notify: (event) => {
        if (event.kind === "UNEXPECTED_REFETCH") {
          telemetryEvents.push(event);
        }
      },
      logStaleOperations: true,
    });

    cache.watch({
      query: query,
      optimistic: true,
      callback: () => {},
    });

    cache.write({
      query: query,
      result: initialData,
    });

    cache.writeFragment({
      id: cache.identify({ __typename: "User", id: "1" })!,
      fragment: fragmentWithMissingFields,
      data: fragmentData,
    });

    expect(telemetryEvents).toMatchSnapshot();
  });

  it("should not report unexpected refetch telemetry when disabled", () => {
    const telemetryEvents: UnexpectedRefetch[] = [];

    const cache = new ForestRun({
      notify: (event) => {
        if (event.kind === "UNEXPECTED_REFETCH") {
          telemetryEvents.push(event);
        }
      },
    });

    cache.watch({
      query: query,
      optimistic: true,
      callback: () => {},
    });

    cache.write({
      query: query,
      result: initialData,
    });

    cache.writeFragment({
      id: cache.identify({ __typename: "User", id: "1" })!,
      fragment: fragmentWithMissingFields,
      data: fragmentData,
    });

    expect(telemetryEvents.length).toEqual(0);
  });
});
