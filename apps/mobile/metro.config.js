// Metro config for the monorepo — lets the Expo app resolve modules from the
// workspace root (shared packages/*, hoisted deps) as well as its own
// node_modules. https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the app AND the monorepo root so changes in packages/* trigger reloads,
// while keeping Metro's own defaults.
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), projectRoot, monorepoRoot]),
);

// Resolve modules from the app first (its own React Native / React), then fall
// back to the hoisted root node_modules for shared workspace packages.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// The web app pins React 18 at the monorepo root; this app needs React 19 for
// Expo 54. A hoisted package that only exists at the root (e.g.
// @react-navigation/core) resolves `require("react")` relative to its own
// location, landing on the root's React 18 copy instead of this app's React
// 19 copy — two React instances end up in the same bundle, crashing with
// "Cannot read properties of undefined (reading 'ReactCurrentDispatcher')".
// extraNodeModules is only a fallback for modules resolution can't otherwise
// find, so it doesn't prevent that; resolveRequest forces every requester,
// regardless of where it lives, onto this app's single copy.
const forcedSingleCopy = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react/jsx-runtime": path.resolve(projectRoot, "node_modules/react/jsx-runtime.js"),
  "react/jsx-dev-runtime": path.resolve(projectRoot, "node_modules/react/jsx-dev-runtime.js"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (Object.prototype.hasOwnProperty.call(forcedSingleCopy, moduleName)) {
    return { type: "sourceFile", filePath: forcedSingleCopy[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
