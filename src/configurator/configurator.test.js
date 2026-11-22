import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeConfigurationPrice,
  validateConfiguration,
} from './configRules.js';
import { LocalQuoteGateway } from './quoteGateway.js';

function createMemStore() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

const FIXED_NOW = new Date('2027-01-12T00:00:00.000Z');

describe('configRules', () => {
  it('rejects unsupported hardware combinations (RTX 5080 with Ultra 7 or 32GB RAM)', () => {
    const badCpuAndRam = validateConfiguration({
      cpuId: 'ultra-7-265h',
      gpuId: 'rtx-5080',
      ramId: '32gb',
      storageId: '1tb-gen5',
      displayId: 'miniled-3k',
    });
    assert.equal(badCpuAndRam.length, 2);
    assert.equal(computeConfigurationPrice({
      cpuId: 'ultra-7-265h',
      gpuId: 'rtx-5080',
      ramId: '32gb',
      storageId: '1tb-gen5',
      displayId: 'miniled-3k',
    }), null);
  });

  it('computes authoritative workstation pricing for valid configurations', () => {
    const valid = computeConfigurationPrice({
      cpuId: 'ultra-9-285hx', // +450
      gpuId: 'rtx-5070',      // +550
      ramId: '64gb',          // +400
      storageId: '2tb-gen5',  // +280
      displayId: 'oled-4k',   // +350
    });
    assert.ok(valid);
    // 2199 + 450 + 550 + 400 + 280 + 350 = 4229
    assert.equal(valid.unitPriceUsd, 4229);
  });
});

describe('LocalQuoteGateway', () => {
  it('rejects price mismatches, enforces idempotency on quote replay, and supports operator approval', async () => {
    const gw = new LocalQuoteGateway(createMemStore(), () => FIXED_NOW);
    const validConfig = {
      cpuId: 'ultra-9-285hx',
      gpuId: 'rtx-5070',
      ramId: '64gb',
      storageId: '2tb-gen5',
      displayId: 'oled-4k',
    };

    // Stale / mismatched client price is rejected
    const stalePrice = await gw.createQuote(
      {
        name: 'Elena Vance',
        email: 'elena@example.com',
        country: 'US',
        quantity: 1,
        budgetUsd: 5000,
        config: validConfig,
        expectedUnitPriceUsd: 2999,
      },
      'idem-nva-stale',
    );
    assert.equal(stalePrice.ok, false);
    assert.equal(stalePrice.code, 'PRICE_MISMATCH');

    // Valid quote submission
    const payload = {
      name: 'Elena Vance',
      email: 'elena@example.com',
      company: 'Apex Robotics',
      country: 'US',
      quantity: 2,
      budgetUsd: 9000,
      config: validConfig,
      expectedUnitPriceUsd: 4229,
    };

    const created = await gw.createQuote(payload, 'idem-nva-1');
    assert.equal(created.ok, true);
    assert.equal(created.data.totalPriceUsd, 8458);

    // Replay with same idempotency key returns identical quote reference
    const replay = await gw.createQuote(payload, 'idem-nva-1');
    assert.equal(replay.ok, true);
    assert.equal(replay.data.id, created.data.id);

    // Operator approves quote
    const approved = await gw.approveQuote(created.data.id, {
      approvedTotalUsd: 8200,
      operatorNote: 'Fleet partner discount applied.',
    });
    assert.equal(approved.ok, true);
    assert.equal(approved.data.status, 'quote_approved');
    assert.equal(approved.data.approvedTotalUsd, 8200);
  });
});
