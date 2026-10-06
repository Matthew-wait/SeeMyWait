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
// Any import of react/react-dom/scheduler, including subpaths like
// react-dom/client, gets resolved as if the requesting file lived inside
// this app's own node_modules — so Metro's normal directory walk finds this
// app's copy first, no matter which package (root-hoisted or not) asked.
const forcedPackages = ["react", "react-dom", "scheduler"];
const forceOrigin = path.join(projectRoot, "node_modules", ".force-react-resolution", "x.js");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isForced =
    forcedPackages.includes(moduleName) ||
    forcedPackages.some((pkg) => moduleName.startsWith(`${pkg}/`));
  if (isForced) {
    return context.resolveRequest({ ...context, originModulePath: forceOrigin }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
