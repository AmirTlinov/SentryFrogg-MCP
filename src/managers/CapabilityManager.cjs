#!/usr/bin/env node

/**
 * 🧩 Capability Manager
 */

const EFFECT_KINDS = new Set(['read', 'write', 'mixed']);

function ensureStringArray(value, label) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const result = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throw new Error(`${label} must contain non-empty strings`);
    }
    result.push(entry.trim());
  }
  return result;
}

function ensureOptionalObject(value, label) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function normalizeInputs(inputs) {
  if (!inputs) {
    return { required: [], defaults: {}, map: {}, pass_through: true };
  }
  const required = ensureStringArray(inputs.required, 'Capability inputs.required');
  const defaults = ensureOptionalObject(inputs.defaults, 'Capability inputs.defaults') || {};
  const map = ensureOptionalObject(inputs.map, 'Capability inputs.map') || {};
  const passThrough = inputs.pass_through !== false;
  return {
    required,
    defaults,
    map,
    pass_through: passThrough,
  };
}

function normalizeEffects(effects) {
  const kind = effects?.kind || 'read';
  if (!EFFECT_KINDS.has(kind)) {
    throw new Error(`effects.kind must be one of: ${Array.from(EFFECT_KINDS).join(', ')}`);
  }
  const requiresApply = effects?.requires_apply ?? (kind !== 'read');
  return { kind, requires_apply: Boolean(requiresApply) };
}

class CapabilityManager {
  constructor(logger, security, validation, capabilityService) {
    this.logger = logger.child('capability');
    this.security = security;
    this.validation = validation;
    this.capabilityService = capabilityService;
  }

  async handleAction(args = {}) {
    const { action } = args;
    switch (action) {
      case 'list':
        return this.list();
      case 'get':
        return this.get(args);
      case 'set':
        return this.set(args);
      case 'delete':
        return this.delete(args);
      case 'resolve':
        return this.resolve(args);
      case 'graph':
        return this.graph();
      case 'stats':
        return this.capabilityService.getStats();
      default:
        throw new Error(`Unknown capability action: ${action}`);
    }
  }

  async list() {
    const capabilities = await this.capabilityService.listCapabilities();
    return { success: true, capabilities };
  }

  async get(args) {
    const name = this.validation.ensureString(args.name, 'Capability name');
    const capability = await this.capabilityService.getCapability(name);
    return { success: true, capability };
  }

  async resolve(args) {
    const intent = this.validation.ensureString(args.intent, 'Intent type');
    const capability = await this.capabilityService.findByIntent(intent);
    if (!capability) {
      throw new Error(`Capability for intent '${intent}' not found`);
    }
    return { success: true, capability };
  }

  async set(args) {
    const name = this.validation.ensureString(args.name, 'Capability name');
    const config = this.validation.ensureObject(args.capability, 'Capability config');
    this.security.ensureSizeFits(JSON.stringify(config));

    const normalized = {
      name,
      intent: this.validation.ensureString(config.intent || name, 'Capability intent'),
      description: config.description ? this.validation.ensureString(config.description, 'Capability description', { trim: false }) : undefined,
      runbook: this.validation.ensureString(config.runbook, 'Capability runbook'),
      inputs: normalizeInputs(config.inputs),
      effects: normalizeEffects(config.effects),
      depends_on: ensureStringArray(config.depends_on, 'Capability depends_on'),
      tags: ensureStringArray(config.tags, 'Capability tags'),
    };

    const capability = await this.capabilityService.setCapability(name, normalized);
    return { success: true, capability };
  }

  async delete(args) {
    const name = this.validation.ensureString(args.name, 'Capability name');
    return this.capabilityService.deleteCapability(name);
  }

  async graph() {
    const items = await this.capabilityService.listCapabilities();
    const edges = items.map((capability) => ({
      name: capability.name,
      depends_on: capability.depends_on || [],
      intent: capability.intent,
    }));
    return { success: true, graph: edges };
  }
}

module.exports = CapabilityManager;
