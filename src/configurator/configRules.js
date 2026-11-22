export const BASE_CHASSIS_PRICE_USD = 2199;

export const CPU_OPTIONS = [
  { id: 'ultra-7-265h', label: 'Intel Core Ultra 7 265H (16-core, 5.3 GHz)', priceDelta: 0 },
  { id: 'ultra-9-285hx', label: 'Intel Core Ultra 9 285HX (24-core, 5.7 GHz)', priceDelta: 450 },
];

export const GPU_OPTIONS = [
  { id: 'rtx-5060', label: 'NVIDIA GeForce RTX 5060 8GB GDDR7 (115W)', priceDelta: 0 },
  { id: 'rtx-5070', label: 'NVIDIA GeForce RTX 5070 12GB GDDR7 (140W)', priceDelta: 550 },
  { id: 'rtx-5080', label: 'NVIDIA GeForce RTX 5080 16GB GDDR7 (175W)', priceDelta: 1250 },
];

export const RAM_OPTIONS = [
  { id: '32gb', label: '32 GB LPDDR5X-8533 Unified', gigabytes: 32, priceDelta: 0 },
  { id: '64gb', label: '64 GB LPDDR5X-8533 Unified', gigabytes: 64, priceDelta: 400 },
  { id: '96gb', label: '96 GB LPDDR5X-8533 Unified', gigabytes: 96, priceDelta: 850 },
];

export const STORAGE_OPTIONS = [
  { id: '1tb-gen5', label: '1 TB PCIe Gen5 NVMe (14,000 MB/s)', priceDelta: 0 },
  { id: '2tb-gen5', label: '2 TB PCIe Gen5 NVMe (14,000 MB/s)', priceDelta: 280 },
  { id: '4tb-raid0', label: '4 TB Dual Gen5 NVMe RAID-0 (26,500 MB/s)', priceDelta: 780 },
];

export const DISPLAY_OPTIONS = [
  { id: 'miniled-3k', label: '16" 3.2K 165Hz Mini-LED (1,200 nits)', priceDelta: 0 },
  { id: 'oled-4k', label: '16" 4K 120Hz Tandem OLED (100% DCI-P3, ΔE < 0.8)', priceDelta: 350 },
];

export const SUPPORTED_COUNTRIES = [
  { code: 'PH', name: 'Philippines' },
  { code: 'US', name: 'United States' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'DE', name: 'Germany' },
  { code: 'GB', name: 'United Kingdom' },
];

export const WORKSTATION_PRESETS = [
  {
    id: 'nova-studio-16',
    name: 'NOVA Studio 16',
    tagline: 'Editorial, 3D design & color-critical mobile workflows',
    config: {
      cpuId: 'ultra-7-265h',
      gpuId: 'rtx-5060',
      ramId: '32gb',
      storageId: '1tb-gen5',
      displayId: 'miniled-3k',
    },
  },
  {
    id: 'nova-pro-16',
    name: 'NOVA Pro 16',
    tagline: 'Balanced CAD, Unreal Engine & real-time simulation build',
    config: {
      cpuId: 'ultra-9-285hx',
      gpuId: 'rtx-5070',
      ramId: '64gb',
      storageId: '2tb-gen5',
      displayId: 'oled-4k',
    },
  },
  {
    id: 'nova-apex-16',
    name: 'NOVA Apex 16',
    tagline: 'Maximum local LLM, 8K rendering & neural compute node',
    config: {
      cpuId: 'ultra-9-285hx',
      gpuId: 'rtx-5080',
      ramId: '96gb',
      storageId: '4tb-raid0',
      displayId: 'oled-4k',
    },
  },
];

export function findOption(list, id) {
  return list.find((item) => item.id === id);
}

/**
 * Validates hardware compatibility rules across CPU, GPU, RAM, Storage, and Display.
 */
