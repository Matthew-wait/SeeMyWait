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

module.exports = config;
