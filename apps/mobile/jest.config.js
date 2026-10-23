/** Component and flow tests (React Native Testing Library) against the in-memory demo API. */
module.exports = {
  preset: 'jest-expo',
  // Worklets' resolver skips its .native files, which need the native runtime.
  resolver: require('path').join(require('path').dirname(require.resolve('react-native-worklets/package.json')), 'jest/resolver.js'),
  setupFiles: ['./test/setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@gorhom/.*|@xrp/.*|@react-native/.*|@react-native\\+.*|react-native\\+.*|expo.*|@expo.*))',
  ],
  testMatch: ['<rootDir>/test/**/*.test.ts?(x)'],
};
