import { useEffect, useMemo, useState } from "react";
import "./configurator.css";
import {
  CPU_OPTIONS,
  DISPLAY_OPTIONS,
  GPU_OPTIONS,
  RAM_OPTIONS,
  STORAGE_OPTIONS,
  SUPPORTED_COUNTRIES,
  WORKSTATION_PRESETS,
  computeConfigurationPrice,
  validateConfiguration,
} from "./configRules.js";
import { quoteGateway } from "./quoteGateway.js";

function newIdemKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `nva-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function WorkstationConfigurator() {
  const [config, setConfig] = useState(WORKSTATION_PRESETS[1].config);
  const [comparePresetId, setComparePresetId] = useState(WORKSTATION_PRESETS[2].id);
  const [quantity, setQuantity] = useState(1);
  const [budgetUsd, setBudgetUsd] = useState(4500);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("PH");
  const [notes, setNotes] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});
  const [topError, setTopError] = useState("");
  const [createdQuote, setCreatedQuote] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdemKey());

  const [activeTab, setActiveTab] = useState("configure"); // 'configure' | 'lookup' | 'operator'
  const [lookupRef, setLookupRef] = useState("");
  const [lookupToken, setLookupToken] = useState("");
  const [lookedUpQuote, setLookedUpQuote] = useState(null);
  const [lookupMsg, setLookupMsg] = useState("");

  const [allQuotes, setAllQuotes] = useState([]);
  const [showSeeds, setShowSeeds] = useState(true);
  const [operatorMsg, setOperatorMsg] = useState("");

  const compatErrors = useMemo(() => validateConfiguration(config), [config]);
  const pricing = useMemo(() => computeConfigurationPrice(config), [config]);
  const comparePreset = useMemo(
    () => WORKSTATION_PRESETS.find((p) => p.id === comparePresetId) || WORKSTATION_PRESETS[0],
    [comparePresetId],
  );
  const comparePricing = useMemo(
    () => computeConfigurationPrice(comparePreset.config),
    [comparePreset],
  );

  const reloadOperatorQuotes = async () => {
    const list = await quoteGateway.listQuotes();
    setAllQuotes(list);
  };

  useEffect(() => {
    if (activeTab !== "operator") return;
    let active = true;
    void quoteGateway.listQuotes().then((list) => {
      if (active) setAllQuotes(list);
    });
    return () => {
      active = false;
    };
  }, [activeTab]);

  const selectPreset = (preset) => {
    setConfig({ ...preset.config });
    const nextPrice = computeConfigurationPrice(preset.config);
    if (nextPrice) setBudgetUsd(nextPrice.unitPriceUsd * quantity + 300);
    setFieldErrors({});
    setTopError("");
    setIdempotencyKey(newIdemKey());
  };

  const updateConfigPart = (key, value) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    const nextPrice = computeConfigurationPrice(next);
    if (nextPrice && budgetUsd < nextPrice.unitPriceUsd * quantity) {
      setBudgetUsd(nextPrice.unitPriceUsd * quantity);
    }
    setFieldErrors({});
    setTopError("");
    setIdempotencyKey(newIdemKey());
  };

  const handleSubmitQuote = async (e) => {
    e.preventDefault();
    setTopError("");
    setFieldErrors({});

    const res = await quoteGateway.createQuote(
      {
        name,
        email,
        company,
        country,
        quantity,
        budgetUsd,
        config,
        expectedUnitPriceUsd: pricing?.unitPriceUsd,
        notes,
      },
      idempotencyKey,
    );

    if (!res.ok) {
      setTopError(res.message);
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      return;
    }

    setCreatedQuote(res.data);
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setLookupMsg("");
    const res = await quoteGateway.getQuote(lookupRef, lookupToken);
    if (!res.ok) {
      setLookedUpQuote(null);
      setLookupMsg(res.message);
      return;
    }
    setLookedUpQuote(res.data);
  };

  const handleCancelQuote = async () => {
    if (!lookedUpQuote) return;
    const res = await quoteGateway.cancelQuote(lookedUpQuote.id, {
      token: lookupToken,
      actor: "customer",
    });
    if (res.ok) {
      setLookedUpQuote(res.data);
      setLookupMsg("Quote request cancelled.");
    }
  };

  const handleApproveQuote = async (q) => {
    const res = await quoteGateway.approveQuote(q.id, {
      approvedTotalUsd: q.totalPriceUsd,
      operatorNote: "Configuration & hardware allocation verified.",
    });
    if (res.ok) {
      await reloadOperatorQuotes();
      setOperatorMsg(`Approved quote ${q.id} ($${res.data.approvedTotalUsd.toLocaleString()} USD).`);
    }
  };

  const visibleOperatorQuotes = allQuotes.filter((q) => showSeeds || !q.isDemoSeed);

  return (
    <section className="nova-config-section" id="configure" aria-labelledby="nova-config-title">
      <div className="nova-config-shell">
        <header className="nova-config-header">
          <div>
            <p className="nova-config-eyebrow">07 / WORKSTATION CONFIGURATOR &amp; QUOTE DESK</p>
            <h2 id="nova-config-title">CONFIGURE YOUR NOVA 16.</h2>
            <p className="nova-config-sub">
              Compare architecture tiers, validate thermal and memory compatibility, and request a locked workstation quote.
            </p>
          </div>
          <div className="nova-config-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "configure"}
              className={activeTab === "configure" ? "is-active" : ""}
              onClick={() => setActiveTab("configure")}
            >
              1. Configure &amp; Quote
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "lookup"}
              className={activeTab === "lookup" ? "is-active" : ""}
              onClick={() => setActiveTab("lookup")}
            >
              2. Track Quote
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "operator"}
              className={activeTab === "operator" ? "is-active" : ""}
              onClick={() => setActiveTab("operator")}
            >
              3. Operator Quote Inbox
            </button>
          </div>
        </header>

        {activeTab === "configure" && (
          <div className="nova-config-grid">
            <div className="nova-config-builder">
              <div className="nova-presets">
                {WORKSTATION_PRESETS.map((preset) => {
                  const presetPrice = computeConfigurationPrice(preset.config);
                  return (
                    <button
                      type="button"
                      key={preset.id}
                      className="nova-preset-card"
                      onClick={() => selectPreset(preset)}
                    >
                      <strong>{preset.name}</strong>
                      <span>{preset.tagline}</span>
                      <b>{presetPrice?.formattedUnitPrice}</b>
                    </button>
                  );
                })}
              </div>

              <div className="nova-selectors">
                <label>
                  <span>Processor (CPU)</span>
                  <select
                    value={config.cpuId}
                    onChange={(e) => updateConfigPart("cpuId", e.target.value)}
                  >
                    {CPU_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} {o.priceDelta > 0 ? `(+$${o.priceDelta})` : "(Included)"}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Graphics Architecture (GPU)</span>
                  <select
                    value={config.gpuId}
                    onChange={(e) => updateConfigPart("gpuId", e.target.value)}
                  >
                    {GPU_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} {o.priceDelta > 0 ? `(+$${o.priceDelta})` : "(Included)"}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Unified Memory (LPDDR5X-8533)</span>
                  <select
                    value={config.ramId}
                    onChange={(e) => updateConfigPart("ramId", e.target.value)}
                  >
                    {RAM_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} {o.priceDelta > 0 ? `(+$${o.priceDelta})` : "(Included)"}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Gen5 NVMe Storage</span>
                  <select
                    value={config.storageId}
                    onChange={(e) => updateConfigPart("storageId", e.target.value)}
                  >
                    {STORAGE_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} {o.priceDelta > 0 ? `(+$${o.priceDelta})` : "(Included)"}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Reference Display Panel</span>
                  <select
                    value={config.displayId}
                    onChange={(e) => updateConfigPart("displayId", e.target.value)}
                  >
                    {DISPLAY_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} {o.priceDelta > 0 ? `(+$${o.priceDelta})` : "(Included)"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {compatErrors.length > 0 && (
                <div className="nova-compat-alert" role="alert">
                  <strong>Hardware Compatibility Constraint:</strong>
                  <ul>
                    {compatErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="nova-compare-box">
                <div className="nova-compare-head">
                  <strong>Side-by-Side Architecture Comparison</strong>
                  <select
                    aria-label="Compare against preset"
                    value={comparePresetId}
                    onChange={(e) => setComparePresetId(e.target.value)}
                  >
                    {WORKSTATION_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        Compare vs. {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="nova-compare-cols">
                  <div>
                    <span>Your Active Build</span>
                    <strong>{pricing ? pricing.formattedUnitPrice : "Incompatible build"}</strong>
                    {pricing && (
                      <ul>
                        <li>{pricing.labels.cpu}</li>
                        <li>{pricing.labels.gpu}</li>
                        <li>{pricing.labels.ram}</li>
                        <li>{pricing.labels.storage}</li>
                        <li>{pricing.labels.display}</li>
                      </ul>
                    )}
                  </div>
                  <div>
                    <span>{comparePreset.name}</span>
                    <strong>{comparePricing?.formattedUnitPrice}</strong>
                    {comparePricing && (
                      <ul>
                        <li>{comparePricing.labels.cpu}</li>
                        <li>{comparePricing.labels.gpu}</li>
                        <li>{comparePricing.labels.ram}</li>
                        <li>{comparePricing.labels.storage}</li>
                        <li>{comparePricing.labels.display}</li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="nova-quote-card">
              {!createdQuote ? (
                <form onSubmit={(e) => void handleSubmitQuote(e)} noValidate>
                  <h3>Request Workstation Quote</h3>
                  <div className="nova-price-banner">
                    <div>
                      <span>Authoritative Unit Price</span>
                      <strong>{pricing ? pricing.formattedUnitPrice : "Resolve compatibility"}</strong>
                    </div>
                    <div>
                      <span>Total ({quantity}x)</span>
                      <strong>
                        {pricing
                          ? `$${(pricing.unitPriceUsd * quantity).toLocaleString("en-US")} USD`
                          : "—"}
                      </strong>
                    </div>
                  </div>

                  {topError && (
                    <div className="nova-compat-alert" role="alert">
                      {topError}
                    </div>
                  )}

                  <div className="nova-form-row">
                    <label>
                      <span>Full Name</span>
                      <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Elena Vance"
                      />
                      {fieldErrors.name && <small className="nova-err">{fieldErrors.name}</small>}
                    </label>
                    <label>
                      <span>Email</span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="elena@studio.io"
                      />
                      {fieldErrors.email && <small className="nova-err">{fieldErrors.email}</small>}
                    </label>
                  </div>

                  <div className="nova-form-row">
                    <label>
                      <span>Company / Studio (Optional)</span>
                      <input
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Apex Robotics"
                      />
                    </label>
                    <label>
                      <span>Shipping Country</span>
                      <select value={country} onChange={(e) => setCountry(e.target.value)}>
                        {SUPPORTED_COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="nova-form-row">
                    <label>
                      <span>Quantity (1–25)</span>
                      <input
                        type="number"
                        min={1}
                        max={25}
                        value={quantity}
                        onChange={(e) => {
                          const q = Number(e.target.value);
                          setQuantity(q);
                          if (pricing) setBudgetUsd(pricing.unitPriceUsd * q);
                        }}
                      />
                      {fieldErrors.quantity && (
                        <small className="nova-err">{fieldErrors.quantity}</small>
                      )}
                    </label>
                    <label>
                      <span>Allocated Budget (USD)</span>
                      <input
                        type="number"
                        min={2000}
                        step={100}
                        value={budgetUsd}
                        onChange={(e) => setBudgetUsd(Number(e.target.value))}
                      />
                      {fieldErrors.budgetUsd && (
                        <small className="nova-err">{fieldErrors.budgetUsd}</small>
                      )}
                    </label>
                  </div>

                  <label>
                    <span>Deployment Notes (Optional)</span>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Linux/Windows preload, custom asset tagging, or fleet inquiry..."
                    />
                  </label>

                  <button
                    type="submit"
                    className="nova-submit-btn"
                    disabled={compatErrors.length > 0}
                  >
                    Lock Configuration &amp; Request Quote ↗
                  </button>
                </form>
              ) : (
                <div className="nova-quote-success">
                  <p className="nova-config-eyebrow">QUOTE SNAPSHOT PERSISTED</p>
                  <h3>Reference: {createdQuote.id}</h3>
                  <p>
                    Access Token: <strong>{createdQuote.manageToken}</strong>
                  </p>
                  <p>
                    {createdQuote.quantity}x NOVA 16 ({createdQuote.specLabels.cpu} ·{" "}
                    {createdQuote.specLabels.gpu}) — Total:{" "}
                    <strong>${createdQuote.totalPriceUsd.toLocaleString("en-US")} USD</strong>
                  </p>
                  <div className="nova-actions">
                    <button
                      type="button"
                      className="nova-submit-btn"
                      onClick={() => {
                        setLookupRef(createdQuote.id);
                        setLookupToken(createdQuote.manageToken);
                        setLookedUpQuote(createdQuote);
                        setActiveTab("lookup");
                      }}
                    >
                      Open Quote Status →
                    </button>
                    <button
                      type="button"
                      className="nova-outline-btn"
                      onClick={() => setCreatedQuote(null)}
                    >
                      Configure Another Build
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "lookup" && (
          <div className="nova-quote-card">
            <h3>Track Your Workstation Quote</h3>
            <form onSubmit={(e) => void handleLookup(e)} className="nova-form-row">
              <input
                value={lookupRef}
                onChange={(e) => setLookupRef(e.target.value)}
                placeholder="Quote Ref (e.g. NVA-DEMO-001)"
                required
              />
              <input
                value={lookupToken}
                onChange={(e) => setLookupToken(e.target.value)}
                placeholder="Access Token (e.g. demo-token-001)"
                required
              />
              <button type="submit" className="nova-submit-btn">
                Load Quote →
              </button>
            </form>
            {lookupMsg && <p className="nova-status-msg">{lookupMsg}</p>}
            {lookedUpQuote && (
              <div className="nova-lookup-details">
                <div>
                  <strong>{lookedUpQuote.id}</strong> — Status:{" "}
                  <span className="nova-badge">{lookedUpQuote.status}</span>
                </div>
                <div>
                  Client: {lookedUpQuote.name} ({lookedUpQuote.countryName}) · Qty:{" "}
                  {lookedUpQuote.quantity}
                </div>
                <div>
                  Specs: {lookedUpQuote.specLabels.cpu} · {lookedUpQuote.specLabels.gpu} ·{" "}
                  {lookedUpQuote.specLabels.ram} · {lookedUpQuote.specLabels.storage}
                </div>
                <div>
                  Quoted Total: ${lookedUpQuote.totalPriceUsd.toLocaleString("en-US")} USD
                  {lookedUpQuote.approvedTotalUsd
                    ? ` · Approved Total: $${lookedUpQuote.approvedTotalUsd.toLocaleString("en-US")} USD`
                    : ""}
                </div>
                {lookedUpQuote.operatorNote && (
                  <div>Operator Note: {lookedUpQuote.operatorNote}</div>
                )}
                {lookedUpQuote.status !== "cancelled" && (
                  <button
                    type="button"
                    className="nova-outline-btn"
                    onClick={() => void handleCancelQuote()}
                  >
                    Cancel Quote Request
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "operator" && (
          <div className="nova-quote-card">
            <div className="nova-compare-head">
              <h3>Operator Quote Inbox</h3>
              <label className="nova-seed-toggle">
                <input
                  type="checkbox"
                  checked={showSeeds}
                  onChange={(e) => setShowSeeds(e.target.checked)}
                />
                <span>Show demo seed quotes</span>
              </label>
            </div>
            {operatorMsg && <p className="nova-status-msg">{operatorMsg}</p>}
            <div className="nova-table-wrap">
              <table className="nova-table">
                <thead>
                  <tr>
                    <th>Ref / Client</th>
                    <th>Configuration</th>
                    <th>Qty &amp; Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOperatorQuotes.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <strong>{q.id}</strong>
                        {q.isDemoSeed && <span className="nova-badge">Demo seed</span>}
                        <div>
                          {q.name} · {q.email} ({q.country})
                        </div>
                      </td>
                      <td>
                        <div>{q.specLabels?.cpu}</div>
                        <div>
                          {q.specLabels?.gpu} · {q.specLabels?.ram}
                        </div>
                      </td>
                      <td>
                        {q.quantity}x · ${q.totalPriceUsd.toLocaleString("en-US")} USD
                      </td>
                      <td>{q.status}</td>
                      <td>
                        {q.status === "quote_requested" && (
                          <button
                            type="button"
                            className="nova-outline-btn"
                            onClick={() => void handleApproveQuote(q)}
                          >
                            Approve Quote ✓
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
