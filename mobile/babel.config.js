module.exports = function (api) {
  api.cache(true);
  return {
    // Le greffon react-native-reanimated a disparu : la bibliothèque n'était
    // importée nulle part, et sa version 4 aurait imposé une migration
    // (react-native-worklets) pour une dépendance inutilisée.
    presets: ['babel-preset-expo'],
  };
};
