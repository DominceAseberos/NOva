import {
  SUPPORTED_COUNTRIES,
  WORKSTATION_PRESETS,
  computeConfigurationPrice,
  validateConfiguration,
  validateQuoteRequest,
} from './configRules.js';

const QUOTES_KEY = 'nova-workstation-quotes-v1';
const SEED_OVERRIDES_KEY = 'nova-seed-overrides-v1';
const IDEMPOTENCY_KEY = 'nova-quote-idempotency-v1';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

function defaultStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return createMemoryStorage();
}

function generateToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

export function createSeededQuotes(now = new Date()) {
  const proPreset = WORKSTATION_PRESETS[1];
  const pricing = computeConfigurationPrice(proPreset.config);
  return [
    {
      id: 'NVA-DEMO-001',
      manageToken: 'demo-token-001',
      name: 'Adrian Mercer',
      email: 'a.mercer@studioframe.io',
      company: 'Studio Frame VFX',
      country: 'SG',
      countryName: 'Singapore',
      quantity: 2,
      budgetUsd: 10000,
      config: proPreset.config,
      specLabels: pricing.labels,
      unitPriceUsd: pricing.unitPriceUsd,
      totalPriceUsd: pricing.unitPriceUsd * 2,
      approvedTotalUsd: pricing.unitPriceUsd * 2,
      notes: 'Dual workstation deployment for Unreal 5.5 look-dev.',
      operatorNote: 'Verified Singapore enterprise allocation; 5-day air freight.',
      status: 'quote_approved',
      createdAt: now.toISOString(),
      isDemoSeed: true,
    },
  ];
}

export class LocalQuoteGateway {
  constructor(storage = defaultStorage(), nowProvider = () => new Date()) {
    this.storage = storage;
    this.nowProvider = nowProvider;
  }

