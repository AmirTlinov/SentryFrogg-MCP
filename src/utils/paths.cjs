#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

function resolveHomeDir() {
  try {
    const home = os.homedir();
    return home && typeof home === 'string' ? home : null;
  } catch (error) {
    return null;
  }
}

function resolveXdgStateDir() {
  if (process.env.XDG_STATE_HOME) {
    return path.resolve(process.env.XDG_STATE_HOME);
  }

  const home = resolveHomeDir();
  if (home) {
    return path.join(home, '.local', 'state');
  }

  return null;
}

function hasLegacyStore(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    return false;
  }

  const candidates = [
    '.mcp_profiles.key',
    'profiles.json',
    'state.json',
    'projects.json',
    'runbooks.json',
    'aliases.json',
    'presets.json',
    'audit.jsonl',
    'cache',
  ];

  return candidates.some((name) => fs.existsSync(path.join(dirPath, name)));
}

function resolveProfileBaseDir() {
  if (process.env.MCP_PROFILES_DIR) {
    return path.resolve(process.env.MCP_PROFILES_DIR);
  }

  const entryCandidate = process.argv[1] || require.main?.filename;
  if (entryCandidate) {
    const legacyDir = path.dirname(entryCandidate);
    if (hasLegacyStore(legacyDir)) {
      return legacyDir;
    }
  }

  const xdgStateDir = resolveXdgStateDir();
  if (xdgStateDir) {
    return path.join(xdgStateDir, 'sentryfrogg');
  }

  return entryCandidate ? path.dirname(entryCandidate) : process.cwd();
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
  resolveStatePath() {
    if (process.env.MCP_STATE_PATH) {
      return path.resolve(process.env.MCP_STATE_PATH);
    }
    return path.join(resolveProfileBaseDir(), 'state.json');
  },
  resolveProjectsPath() {
    if (process.env.MCP_PROJECTS_PATH) {
      return path.resolve(process.env.MCP_PROJECTS_PATH);
    }
    return path.join(resolveProfileBaseDir(), 'projects.json');
  },
  resolveRunbooksPath() {
    if (process.env.MCP_RUNBOOKS_PATH) {
      return path.resolve(process.env.MCP_RUNBOOKS_PATH);
    }
    return path.join(resolveProfileBaseDir(), 'runbooks.json');
  },
  resolveCapabilitiesPath() {
    if (process.env.MCP_CAPABILITIES_PATH) {
      return path.resolve(process.env.MCP_CAPABILITIES_PATH);
    }
    return path.join(resolveProfileBaseDir(), 'capabilities.json');
  },
  resolveEvidenceDir() {
    if (process.env.MCP_EVIDENCE_DIR) {
      return path.resolve(process.env.MCP_EVIDENCE_DIR);
    }
    return path.join(resolveProfileBaseDir(), '.sentryfrogg', 'evidence');
  },
  resolveAliasesPath() {
    if (process.env.MCP_ALIASES_PATH) {
      return path.resolve(process.env.MCP_ALIASES_PATH);
    }
    return path.join(resolveProfileBaseDir(), 'aliases.json');
  },
  resolvePresetsPath() {
    if (process.env.MCP_PRESETS_PATH) {
      return path.resolve(process.env.MCP_PRESETS_PATH);
    }
    return path.join(resolveProfileBaseDir(), 'presets.json');
  },
  resolveAuditPath() {
    if (process.env.MCP_AUDIT_PATH) {
      return path.resolve(process.env.MCP_AUDIT_PATH);
    }
    return path.join(resolveProfileBaseDir(), 'audit.jsonl');
  },
  resolveCacheDir() {
    if (process.env.MCP_CACHE_DIR) {
      return path.resolve(process.env.MCP_CACHE_DIR);
    }
    return path.join(resolveProfileBaseDir(), 'cache');
  },
};
