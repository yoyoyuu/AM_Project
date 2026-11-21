// Minimal react-native stub for node test environment.
// jest-expo/node maps `react-native` → react-native-web which isn't installed.
// This stub covers the subset used by production code under test.
const Alert = { alert: () => {} };
const Linking = { openSettings: () => Promise.resolve() };
module.exports = { Alert, Linking };
