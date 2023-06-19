module.exports = {
  pipeline: {
    types: ["^types"],
    build: ["^build"],
    test: ["build"],
    lint: [],
  },
  npmClient: "yarn",
};
