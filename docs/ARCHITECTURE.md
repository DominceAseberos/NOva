# NOVA Laptop — 3D Showcase & Workstation Configurator Architecture

- `src/configurator/configRules.js` — Canonical workstation options (CPU, GPU, LPDDR5X-8533 RAM, Gen5 NVMe storage, Mini-LED/OLED display), hardware compatibility validation (`validateConfiguration`), authoritative pricing (`computeConfigurationPrice`), and quote request validation (`validateQuoteRequest`).
- `src/configurator/quoteGateway.js` — `LocalQuoteGateway` with injectable storage, idempotency deduplication, compatibility and price-integrity verification (`INCOMPATIBLE_CONFIG`, `PRICE_MISMATCH`), operator quote approval, and token-protected customer lookup.
- `src/configurator/WorkstationConfigurator.jsx` (`#configure`) — Interactive workstation builder, side-by-side preset comparison, quote submission form, customer quote lookup tab, and operator quote inbox tab.
- `src/App.jsx` — Preserves the 6-chapter 3D scroll-story timeline and wraps `PersistentLaptop3D` in `Laptop3DErrorBoundary` so 3D load failures never block specifications or quote requests.