export function validateConfiguration(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return ['Configuration is missing.'];
  }

  const cpu = findOption(CPU_OPTIONS, config.cpuId);
  const gpu = findOption(GPU_OPTIONS, config.gpuId);
  const ram = findOption(RAM_OPTIONS, config.ramId);
  const storage = findOption(STORAGE_OPTIONS, config.storageId);
  const display = findOption(DISPLAY_OPTIONS, config.displayId);

  if (!cpu) errors.push('Unsupported processor selection.');
  if (!gpu) errors.push('Unsupported graphics processor selection.');
  if (!ram) errors.push('Unsupported memory tier selection.');
  if (!storage) errors.push('Unsupported storage configuration.');
  if (!display) errors.push('Unsupported display panel selection.');

  if (errors.length > 0) return errors;

  // Rule 1: RTX 5080 16GB requires Core Ultra 9 285HX for PCIe lane & vapor-chamber thermal envelope
  if (gpu.id === 'rtx-5080' && cpu.id !== 'ultra-9-285hx') {
    errors.push('NVIDIA RTX 5080 16GB requires the Intel Core Ultra 9 285HX processor.');
  }

  // Rule 2: RTX 5080 16GB requires at least 64 GB unified system memory
  if (gpu.id === 'rtx-5080' && ram.gigabytes < 64) {
    errors.push('NVIDIA RTX 5080 16GB requires 64 GB or 96 GB system memory.');
  }

  // Rule 3: 96 GB memory controller pairing requires Core Ultra 9 285HX
  if (ram.id === '96gb' && cpu.id !== 'ultra-9-285hx') {
    errors.push('96 GB LPDDR5X-8533 memory requires the Intel Core Ultra 9 285HX processor.');
  }

  // Rule 4: 4 TB Dual Gen5 RAID-0 requires at least 64 GB memory
  if (storage.id === '4tb-raid0' && ram.gigabytes < 64) {
    errors.push('4 TB Dual Gen5 RAID-0 array requires at least 64 GB system memory.');
  }

  return errors;
}

export function computeConfigurationPrice(config) {
  const compatErrors = validateConfiguration(config);
  if (compatErrors.length > 0) return null;

  const cpu = findOption(CPU_OPTIONS, config.cpuId);
  const gpu = findOption(GPU_OPTIONS, config.gpuId);
  const ram = findOption(RAM_OPTIONS, config.ramId);
  const storage = findOption(STORAGE_OPTIONS, config.storageId);
  const display = findOption(DISPLAY_OPTIONS, config.displayId);

  const unitPriceUsd =
    BASE_CHASSIS_PRICE_USD +
    cpu.priceDelta +
    gpu.priceDelta +
    ram.priceDelta +
    storage.priceDelta +
    display.priceDelta;

  return {
    unitPriceUsd,
    formattedUnitPrice: `$${unitPriceUsd.toLocaleString('en-US')} USD`,
    labels: {
      cpu: cpu.label,
      gpu: gpu.label,
      ram: ram.label,
      storage: storage.label,
      display: display.label,
    },
  };
}

export function validateQuoteRequest(input) {
  const fieldErrors = {};
  const compatErrors = validateConfiguration(input.config);
  if (compatErrors.length > 0) {
    fieldErrors.config = compatErrors.join(' ');
  }

  const pricing = computeConfigurationPrice(input.config);
  const qty = Number(input.quantity ?? 1);
  if (!Number.isInteger(qty) || qty < 1 || qty > 25) {
    fieldErrors.quantity = 'Quantity must be between 1 and 25 workstations.';
  }

  if (
    pricing &&
    input.expectedUnitPriceUsd !== undefined &&
    Number(input.expectedUnitPriceUsd) !== pricing.unitPriceUsd
  ) {
    fieldErrors.expectedUnitPriceUsd = `Quoted unit price changed ($${pricing.unitPriceUsd.toLocaleString('en-US')} USD authoritative). Please review the updated total.`;
  }

  const budgetUsd = Number(input.budgetUsd);
  if (pricing && Number.isFinite(budgetUsd) && budgetUsd > 0) {
    const requiredTotal = pricing.unitPriceUsd * qty;
    if (budgetUsd < requiredTotal) {
      fieldErrors.budgetUsd = `Declared budget ($${budgetUsd.toLocaleString('en-US')} USD) is below the configured total ($${requiredTotal.toLocaleString('en-US')} USD).`;
    }
  } else {
    fieldErrors.budgetUsd = 'Enter your allocated hardware budget in USD.';
  }

  if (!input.name || String(input.name).trim().length < 2) {
    fieldErrors.name = 'Enter your full name (at least 2 characters).';
  }

  const email = String(input.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = 'Enter a valid business or personal email address.';
  }

  if (!SUPPORTED_COUNTRIES.some((c) => c.code === input.country)) {
    fieldErrors.country = 'Select a supported shipping country/region.';
  }

  return fieldErrors;
}
