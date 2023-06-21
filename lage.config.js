module.exports = {
  pipeline: {
    types: ["^types"],
    build: [],
    test: ["build"],
    lint: [],
  },
  npmClient: "yarn",
};
