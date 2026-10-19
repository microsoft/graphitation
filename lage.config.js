module.exports = {
  pipeline: {
    types: ["^types"],
    build: [],
    test: ["build"],
    lint: [],
  },
  npmClient: "yarn",
  repoWideChanges: [
    "package.json",
    "yarn.lock",
    "lage.config.js",
    "tsconfig.json",
    ".eslintrc.json",
    ".prettierrc",
    ".yarnrc.yml",
    ".yarn/**",
    ".config/**",
    "patches/**",
    "scripts/**",
    ".github/workflows/pr.yml",
    ".azure-devops/**",
  ],
};
