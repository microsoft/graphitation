import { join, dirname, resolve, basename, parse } from "path";
import fs from "fs";
import camelCase from "lodash.camelcase";

function checkDirForPkg(dir: string): string | null {
  const pathname = join(dir, "package.json");
  let stat;

  try {
    stat = fs.statSync(pathname);
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

export function getFileInfo(filepath: string) {
  const packageJsonPath = checkDirForPkg(
    resolve(process.cwd(), dirname(filepath)),
  );

  if (!packageJsonPath) {
    return;
  }

  return {
    name: parse(basename(filepath)).name,
    directory: basename(dirname(packageJsonPath)),
  };
}

export function pascalCase(text: string) {
  const camelCaseText = camelCase(text);
  return camelCaseText.charAt(0).toUpperCase() + camelCaseText.slice(1);
}
