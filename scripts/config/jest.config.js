module.exports = {
  preset: "ts-jest",
  rootDir: process.cwd(),
  roots: ["<rootDir>/src"],
  testPathIgnorePatterns: [
    "node_modules",
    "__generated__",
    "__tests__/utils",
    "__tests__/fixtures",
  ],
};
