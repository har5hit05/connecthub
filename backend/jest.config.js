module.exports = {
  testEnvironment: 'node',
  verbose: true,
  silent: false,
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'services/**/*.js',
    'controllers/**/*.js',
    'middleware/**/*.js'
  ],
  coverageDirectory: 'coverage'
};
