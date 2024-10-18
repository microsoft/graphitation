/* eslint-disable */
const path = require("path");
const spawn = require("child_process").spawn;

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const COMPAT_PATH = path.join(__dirname, "..", "compat");

async function main() {
  process.chdir(COMPAT_PATH);
  await runCommand(npmCommand, [`i`]);
  await runCommand(npmCommand, ["run", "test:ci"]);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
      shell: true,
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(code);
      } else {
        resolve(0);
      }
    });
  });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((code) => {
    process.exit(code);
  });
