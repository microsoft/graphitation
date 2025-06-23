import {
  deleteField,
  deleteListItem,
  hasDeletedField,
  markAsPartial,
} from "../delete";
import { generateChunk } from "../../__tests__/helpers/values";
import { getFieldInfo } from "../../__tests__/helpers/descriptor";
import { createParentLocator } from "../traverse";
import {
  leafDeletedValue,
  resolveFieldChunk,
  resolveFieldValue,
  resolveListItemChunk,
} from "../resolve";
import { FieldInfo } from "../../descriptor/types";
import { CompositeListChunk, ObjectChunk } from "../types";
import { isDeletedValue } from "../predicates";
import { assert } from "../../jsutils/assert";

describe(deleteField, () => {
  it("deletes an existing field", () => {
    const query = `{
      user {
        id
        name
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const userField = getFieldInfo(root.selection, ["user"]);

    const user = resolveFieldChunk(root, userField) as ObjectChunk;
    const nameField = getFieldInfo(user.selection, ["name"]);

    const result = deleteField(env, user, nameField);
    const fieldValue = resolveFieldChunk(user, nameField);

    expect(result).toBe(true);
    expect(user.missingFields?.has(nameField)).toBe(true);
    expect(hasDeletedField(user)).toBe(true);
    expect(fieldValue).toBe(leafDeletedValue);
    expect(root.partialFields?.has(userField)).toBe(true);
  });

  it("fails to delete a non-existent field", () => {
    const query = `{
      user {
        id
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };

    const user = resolveFieldValue(root, "user") as ObjectChunk;
    const fakeFieldInfo: FieldInfo = {
      name: "name",
      dataKey: "name",
      __refs: [],
      watchBoundaries: [],
    };

    const result = deleteField(env, user, fakeFieldInfo);

    expect(result).toBe(false);
    expect(user.missingFields).toBeNull();
    expect(hasDeletedField(user)).toBe(false);
    expect(root.partialFields).toBeNull();
  });

  it("does not delete an already deleted field", () => {
    const query = `{
      user {
        id
        name
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const userField = getFieldInfo(root.selection, ["user"]);

    const user = resolveFieldChunk(root, userField) as ObjectChunk;
    const nameField = getFieldInfo(user.selection, ["name"]);

    const firstDelete = deleteField(env, user, nameField);
    const secondDelete = deleteField(env, user, nameField);

    expect(firstDelete).toBe(true);
    expect(secondDelete).toBe(false);
    expect(user.missingFields?.has(nameField as FieldInfo)).toBe(true);
    expect(hasDeletedField(user)).toBe(true);
    expect(root.partialFields?.has(userField)).toBe(true);
  });

  it("deletes multiple fields", () => {
    const query = `{
      user {
        id
        name
        email
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const userField = getFieldInfo(root.selection, ["user"]);

    const user = resolveFieldChunk(root, userField) as ObjectChunk;
    const nameField = getFieldInfo(user.selection, ["name"]);
    const emailField = getFieldInfo(user.selection, ["email"]);

    const resultName = deleteField(env, user, nameField);
    const resultEmail = deleteField(env, user, emailField);
    const name = resolveFieldChunk(user, nameField);
    const email = resolveFieldChunk(user, emailField);

    expect(resultName).toBe(true);
    expect(resultEmail).toBe(true);
    expect(user.missingFields?.has(nameField)).toBe(true);
    expect(user.missingFields?.has(emailField)).toBe(true);
    expect(name).toBe(leafDeletedValue);
    expect(email).toBe(leafDeletedValue);
    expect(hasDeletedField(user)).toBe(true);
    expect(root.partialFields?.has(userField)).toBe(true);
  });

  it("deletes a field with a selection", () => {
    const query = `{
      user {
        id
        profile {
          bio
          avatar
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const userField = getFieldInfo(root.selection, ["user"]);

    const user = resolveFieldChunk(root, userField) as ObjectChunk;
    const profileField = getFieldInfo(user.selection, ["profile"]);

    const result = deleteField(env, user, profileField);
    const profile = resolveFieldChunk(user, profileField);

    expect(result).toBe(true);
    expect(user.missingFields?.has(profileField as FieldInfo)).toBe(true);
    expect(hasDeletedField(user)).toBe(true);
    expect(root.partialFields?.has(userField)).toBe(true);
    assert(isDeletedValue(profile));
  });

  it("deletes a field in a nested structure", () => {
    const query = `{
      user {
        id
        profile {
          bio
          avatar
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const userField = getFieldInfo(root.selection, ["user"]);

    const user = resolveFieldChunk(root, userField) as ObjectChunk;
    const profileField = getFieldInfo(user.selection, ["profile"]);
    const profile = resolveFieldChunk(user, profileField) as ObjectChunk;
    const bioFieldInfo = getFieldInfo(profile.selection, ["bio"]);

    const result = deleteField(env, profile, bioFieldInfo);

    expect(result).toBe(true);
    expect(profile.missingFields?.has(bioFieldInfo as FieldInfo)).toBe(true);
    expect(hasDeletedField(profile)).toBe(true);
    expect(hasDeletedField(user)).toBe(false); // Only profileChunk has deleted fields
    expect(user.partialFields?.has(profileField)).toBe(true);
    expect(root.partialFields?.has(userField)).toBe(true);
  });
});

describe(deleteListItem, () => {
  it("deletes an existing list item", () => {
    const query = `{
      items @mock(count: 3) {
        id
        value
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const itemsField = getFieldInfo(root.selection, ["items"]);

    const items = resolveFieldChunk(root, itemsField) as CompositeListChunk;

    const result = deleteListItem(env, items, 1);
    const itemValue = resolveListItemChunk(items, 1);

    expect(result).toBe(true);
    expect(items.missingItems?.has(1)).toBe(true);
    expect(isDeletedValue(itemValue)).toBe(true);
    expect(root.partialFields?.has(itemsField)).toBe(true);
  });

  it("fails to delete a non-existent list item", () => {
    const query = `{
      items @mock(count: 2) {
        id
        value
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const itemsField = getFieldInfo(root.selection, ["items"]);

    const items = resolveFieldChunk(root, itemsField) as CompositeListChunk;

    const result = deleteListItem(env, items, 5);

    expect(result).toBe(false);
    expect(items.missingItems).toBeNull();
    expect(root.partialFields).toBeNull();
  });

  it("does not delete an already deleted list item", () => {
    const query = `{
      items @mock(count: 2) {
        id
        value
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const itemsField = getFieldInfo(root.selection, ["items"]);

    const items = resolveFieldChunk(root, itemsField) as CompositeListChunk;

    const firstDelete = deleteListItem(env, items, 0);
    const secondDelete = deleteListItem(env, items, 0);

    expect(firstDelete).toBe(true);
    expect(secondDelete).toBe(false);
    expect(items.missingItems?.has(0)).toBe(true);
    expect(root.partialFields?.has(itemsField)).toBe(true);
  });

  it("deletes multiple list items", () => {
    const query = `{
      items @mock(count: 3) {
        id
        value
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const itemsField = getFieldInfo(root.selection, ["items"]);

    const items = resolveFieldChunk(root, itemsField) as CompositeListChunk;

    const result1 = deleteListItem(env, items, 0);
    const result2 = deleteListItem(env, items, 2);
    const item0Value = resolveListItemChunk(items, 0);
    const item2Value = resolveListItemChunk(items, 2);

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(items.missingItems?.has(0)).toBe(true);
    expect(items.missingItems?.has(2)).toBe(true);
    expect(isDeletedValue(item0Value)).toBe(true);
    expect(isDeletedValue(item2Value)).toBe(true);
    expect(root.partialFields?.has(itemsField)).toBe(true);
  });

  it("deletes a list item in a nested structure", () => {
    const query = `{
      user {
        id
        posts @mock(count: 2) {
          id
          title
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const userField = getFieldInfo(root.selection, ["user"]);

    const user = resolveFieldChunk(root, userField) as ObjectChunk;
    const postsField = getFieldInfo(user.selection, ["posts"]);

    const posts = resolveFieldChunk(user, postsField) as CompositeListChunk;

    const result = deleteListItem(env, posts, 1);
    const postValue = resolveListItemChunk(posts, 1);

    expect(result).toBe(true);
    expect(posts.missingItems?.has(1)).toBe(true);
    expect(isDeletedValue(postValue)).toBe(true);
    expect(user.partialFields?.has(postsField)).toBe(true);
    expect(root.partialFields?.has(userField)).toBe(true);
  });
});

describe(markAsPartial, () => {
  it("marks a field as partial", () => {
    const query = `{
      user {
        id
        name
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const userField = getFieldInfo(root.selection, ["user"]);

    const user = resolveFieldChunk(root, userField) as ObjectChunk;

    const userRef = env.findParent(user);
    markAsPartial(env, userRef);

    expect(root.partialFields?.size).toBe(1);
    expect(root.partialFields?.has(userField)).toBe(true);
  });

  it("marks a list item as partial", () => {
    const query = `{
      items @mock(count: 2) {
        foo
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };
    const itemsField = getFieldInfo(root.selection, ["items"]);

    const items = resolveFieldChunk(root, itemsField) as CompositeListChunk;
    const item = resolveListItemChunk(items, 0) as ObjectChunk;

    const itemRef = env.findParent(item);
    markAsPartial(env, itemRef);

    expect(items.partialItems?.has(0)).toBe(true);
    expect(root.partialFields?.has(itemsField)).toBe(true);
  });

  it("does nothing when called with null or root reference", () => {
    const query = `{
      user {
        id
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);

    const env = { findParent: createParentLocator(dataMap) };
    const rootRef = env.findParent(root);

    markAsPartial(env, null);
    markAsPartial(env, rootRef);

    // No exception thrown, and no changes made
    expect(root.partialFields).toBeNull();
  });
});
