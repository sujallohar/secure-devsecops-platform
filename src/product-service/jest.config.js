export default {
  transform: {},
  coverageThreshold: {
    global: {
      lines: 70,
    },
  },
  collectCoverageFrom: ['src/**/*.js', '!src/index.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  testEnvironment: 'node',
};