  readCustom() {
    try {
      const raw = this.storage.getItem(QUOTES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  writeCustom(list) {
    this.storage.setItem(QUOTES_KEY, JSON.stringify(list));
  }

  readSeedOverrides() {
    try {
      const raw = this.storage.getItem(SEED_OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  writeSeedOverrides(map) {
    this.storage.setItem(SEED_OVERRIDES_KEY, JSON.stringify(map));
  }

  readIdempotency() {
    try {
      const raw = this.storage.getItem(IDEMPOTENCY_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  writeIdempotency(map) {
    this.storage.setItem(IDEMPOTENCY_KEY, JSON.stringify(map));
  }

  allQuotesSync() {
    const custom = this.readCustom();
    const overrides = this.readSeedOverrides();
    const seeds = createSeededQuotes(this.nowProvider()).map((s) => ({
      ...s,
      ...(overrides[s.id] || {}),
      isDemoSeed: true,
    }));
    return [...custom, ...seeds];
  }

  async listQuotes() {
    return this.allQuotesSync();
  }

  async getQuote(id, token) {
    const found = this.allQuotesSync().find(
      (q) => q.id.toUpperCase() === String(id || '').trim().toUpperCase(),
    );
    if (!found) {
      return { ok: false, code: 'NOT_FOUND', message: 'Workstation quote reference not found.' };
    }
    if (token !== undefined && found.manageToken !== String(token || '').trim()) {
      return { ok: false, code: 'FORBIDDEN', message: 'Invalid access token for this quote.' };
    }
    return { ok: true, data: found };
  }

  async createQuote(input, idempotencyKey) {
    const idemp = this.readIdempotency();
    if (idempotencyKey && idemp[idempotencyKey]) {
      const existing = this.allQuotesSync().find((q) => q.id === idemp[idempotencyKey]);
      if (existing) return { ok: true, data: existing };
    }

    const compatErrors = validateConfiguration(input.config);
    if (compatErrors.length > 0) {
      return {
        ok: false,
        code: 'INCOMPATIBLE_CONFIG',
        message: compatErrors.join(' '),
        fieldErrors: { config: compatErrors.join(' ') },
      };
    }

    const pricing = computeConfigurationPrice(input.config);
    if (
      input.expectedUnitPriceUsd !== undefined &&
      Number(input.expectedUnitPriceUsd) !== pricing.unitPriceUsd
    ) {
      return {
        ok: false,
        code: 'PRICE_MISMATCH',
        message: `Configuration unit price changed to $${pricing.unitPriceUsd.toLocaleString('en-US')} USD. Please review before submitting.`,
        fieldErrors: {
          expectedUnitPriceUsd: `Updated unit price: $${pricing.unitPriceUsd.toLocaleString('en-US')} USD`,
        },
      };
    }

    const fieldErrors = validateQuoteRequest(input);
    if (Object.keys(fieldErrors).length > 0) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Please correct the highlighted quote fields.',
        fieldErrors,
      };
    }

    const now = this.nowProvider();
    const qty = Number(input.quantity ?? 1);
    const countryObj = SUPPORTED_COUNTRIES.find((c) => c.code === input.country);
    const initials =
      String(input.name)
        .trim()
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, 3)
        .toUpperCase() || 'NVA';
    const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
    const datePart = now.toISOString().slice(2, 10).replaceAll('-', '');
    const id = `NVA-${datePart}-${initials}${suffix}`;

    const record = {
      id,
      manageToken: generateToken(),
      name: String(input.name).trim(),
      email: String(input.email).trim().toLowerCase(),
      company: input.company ? String(input.company).trim() : '',
      country: countryObj.code,
      countryName: countryObj.name,
      quantity: qty,
      budgetUsd: Number(input.budgetUsd),
      config: { ...input.config },
      specLabels: pricing.labels,
      unitPriceUsd: pricing.unitPriceUsd,
      totalPriceUsd: pricing.unitPriceUsd * qty,
      notes: input.notes ? String(input.notes).trim() : '',
      status: 'quote_requested',
      createdAt: now.toISOString(),
      isDemoSeed: false,
    };

    try {
      const custom = this.readCustom();
      this.writeCustom([record, ...custom]);
      if (idempotencyKey) {
        idemp[idempotencyKey] = record.id;
        this.writeIdempotency(idemp);
      }
      return { ok: true, data: record };
    } catch {
      return {
        ok: false,
        code: 'STORAGE_ERROR',
        message: 'Could not save quote in browser storage.',
      };
    }
  }

  async approveQuote(id, approval = {}) {
    const found = await this.getQuote(id);
    if (!found.ok) return found;
    const quote = found.data;

    if (quote.status === 'cancelled') {
      return { ok: false, code: 'POLICY_VIOLATION', message: 'Cannot approve a cancelled quote.' };
    }

    const approvedTotal = Number(approval.approvedTotalUsd ?? quote.totalPriceUsd);
    const updated = {
      ...quote,
      approvedTotalUsd: approvedTotal,
      operatorNote: approval.operatorNote ? String(approval.operatorNote).trim() : quote.operatorNote,
      status: 'quote_approved',
    };
    return this.persistUpdated(updated);
  }

  async updateStatus(id, status) {
    const found = await this.getQuote(id);
    if (!found.ok) return found;
    const updated = { ...found.data, status };
    return this.persistUpdated(updated);
  }

  async cancelQuote(id, options = {}) {
    const found = await this.getQuote(id, options.actor === 'staff' ? undefined : options.token);
    if (!found.ok) return found;
    const updated = { ...found.data, status: 'cancelled' };
    return this.persistUpdated(updated);
  }

  persistUpdated(updated) {
    try {
      if (updated.isDemoSeed) {
        const overrides = this.readSeedOverrides();
        overrides[updated.id] = {
          status: updated.status,
          approvedTotalUsd: updated.approvedTotalUsd,
          operatorNote: updated.operatorNote,
        };
        this.writeSeedOverrides(overrides);
      } else {
        const custom = this.readCustom().map((q) => (q.id === updated.id ? updated : q));
        this.writeCustom(custom);
      }
      return { ok: true, data: updated };
    } catch {
      return { ok: false, code: 'STORAGE_ERROR', message: 'Failed to update quote.' };
    }
  }
}

export const quoteGateway = new LocalQuoteGateway();
