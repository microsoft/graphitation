import { view } from "../../../../src/index";
import { ids } from "../../shared";

export type ProfileData = {
  readonly name: string;
  readonly initials: string;
  /** A CSS colour, by the name's hash. */
  readonly color: string;
};

/** A profile from the name alone: the main thread derives its own optimistic ones too. */
export function profileOf(name: string): ProfileData {
  let hash = 0;
  for (let index = 0; index < name.length; index++)
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  const initials = name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0]!.toUpperCase())
    .join("")
    .slice(0, 2);
  return { name, initials, color: `hsl(${hash % 360} 60% 45%)` };
}

/** Derived from the name alone; a real profile would read a store of its own. */
export const profile = view({
  id: ids.profile,
  name: "profile",
  resolve: (name: string): ProfileData => profileOf(name),
});
