/**
 * Metro in an npm workspace: the app lives in freementor/app but its
 * dependencies are hoisted to freementor/node_modules, and @freementor/shared
 * is a sibling package of TypeScript source. Metro has to be told to watch
 * the repo root and to resolve from both module directories.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// One copy of React, or hooks break at runtime with a confusing error.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
