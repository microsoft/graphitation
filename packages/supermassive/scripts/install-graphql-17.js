/* eslint-disable */
// Supermassive V3 requires graphql17 for defer/stream tests, and graphql15 for other tests
// By default graphql15 is installed, this scripts installs graphql17 for local testing of defer/stream
const fs = require("fs").promises;
const path = require("path");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

async function main() {
  if (isInstalled()) return;

  const packageJsonPath = path.join(__dirname, "..", "package.json");
  const packageJsonData = await fs.readFile(packageJsonPath, "utf-8");

  const { stderr } = await exec(
    `yarn add graphql@17.0.0-alpha.7 --exact --dev --no-lockfile`,
  );
  console.log(stderr);

  // Yarn modifies package.json, and we don't want that
  // Workaround for missing yarn feature: https://github.com/yarnpkg/yarn/issues/1743
  await fs.writeFile(packageJsonPath, packageJsonData, "utf-8");
}

function isInstalled() {
  const packageJsonPath = path.join(
    __dirname,
    "..",
    "node_modules",
    "graphql",
    "package.json",
  );
  try {
    const packageJsonData = require(packageJsonPath);
    return packageJsonData.version.startsWith("17.");
  } catch (e) {
    return false;
  }
}

main().catch(console.error);
