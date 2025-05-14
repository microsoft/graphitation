module.exports = {
  preset: "ts-jest",
  rootDir: process.cwd(),
  testPathIgnorePatterns: [
    "node_modules",
    "__generated__",
    "__tests__/utils",
    "__tests__/helpers",
    "__tests__/fixtures",
    "graphql17.test.ts$",
  ],
  transform: {
    "node_modules[\\\\/]+quick-lru": [
      "babel-jest",
      { plugins: ["@babel/plugin-transform-modules-commonjs"] },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(quick-lru))", ".pnp.[^\\]+$]"],
};
