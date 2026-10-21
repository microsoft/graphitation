import type {
  AccessConfig,
  Action,
  ActionId,
  AnyView,
  RefError,
  View,
  ViewError,
  ViewId,
  ViewInstanceId,
} from "../api.core";
import type { Codec } from "../api.codec";
import { findRefsBySearch } from "./findRefs";

/**
 * A reference codec for project conventions, not exported or used by Refresher. It shows
 * what a project can do in its own codec: every view declares an `id`, and the project's
 * view factory puts how to key its arguments on the definition. The codec names a view
 * by its `id`, keys arguments with the definition's `argsKey`, keys an instance as
 * `<id length>:<id><args key>`, and fails with a view
 * error when either is missing or another view goes by the same id. Actions follow the
 * same convention, put on them by the project's action factory, and fail with a ref error.
 * Illustrative only: it checks nothing else.
 */

/** What the project's view factory adds to every definition. */
export type ProjectViewExtensions<Args = unknown> = {
  argsKey(args: Args): string;
};

export type ProjectView = AnyView & ProjectViewExtensions;

/** What the project's action factory adds to every action. */
export type ProjectActionExtensions = {
  readonly id: string;
  argsKey(args: unknown): string;
};

export function createConventionCodec(): Codec {
  const owners = new Map<ViewId, AnyView>();
  const actionOwners = new Map<ActionId, Action>();
  function viewKey(view: AnyView): ViewId {
    const id = view.id;
    if (id === undefined) {
      throw viewError("MISSING_VIEW_ID", "The view declares no id", view);
    }
    const owner = owners.get(id);
    if (owner === undefined) owners.set(id, view);
    else if (owner !== view) {
      throw viewError(
        "DUPLICATE_VIEW",
        `Another view already goes by "${id}"`,
        view,
      );
    }
    return id;
  }
  function argsKey<Args>(
    view: View<Args, unknown, AccessConfig> &
      Partial<ProjectViewExtensions<Args>>,
    args: Args,
  ): string {
    if (typeof view.argsKey !== "function") {
      throw viewError(
        "MISSING_ARGS_KEY",
        "The view has no argsKey function",
        view,
      );
    }
    return view.argsKey(args);
  }
  return {
    viewKey,
    argsKey,
    instanceKey<Args>(
      view: View<Args, unknown, AccessConfig>,
      args: Args,
    ): ViewInstanceId {
      const id = viewKey(view);
      return `${id.length}:${id}${argsKey(view, args)}`;
    },
    captureArgs: <Args>(_view: unknown, args: Args): Args => args,
    captureResult: <Result>(_view: unknown, value: Result): Result => value,
    actionKey(action: Action & Partial<ProjectActionExtensions>): ActionId {
      const id = action.id;
      if (id === undefined)
        throw refError("MISSING_ACTION_ID", "The action declares no id");
      const owner = actionOwners.get(id);
      if (owner === undefined) actionOwners.set(id, action);
      else if (owner !== action) {
        throw refError(
          "DUPLICATE_ACTION",
          `Another action already goes by "${id}"`,
        );
      }
      return id;
    },
    captureActionArgs: <Args>(_action: unknown, args: Args): Args => args,
    actionArgsKey(
      action: Action & Partial<ProjectActionExtensions>,
      args: unknown,
    ): string {
      if (typeof action.argsKey !== "function") {
        throw refError(
          "MISSING_ARGS_KEY",
          "The action has no argsKey function",
        );
      }
      return action.argsKey(args);
    },
    findRefs: findRefsBySearch,
  };
}

function refError(code: string, message: string): Error {
  const failure: RefError = { kind: "ref", message, code };
  return Object.assign(new Error(message), failure);
}

function viewError(code: string, message: string, view: AnyView): Error {
  const failure: ViewError = {
    kind: "view",
    message,
    code,
    ...(view.id === undefined ? undefined : { view: view.id }),
    ...(view.name === undefined ? undefined : { viewName: view.name }),
  };
  return Object.assign(new Error(message), failure);
}
