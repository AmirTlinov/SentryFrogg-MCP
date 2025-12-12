#!/usr/bin/env node

const path = require('path');

function resolveProfileBaseDir() {
  if (process.env.MCP_PROFILES_DIR) {
    return path.resolve(process.env.MCP_PROFILES_DIR);
  }

  const candidate = require.main?.filename || process.argv[1];
  if (candidate) {
    return path.dirname(candidate);
  }

  return process.cwd();
}

function resolveProfileKeyPath() {
  if (process.env.MCP_PROFILE_KEY_PATH) {
    return path.resolve(process.env.MCP_PROFILE_KEY_PATH);
  }

  return path.join(resolveProfileBaseDir(), '.mcp_profiles.key');
}

module.exports = {
  resolveProfileBaseDir,
  resolveProfileKeyPath,
};
