const { compilerOptions } = require("../tsconfig.json");

module.exports = {
  rootDir: '../src',
  transform: {
    '^.+.(t|j)sx?$': 'ts-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(quick-lru))'
  ],
  globals: {
    'ts-jest': {
      diagnostics: {
        exclude: ['**'],
      },
      tsconfig: {
        ...compilerOptions,
        allowJs: true,
      },
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testURL: 'http://localhost',
  setupFiles: ['<rootDir>/config/jest/setup.ts'],
  testEnvironment: 'jsdom',
};
