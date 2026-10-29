/** Component and flow tests (React Native Testing Library) against the in-memory demo API. */
module.exports = {
  preset: 'jest-expo',
  // Reanimated 4's resolver picks its Jest-safe implementations (and Worklets').
  resolver: require.resolve('react-native-reanimated/jest/resolver'),
  setupFiles: ['./test/setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@gorhom/.*|@xrp/.*|@noble/.*|@scure/.*|ripple-.*|@xrplf/.*|@react-native/.*|@react-native\\+.*|react-native\\+.*|expo.*|@expo.*))',
  ],
  testMatch: ['<rootDir>/test/**/*.test.ts?(x)'],
};
