import { join, dirname } from "path";
import fs, { StatOptions } from "fs";

export function checkDirForPkg(dir: string): string | null {
  const pathname = join(dir, "package.json");
  let stat;

  try {
    stat = fs.statSync(pathname, { throwIfNoEntry: false } as StatOptions);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }

  if (stat && stat.isFile()) {
    return pathname;
  }

  const parentDir = dirname(dir);
  if (parentDir === dir) {
    // dir is root
    return null;
  }
  return checkDirForPkg(parentDir);
}
