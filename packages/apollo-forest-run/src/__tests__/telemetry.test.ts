import { gql } from "../__tests__/helpers/descriptor";
import { ForestRun } from "../ForestRun";
test("finds candidates for useFragments: nested object with partial updates", () => {
  const query = gql`
    query MyQuery {
      user {
        id
        name
        profile {
          id
          bio
          avatar
        }
        settings {
          id
          theme
          notifications {
            id
            email
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
      profile: {
        __typename: "Profile",
        id: "AliceProfile",
        bio: "Init",
        avatar: "init.png",
      },
      settings: {
        __typename: "Settings",
        id: "AliceSettings",
        theme: "light",
        notifications: {
          __typename: "NotificationSettings",
          id: "AliceNotifications",
          email: "1@domain.com",
        },
      },
    },
  };

  const updateProfileMutation = gql`
    mutation {
      updateProfile {
        id
        bio
        avatar
      }
    }
  `;

  const updatedProfileData = {
    updateProfile: {
      ...initialData.user.profile,
      bio: "Updated bio",
      avatar: "avatar2.png",
    },
  };

  const updateNotificationMutation = gql`
    mutation UpdateNotificationMutation {
      updateNotifications {
        id
        email
      }
    }
  `;

  const updateUserMutation = gql`
    mutation {
      updateUser {
        id
        name
        profile {
          id
          bio
          avatar
        }
        settings {
          id
          theme
          notifications {
            id
            email
          }
        }
      }
    }
  `;
  const updateUserData = {
    updateUser: {
      ...initialData.user,
      name: "Bob",
      profile: {
        ...initialData.user.profile,
        bio: "Mutatation bio",
        avatar: "mutation.png",
      },
      settings: {
        ...initialData.user.settings,
        notifications: {
          ...initialData.user.settings.notifications,
          email: "2@domain.com",
        },
      },
    },
  };

  const getNotificationData = (email: string) => ({
    updateNotifications: {
      ...initialData.user.settings.notifications,
      email,
    },
  });

  const telemetryEvents: any[] = [];
  const cache = new ForestRun({
    notify: (event) => telemetryEvents.push(event),
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
  //   cache.write({
  //     query: updateProfileMutation,
  //     result: updatedProfileData,
  //   });

  cache.write({
    query: updateNotificationMutation,
    result: getNotificationData("2@domain.com"),
  });

  //   cache.write({
  //     query: updateNotificationMutation,
  //     result: {
  //       updateNotifications: {
  //         ...initialData.user.settings.notifications,
  //         email: getNotificationData("3@domain.com"),
  //       },
  //     },
  //   });

  //   cache.write({
  //     query: updateUserMutation,
  //     result: updateUserData,
  //   });

  const candidate = telemetryEvents.find(
    (e) => e.kind === "USE_FRAGMENT_CANDIDATE",
  );
  expect(candidate).toBeDefined();
});
