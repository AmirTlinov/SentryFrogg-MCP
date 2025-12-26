#!/usr/bin/env node

/**
 * 🧩 Реестр capability (intent → runbook)
 */

const fs = require('fs/promises');
const { resolveCapabilitiesPath } = require('../utils/paths.cjs');
const { atomicWriteTextFile } = require('../utils/fsAtomic.cjs');

class CapabilityService {
  constructor(logger, security) {
    this.logger = logger.child('capabilities');
    this.security = security;
    this.filePath = resolveCapabilitiesPath();
    this.capabilities = new Map();
    this.stats = {
      loaded: 0,
      created: 0,
      updated: 0,
      saved: 0,
      errors: 0,
    };

    this.initPromise = this.loadCapabilities();
  }

  async initialize() {
    await this.initPromise;
  }

  async ensureReady() {
    await this.initPromise;
  }

  async loadCapabilities() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const rawCapabilities = parsed.capabilities ?? parsed;
      if (Array.isArray(rawCapabilities)) {
        for (const entry of rawCapabilities) {
          if (entry && entry.name) {
            this.capabilities.set(entry.name, entry);
          }
        }
      } else {
        for (const [name, entry] of Object.entries(rawCapabilities || {})) {
          this.capabilities.set(name, { ...entry, name });
        }
      }
      this.stats.loaded = this.capabilities.size;
      this.logger.info('Capabilities loaded', { count: this.capabilities.size });
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.info('capabilities.json not found, starting clean');
        return;
      }
      this.stats.errors += 1;
      this.logger.error('Failed to load capabilities', { error: error.message });
      throw error;
    }
  }

  async persist() {
    const data = {
      version: 1,
      capabilities: Object.fromEntries(this.capabilities),
    };
    this.security.ensureSizeFits(JSON.stringify(data));
    await atomicWriteTextFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    this.stats.saved += 1;
  }

  async listCapabilities() {
    await this.ensureReady();
    return Array.from(this.capabilities.values()).map((capability) => ({
      name: capability.name,
      intent: capability.intent,
      description: capability.description,
      runbook: capability.runbook,
      effects: capability.effects,
      depends_on: capability.depends_on || [],
      tags: capability.tags || [],
      when: capability.when,
    }));
  }

  async getCapability(name) {
    await this.ensureReady();
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Capability name must be a non-empty string');
    }
    const key = name.trim();
    const entry = this.capabilities.get(key);
    if (!entry) {
      throw new Error(`Capability '${name}' not found`);
    }
    return entry;
  }

  async findByIntent(intentType) {
    await this.ensureReady();
    if (typeof intentType !== 'string' || intentType.trim().length === 0) {
      throw new Error('Intent type must be a non-empty string');
    }
    const key = intentType.trim();
    if (this.capabilities.has(key)) {
      return this.capabilities.get(key);
    }
    for (const capability of this.capabilities.values()) {
      if (capability.intent === key) {
        return capability;
      }
    }
    return null;
  }

  async setCapability(name, config) {
    await this.ensureReady();
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Capability name must be a non-empty string');
    }
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      throw new Error('Capability config must be an object');
    }

    const trimmedName = name.trim();
    const existing = this.capabilities.get(trimmedName) || {};
    const now = new Date().toISOString();
    const next = {
      ...existing,
      ...config,
      name: trimmedName,
      created_at: existing.created_at || now,
      updated_at: now,
    };

    this.capabilities.set(trimmedName, next);
    await this.persist();
    if (existing.created_at) {
      this.stats.updated += 1;
    } else {
      this.stats.created += 1;
    }

    this.logger.info('Capability saved', { name: trimmedName });
    return next;
  }

  async deleteCapability(name) {
    await this.ensureReady();
    if (!this.capabilities.delete(name)) {
      throw new Error(`Capability '${name}' not found`);
    }
    await this.persist();
    return { success: true };
  }

  getStats() {
    return { ...this.stats, total: this.capabilities.size };
  }

  async cleanup() {
    this.capabilities.clear();
  }
}

module.exports = CapabilityService;
