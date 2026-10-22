module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // NOTE (Expo SDK 54 / Reanimated 4): `babel-preset-expo` automatically adds
    // `react-native-worklets/plugin` when `react-native-worklets` is installed.
    // Do NOT add `react-native-reanimated/plugin` manually here — it would be
    // applied twice and break worklet transforms.
  };
};
