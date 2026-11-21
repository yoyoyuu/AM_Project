module.exports = {
  preset: 'jest-expo/node',
  moduleNameMapper: {
    // react-native-web is not installed; redirect Linking lookups to a stub
    '^react-native-web/dist/exports/Linking$': '<rootDir>/src/__mocks__/react-native-stub.js',
    '^react-native$': '<rootDir>/src/__mocks__/react-native-stub.js',
  },
};
