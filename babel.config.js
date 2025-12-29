module.exports = function (api) {
  // Keep the cache for faster rebuilds.
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
